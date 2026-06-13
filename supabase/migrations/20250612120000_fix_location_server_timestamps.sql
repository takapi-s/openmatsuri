-- Use server receive time for online detection (not client-recorded GPS time).
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
  v_now timestamptz := now();
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
    v_now
  )
  on conflict (tracker_id) do update set
    location = excluded.location,
    heading = excluded.heading,
    speed = excluded.speed,
    accuracy = excluded.accuracy,
    updated_at = v_now;

  insert into public.location_history (tracker_id, event_id, location, heading, speed, accuracy, source, recorded_at)
  values (
    p_tracker_id,
    v_event_id,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_heading,
    p_speed,
    p_accuracy,
    p_source,
    coalesce(p_recorded_at, v_now)
  );

  update public.trackers
  set last_seen_at = v_now
  where id = p_tracker_id;
end;
$$;
