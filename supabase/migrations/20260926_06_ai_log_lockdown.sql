-- ai_log is written and read only by edge functions (service role, which bypasses RLS).
-- The anon key is public: letting it delete rows would reset the per-circle AI cap, and
-- letting it insert distress rows would fire real alerts to any family. No client access.
drop policy if exists "demo_all" on ai_log;
revoke all on ai_log from anon, authenticated;
