-- List org members with email (org members only)
create or replace function public.list_org_members(p_org_id uuid)
returns table (
  user_id uuid,
  email text,
  role public.org_role,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'permission denied';
  end if;

  return query
  select om.user_id, u.email::text, om.role, om.created_at
  from public.organization_members om
  join auth.users u on u.id = om.user_id
  where om.org_id = p_org_id
  order by om.created_at asc;
end;
$$;

-- Invite an existing Auth user by email (owners only)
create or replace function public.invite_org_member(
  p_org_id uuid,
  p_email text,
  p_role public.org_role default 'editor'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  if not public.is_org_member(p_org_id, array['owner']::public.org_role[]) then
    raise exception 'permission denied';
  end if;

  v_email := lower(trim(p_email));
  if v_email = '' then
    raise exception 'email required';
  end if;

  if p_role = 'owner' then
    raise exception 'cannot invite as owner';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = v_email;

  if v_user_id is null then
    raise exception 'user not found';
  end if;

  if exists (
    select 1 from public.organization_members
    where org_id = p_org_id and user_id = v_user_id
  ) then
    raise exception 'already member';
  end if;

  insert into public.organization_members (org_id, user_id, role)
  values (p_org_id, v_user_id, p_role);
end;
$$;

grant execute on function public.list_org_members(uuid) to authenticated;
grant execute on function public.invite_org_member(uuid, text, public.org_role) to authenticated;
