-- Demo seed data for local development

insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'デモ実行委員会');

insert into public.events (
  id, org_id, slug, name, description,
  starts_at, ends_at, status,
  map_center, map_zoom
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'demo-matsuri',
  'デモ祭り 2026',
  'OpenMATSURI のデモイベントです。',
  '2026-06-12 10:00:00+09',
  '2026-06-12 18:00:00+09',
  'live',
  st_setsrid(st_makepoint(135.5023, 34.6937), 4326)::geography,
  15
);

insert into public.trackers (id, event_id, name, description, group_name, icon_color, secret_token, device_type) values
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', '東町だんじり', '東町の地車です', '東町', '#dc2626', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pwa'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', '西町だんじり', '西町の地車です', '西町', '#2563eb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pwa'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '南町山車', '南町の山車です', '南町', '#16a34a', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'soracom_lte'),
  ('33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222222', '北町山車', '北町の山車です', '北町', '#ca8a04', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'pwa'),
  ('33333333-3333-3333-3333-333333333335', '22222222-2222-2222-2222-222222222222', '中央神輿', '中央の神輿です', '中央', '#9333ea', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'pwa');

update public.trackers
set soracom_sim_id = '895602000000001'
where id = '33333333-3333-3333-3333-333333333333';

insert into public.pois (event_id, name, kind, location, description) values
  ('22222222-2222-2222-2222-222222222222', '臨時トイレ A', 'toilet', st_setsrid(st_makepoint(135.5010, 34.6945), 4326)::geography, '会場北側'),
  ('22222222-2222-2222-2222-222222222222', '臨時駐車場', 'parking', st_setsrid(st_makepoint(135.5040, 34.6920), 4326)::geography, '500台収容'),
  ('22222222-2222-2222-2222-222222222222', '救護所', 'shelter', st_setsrid(st_makepoint(135.5005, 34.6930), 4326)::geography, '救護スタッフ常駐');

insert into public.routes (event_id, name, path, is_visible) values (
  '22222222-2222-2222-2222-222222222222',
  'メインコース',
  st_setsrid(st_geomfromtext('LINESTRING(135.5000 34.6920, 135.5015 34.6935, 135.5030 34.6945, 135.5045 34.6935, 135.5030 34.6925)'), 4326)::geography,
  true
);

-- Initial demo locations
select public.upsert_location('33333333-3333-3333-3333-333333333331', 34.6937, 135.5010, null, null, 5, 'pwa');
select public.upsert_location('33333333-3333-3333-3333-333333333332', 34.6940, 135.5025, null, null, 5, 'pwa');
