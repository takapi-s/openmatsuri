-- Grant RPC access for tracker token resolution (public tracker PWA)
grant execute on function public.resolve_tracker_by_token(uuid) to anon, authenticated;
grant execute on function public.resolve_tracker_by_sim(text) to service_role;

create or replace function public.get_tracker_public_info(p_token uuid)
returns table (id uuid, name text, event_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.event_id
  from public.trackers t
  where t.secret_token = p_token and t.is_active = true;
$$;

grant execute on function public.get_tracker_public_info(uuid) to anon, authenticated;
