-- TEST ONLY. Pre-lockdown data as the live project has it: a circle, a family profile whose photo is
-- a PUBLIC media URL, a moment with a public photo + voice note, and a second circle. Run BEFORE
-- the 20260928 migrations so the tests can check the legacy conversion.
update storage.buckets set public = true where id = 'media'; -- as the live project is before the lockdown

insert into circles (id, code, patient_name) values
  ('11111111-1111-4111-8111-111111111111', 'AAAAAA', 'Carmen'),
  ('22222222-2222-4222-8222-222222222222', 'BBBBBB', 'Other')
on conflict (id) do nothing;

insert into people (id, circle_id, name, relation, phone, photo_url, role, claimed) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Lucia', 'daughter', '+34600000001',
   'http://127.0.0.1:54321/storage/v1/object/public/media/photo/legacy-lucia.jpg', 'lead', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'Pablo', 'son', null, null, 'member', false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '22222222-2222-4222-8222-222222222222', 'Stranger', null, null,
   'http://127.0.0.1:54321/storage/v1/object/public/media/photo/legacy-stranger.jpg', 'lead', true)
on conflict (id) do nothing;

insert into moments (id, circle_id, author, body, photo_url, audio_url) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'Lucia', 'Sunday lunch',
   'http://127.0.0.1:54321/storage/v1/object/public/media/photo/legacy-lunch.jpg',
   'http://127.0.0.1:54321/storage/v1/object/public/media/audio/legacy-lunch.m4a')
on conflict (id) do nothing;
