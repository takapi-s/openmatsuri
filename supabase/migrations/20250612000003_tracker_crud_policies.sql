-- Split trackers write policy so INSERT/UPDATE/DELETE are explicit (FOR ALL can be flaky with RETURNING)

drop policy if exists "trackers org write" on public.trackers;

create policy "trackers org insert" on public.trackers
  for insert with check (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and public.is_org_member(e.org_id, array['owner','editor']::public.org_role[])
    )
  );

create policy "trackers org update" on public.trackers
  for update using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and public.is_org_member(e.org_id, array['owner','editor']::public.org_role[])
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and public.is_org_member(e.org_id, array['owner','editor']::public.org_role[])
    )
  );

create policy "trackers org delete" on public.trackers
  for delete using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and public.is_org_member(e.org_id, array['owner','editor']::public.org_role[])
    )
  );
