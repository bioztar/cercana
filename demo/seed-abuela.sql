-- Cercana demo family "Maria's family" (code ABUELA). Fictional people, generated faces.
-- Dates are relative to the day you run it: Lucia's birthday is tomorrow, the blood test is this morning.
-- Phone numbers are NOT in this public file; add them live after seeding (see demo/README.md).
delete from circles where code = 'ABUELA';
with c as (
  insert into circles (code, patient_name) values ('ABUELA', 'Maria') returning id
), p as (
  insert into people (circle_id, name, relation, phone, photo_url, birthday, role, claimed)
  select c.id, v.name, v.rel, null, 'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/' || v.img, v.bday::date, v.role, false
  from c, (values
    ('Anna',   'your daughter',      'anna.jpg',   '1976-03-14', 'lead'),
    ('Pedro',  'your son',           'pedro.jpg',  '1979-06-02', 'admin'),
    ('Carmen', 'your sister',        'carmen.jpg', '1950-11-20', 'member'),
    ('Lucia',  'your granddaughter', 'lucia.jpg',  ((current_date + 1) - interval '16 years')::date::text, 'member'),
    ('Diego',  'your grandson',      'diego.jpg',  '2017-05-09', 'member'),
    ('Rosa',   'your carer',         'rosa.jpg',   null,         'admin')
  ) v(name, rel, img, bday, role)
  returning id, name, circle_id
), m as (
  insert into moments (circle_id, person_id, author, author_person_id, body, photo_url, audio_url, created_at)
  select a.circle_id, about.id, a.name, a.id, v.body,
         'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/' || v.img,
         case when v.audio is null then null else 'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/' || v.audio end,
         now() - v.ago::interval
  from (values
    ('Anna',   'Anna',   'Landed in London! Raining, of course. I''ll call you tonight.',                    'm_london.jpg',  'v_anna.mp3',   '2 hours'),
    ('Rosa',   'Rosa',   'This morning we walked to the park and fed the pigeons. You laughed a lot.',        'm_park.jpg',    null,           '4 hours'),
    ('Pedro',  'Diego',  'Diego made you a drawing at school. We''re coming on Sunday with the cake.',        'm_drawing.jpg', 'v_pedro.mp3',  '1 day'),
    ('Carmen', 'Carmen', 'The geraniums on my balcony are blooming again, just like Mum''s used to.',         'm_garden.jpg',  'v_carmen.mp3', '2 days'),
    ('Anna',   'Lucia',  'Lucia got a nine in her maths exam! She turns 16 tomorrow.',                        'm_exam.jpg',    null,           '3 days'),
    ('Anna',   'Anna',   'We had lunch at the beach. You loved the paella.',                                  'm_paella.jpg',  null,           '6 days')
  ) v(author, about, body, img, audio, ago)
  join p a on a.name = v.author join p about on about.name = v.about
  returning 1
), cal as (
  insert into calendars (circle_id, label, ics_url)
  select c.id, v.label, 'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/' || v.f
  from c, (values ('Anna''s calendar', 'anna.ics'), ('Family', 'family.ics')) v(label, f)
  returning id, label
), cp as (
  insert into calendar_people (calendar_id, person_id)
  select cal.id, p.id from cal join p on
    (cal.label = 'Anna''s calendar' and p.name = 'Anna') or
    (cal.label = 'Family' and p.name in ('Pedro', 'Diego', 'Rosa'))
  returning 1
)
), imp as (
  -- A check-in that is already due: "Blood test this morning", 09:00–09:30 Madrid, created by Pedro.
  -- The check reminder is 2 h after the end, so "Did you go?" shows on Maria's home from 11:30.
  insert into important_events (circle_id, title, starts_at, ends_at, location, created_by_person_id, reminders)
  select c.id, 'Blood test', t.s, t.e, 'Health centre', (select id from p where name = 'Pedro'),
         jsonb_build_array(
           jsonb_build_object('kind', 'evening_before', 'at', to_jsonb((current_date - 1 + time '20:00') at time zone 'Europe/Madrid')),
           jsonb_build_object('kind', 'on_day', 'at', to_jsonb(t.s - interval '2 hours')),
           jsonb_build_object('kind', 'check', 'at', to_jsonb(t.e + interval '2 hours')))
  from c, (select (current_date + time '09:00') at time zone 'Europe/Madrid' as s,
                  (current_date + time '09:30') at time zone 'Europe/Madrid' as e) t
  returning 1
)
select (select count(*) from p) as people, (select count(*) from m) as moments,
       (select count(*) from cal) as calendars, (select count(*) from cp) as links, (select count(*) from imp) as important;
