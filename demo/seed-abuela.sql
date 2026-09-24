-- Cercana demo family "Carmen's family" (code ABUELA). Fictional people, generated faces.
delete from circles where code = 'ABUELA';
with c as (
  insert into circles (code, patient_name) values ('ABUELA', 'Carmen') returning id
), p as (
  insert into people (circle_id, name, relation, phone, photo_url, birthday, role, claimed)
  select c.id, v.name, v.rel, null, 'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/' || v.img, v.bday::date, v.role, false
  from c, (values
    ('Pedro',  'your son',             'pedro.jpg',  '1979-06-02', 'lead'),
    ('Anna',   'your daughter-in-law', 'anna.jpg',   '1976-03-14', 'admin'),
    ('Diego',  'your grandson',        'diego.jpg',  '2016-09-25', 'member')
  ) v(name, rel, img, bday, role)
  returning id, name, circle_id
), m as (
  insert into moments (circle_id, person_id, author, author_person_id, body, photo_url, audio_url, created_at)
  select a.circle_id, about.id, -- null about = everyone a.name, a.id, v.body,
         'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/' || v.img,
         case when v.audio is null then null else 'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/' || v.audio end,
         now() - v.ago::interval
  from (values
    ('Anna',   'Anna',   'Landed in London! Raining, of course. I''ll call you tonight.',                    'm_london.jpg',  'v_anna.mp3',   '2 hours'),
    ('Pedro',  null,     'This morning we walked to the park and fed the pigeons. You laughed a lot.',        'm_park.jpg',    null,           '4 hours'),
    ('Pedro',  'Diego',  'Diego made you a drawing at school. We''re coming on Sunday with the cake.',        'm_drawing.jpg', 'v_pedro.mp3',  '1 day'),
    ('Anna',   'Anna',   'We had lunch at the beach. You loved the paella.',                                  'm_paella.jpg',  null,           '6 days')
  ) v(author, about, body, img, audio, ago)
  join p a on a.name = v.author left join p about on about.name = v.about
  returning 1
), cal as (
  insert into calendars (circle_id, label, ics_url)
  select c.id, v.label, 'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/' || v.f
  from c, (values ('Anna''s calendar', 'anna.ics'), ('Family', 'family-v2.ics')) v(label, f)
  returning id, label
), cp as (
  insert into calendar_people (calendar_id, person_id)
  select cal.id, p.id from cal join p on
    (cal.label = 'Anna''s calendar' and p.name = 'Anna') or
    (cal.label = 'Family' and p.name in ('Pedro', 'Diego'))
  returning 1
)
select (select count(*) from p) as people, (select count(*) from m) as moments,
       (select count(*) from cal) as calendars, (select count(*) from cp) as links;
