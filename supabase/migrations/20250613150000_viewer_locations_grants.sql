-- Grant SELECT on viewer tables (ALL TABLES grant in initial migration does not cover later tables)
grant select on public.viewer_sessions to authenticated;
grant select on public.viewer_location_points to authenticated;
