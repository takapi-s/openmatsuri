-- OpenMATSURI: initial schema with PostGIS, RLS, ingest RPC

create extension if not exists postgis;
create extension if not exists pg_cron;

-- Enums
create type public.event_status as enum ('draft', 'live', 'archived');
create type public.device_type as enum ('pwa', 'soracom_lte', 'android_agent', 'pi_agent', 'external');
create type public.poi_kind as enum ('toilet', 'parking', 'shelter', 'food', 'other');
create type public.org_role as enum ('owner', 'editor', 'viewer');
create type public.location_source as enum ('pwa', 'android_agent', 'pi_agent', 'soracom', 'traccar');

-- Organizations (multi-tenant)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.event_status not null default 'draft',
  map_center geography(point, 4326),
  map_zoom integer not null default 14,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

create index events_status_idx on public.events (status);
create index events_org_id_idx on public.events (org_id);

-- Trackers
create table public.trackers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  group_name text,
  icon_url text,
  icon_color text default '#e11d48',
  secret_token uuid not null default gen_random_uuid() unique,
  device_type public.device_type not null default 'pwa',
  soracom_sim_id text unique,
  external_device_id text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index trackers_event_id_idx on public.trackers (event_id);
create index trackers_soracom_sim_id_idx on public.trackers (soracom_sim_id) where soracom_sim_id is not null;

-- Latest locations (Viewer subscribes here)
create table public.tracker_locations (
  tracker_id uuid primary key references public.trackers(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  location geography(point, 4326) not null,
  heading double precision,
  speed double precision,
  accuracy double precision,
  updated_at timestamptz not null default now()
);

create index tracker_locations_event_id_idx on public.tracker_locations (event_id);

-- Location history
create table public.location_history (
  id bigserial primary key,
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  location geography(point, 4326) not null,
  heading double precision,
  speed double precision,
  accuracy double precision,
  source public.location_source not null default 'pwa',
  recorded_at timestamptz not null default now()
);

create index location_history_tracker_id_idx on public.location_history (tracker_id, recorded_at desc);
create index location_history_event_id_idx on public.location_history (event_id, recorded_at desc);

-- POIs
create table public.pois (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  kind public.poi_kind not null default 'other',
  location geography(point, 4326) not null,
  description text,
  created_at timestamptz not null default now()
);

create index pois_event_id_idx on public.pois (event_id);

-- Routes
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  path geography(linestring, 4326) not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index routes_event_id_idx on public.routes (event_id);

-- Helper: check org membership
create or replace function public.is_org_member(p_org_id uuid, p_roles public.org_role[] default array['owner','editor','viewer']::public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = auth.uid()
      and om.role = any(p_roles)
  );
$$;

create or replace function public.is_live_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.status = 'live'
  );
$$;

-- Sync event_id on tracker_locations from trackers
create or replace function public.sync_tracker_location_event_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.event_id := (select event_id from public.trackers where id = new.tracker_id);
  return new;
end;
$$;

create trigger tracker_locations_sync_event_id
  before insert or update on public.tracker_locations
  for each row execute function public.sync_tracker_location_event_id();

-- Core ingest RPC (called from Edge Functions only via service role)
create or replace function public.upsert_location(
  p_tracker_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null,
  p_speed double precision default null,
  p_accuracy double precision default null,
  p_source public.location_source default 'pwa',
  p_recorded_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_is_active boolean;
begin
  select t.event_id, t.is_active into v_event_id, v_is_active
  from public.trackers t
  where t.id = p_tracker_id;

  if v_event_id is null then
    raise exception 'tracker not found';
  end if;

  if not v_is_active then
    raise exception 'tracker inactive';
  end if;

  insert into public.tracker_locations (tracker_id, event_id, location, heading, speed, accuracy, updated_at)
  values (
    p_tracker_id,
    v_event_id,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_heading,
    p_speed,
    p_accuracy,
    coalesce(p_recorded_at, now())
  )
  on conflict (tracker_id) do update set
    location = excluded.location,
    heading = excluded.heading,
    speed = excluded.speed,
    accuracy = excluded.accuracy,
    updated_at = excluded.updated_at;

  insert into public.location_history (tracker_id, event_id, location, heading, speed, accuracy, source, recorded_at)
  values (
    p_tracker_id,
    v_event_id,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_heading,
    p_speed,
    p_accuracy,
    p_source,
    coalesce(p_recorded_at, now())
  );

  update public.trackers
  set last_seen_at = coalesce(p_recorded_at, now())
  where id = p_tracker_id;
end;
$$;

create or replace function public.resolve_tracker_by_token(p_token uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.trackers where secret_token = p_token and is_active = true;
$$;

create or replace function public.resolve_tracker_by_sim(p_sim_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.trackers where soracom_sim_id = p_sim_id and is_active = true;
$$;

-- GeoJSON helpers for API responses
create or replace function public.geojson_point(g geography)
returns json
language sql
immutable
as $$
  select json_build_object(
    'type', 'Point',
    'coordinates', array[st_x(g::geometry), st_y(g::geometry)]
  );
$$;

create or replace function public.geojson_linestring(g geography)
returns json
language sql
immutable
as $$
  select st_asgeojson(g::geometry)::json;
$$;

-- Cleanup old location history (30 days after event ends)
create or replace function public.cleanup_old_location_history()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.location_history lh
  using public.events e
  where lh.event_id = e.id
    and e.ends_at is not null
    and e.ends_at < now() - interval '30 days';
end;
$$;

select cron.schedule(
  'cleanup-location-history',
  '0 3 * * *',
  $$select public.cleanup_old_location_history();$$
);

-- RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.events enable row level security;
alter table public.trackers enable row level security;
alter table public.tracker_locations enable row level security;
alter table public.location_history enable row level security;
alter table public.pois enable row level security;
alter table public.routes enable row level security;

-- Organizations: members only
create policy "org members select" on public.organizations
  for select using (public.is_org_member(id));

create policy "org owners insert" on public.organizations
  for insert with check (auth.uid() is not null);

create policy "org owners update" on public.organizations
  for update using (public.is_org_member(id, array['owner','editor']::public.org_role[]));

-- Organization members
create policy "members select own org" on public.organization_members
  for select using (public.is_org_member(org_id));

create policy "owners manage members" on public.organization_members
  for all using (public.is_org_member(org_id, array['owner']::public.org_role[]));

-- Events: live public read, org members full access
create policy "events live public read" on public.events
  for select using (status = 'live' or public.is_org_member(org_id));

create policy "events org insert" on public.events
  for insert with check (public.is_org_member(org_id, array['owner','editor']::public.org_role[]));

create policy "events org update" on public.events
  for update using (public.is_org_member(org_id, array['owner','editor']::public.org_role[]));

create policy "events org delete" on public.events
  for delete using (public.is_org_member(org_id, array['owner']::public.org_role[]));

-- Trackers: live event public read
create policy "trackers live public read" on public.trackers
  for select using (
    public.is_live_event(event_id)
    or exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id)
    )
  );

create policy "trackers org write" on public.trackers
  for all using (
    exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id, array['owner','editor']::public.org_role[])
    )
  );

-- Tracker locations: live public read
create policy "tracker_locations live public read" on public.tracker_locations
  for select using (
    public.is_live_event(event_id)
    or exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id)
    )
  );

-- POIs & routes: live public read
create policy "pois live public read" on public.pois
  for select using (
    public.is_live_event(event_id)
    or exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id)
    )
  );

create policy "pois org write" on public.pois
  for all using (
    exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id, array['owner','editor']::public.org_role[])
    )
  );

create policy "routes live public read" on public.routes
  for select using (
    (is_visible and public.is_live_event(event_id))
    or exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id)
    )
  );

create policy "routes org write" on public.routes
  for all using (
    exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id, array['owner','editor']::public.org_role[])
    )
  );

-- Location history: org members only
create policy "location_history org read" on public.location_history
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id)
    )
  );

-- Realtime publication
alter publication supabase_realtime add table public.tracker_locations;

-- Grants for anon/authenticated
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
