-- "For you" vs "Family" calendar sections (Vitaly, 2026-09-24 15:50). Idempotent.
-- `calendars.includes_patient` is the default a new event on that calendar inherits (set by the
-- ICS sync function and the device-calendar sync when they insert events — helm wires those up);
-- `events.includes_patient` can then be overridden per event from the "<patient> takes part" toggle
-- (app/device events only — ICS events keep the calendar's default, they're not client-writable).
alter table calendars add column if not exists includes_patient boolean not null default false;
alter table events add column if not exists includes_patient boolean not null default false;
