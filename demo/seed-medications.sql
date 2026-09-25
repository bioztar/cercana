-- Medicines for the ABUELA demo circle (cercana-meds). Additive — run after seed-abuela.sql,
-- does not touch or recreate the circle. Re-running clears just this circle's medicines/logs first,
-- so it's safe to re-seed on a new day.
-- "Memory pill" is due right now: its time is computed from the clock the seed runs at, so the
-- patient app shows "Did you take it?" immediately without waiting for the real clock.
with c as (
  select id from circles where code = 'ABUELA'
), pedro as (
  select id from people where circle_id = (select id from c) and name = 'Pedro'
), cleared as (
  delete from medication_logs where circle_id = (select id from c) returning 1
), cleared_meds as (
  delete from medications where circle_id = (select id from c) returning 1
), meds as (
  insert into medications (circle_id, name, dose, times, created_by_person_id)
  select c.id, v.name, v.dose, v.times, pedro.id
  from c, pedro, (values
    ('Blood pressure pill', '1 pill', array['08:00']),
    ('Memory pill', '1 pill', array[to_char(now() at time zone 'Europe/Madrid', 'HH24:MI')])
  ) v(name, dose, times)
  returning id, name
), log as (
  -- Blood pressure pill already taken this morning at 08:04 Madrid time.
  insert into medication_logs (circle_id, medication_id, scheduled_for, status, answered_at)
  select c.id, meds.id,
         (current_date + time '08:00') at time zone 'Europe/Madrid',
         'taken',
         (current_date + time '08:04') at time zone 'Europe/Madrid'
  from c, meds where meds.name = 'Blood pressure pill'
  returning 1
)
select (select count(*) from meds) as medicines, (select count(*) from log) as logs;
