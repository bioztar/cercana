-- The events insert/update/delete policies (20260924_01) check `calendars.source`, but anon could only
-- read `calendars.id` (ics_url stays secret), so every client write failed with
-- "permission denied for table calendars" — connecting an iPhone calendar saved no events.
-- `source` is not secret; ics_url remains unreadable.
grant select (source) on calendars to anon, authenticated;
