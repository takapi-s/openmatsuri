-- Allow users to add themselves as org owner on bootstrap
create policy "members self insert bootstrap" on public.organization_members
  for insert with check (user_id = auth.uid());
