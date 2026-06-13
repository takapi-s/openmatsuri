-- Anonymous viewer locations for operator heatmap (not shared with other visitors)

alter table public.events
  add column if not exists viewer_location_retention_days integer not null default 365
    check (viewer_location_retention_days >= 1 and viewer_location_retention_days <= 3650);

comment on column public.events.viewer_location_retention_days is
  'Days to retain viewer location points before cleanup (default 365).';

create table public.viewer_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  session_token uuid not null unique,
  consented_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index viewer_sessions_event_id_idx on public.viewer_sessions (event_id);

create table public.viewer_location_points (
  id bigserial primary key,
  session_id uuid not null references public.viewer_sessions(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  location geography(point, 4326) not null,
  accuracy double precision,
  recorded_at timestamptz not null default now()
);

create index viewer_location_points_event_recorded_idx
  on public.viewer_location_points (event_id, recorded_at desc);
create index viewer_location_points_session_id_idx
  on public.viewer_location_points (session_id, recorded_at desc);

create or replace function public.ingest_viewer_location(
  p_session_token uuid,
  p_event_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_recorded_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  if not public.is_live_event(p_event_id) then
    raise exception 'event not live';
  end if;

  select id into v_session_id
  from public.viewer_sessions
  where session_token = p_session_token
    and event_id = p_event_id;

  if v_session_id is null then
    insert into public.viewer_sessions (event_id, session_token, consented_at, last_seen_at)
    values (p_event_id, p_session_token, now(), now())
    returning id into v_session_id;
  else
    update public.viewer_sessions
    set last_seen_at = now()
    where id = v_session_id;
  end if;

  insert into public.viewer_location_points (session_id, event_id, location, accuracy, recorded_at)
  values (
    v_session_id,
    p_event_id,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_accuracy,
    coalesce(p_recorded_at, now())
  );
end;
$$;

create or replace function public.cleanup_old_viewer_locations()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.viewer_location_points vlp
  using public.events e
  where vlp.event_id = e.id
    and vlp.recorded_at < now() - make_interval(days => e.viewer_location_retention_days);

  delete from public.viewer_sessions vs
  where vs.last_seen_at < now() - interval '30 days'
    and not exists (
      select 1 from public.viewer_location_points vlp where vlp.session_id = vs.id
    );
end;
$$;

select cron.schedule(
  'cleanup-viewer-locations',
  '0 4 * * *',
  $$select public.cleanup_old_viewer_locations();$$
);

alter table public.viewer_sessions enable row level security;
alter table public.viewer_location_points enable row level security;

create policy "viewer_sessions org read" on public.viewer_sessions
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id)
    )
  );

create policy "viewer_location_points org read" on public.viewer_location_points
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id and public.is_org_member(e.org_id)
    )
  );

grant execute on function public.ingest_viewer_location(
  uuid, uuid, double precision, double precision, double precision, timestamptz
) to anon, authenticated;

grant select on public.viewer_sessions to authenticated;
grant select on public.viewer_location_points to authenticated;
