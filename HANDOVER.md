# HANDOVER — cercana (branch cercana-ai-core) — 2026-09-26
## State: AI core built and committed locally (mission local-only); needs helm to merge, apply migration, deploy 2 functions, validate live.
## Done this session
- Migration `supabase/migrations/20260926_01_ai_log.sql` (demo RLS). Not appended to schema.sql: migrations 04–07 never were either.
- Edge fns `assistant` (chat + dictate) and `transcribe`; pure logic in `supabase/functions/_shared/assistantCore.ts` (EN/ES dates, tz, distress, validation, prompt, output shaping; tests in `src/lib/assistantCore.test.ts`); cap + logging in `_shared/aiGuard.ts` (300 ai_log rows/circle/UTC day; transcribe only accepts our `media` bucket URLs).
- App: AssistantChat real replies + Yes saves event (created_by null = Carmen); EventVoice → `assistant` dictate → EventConfirm prefilled (exact time kept unless day changed); family "🎤 Dictate an event" (Calendar tab + ☰ menu); "Doctor" relation chip in PersonForm; VoiceRecorder server-transcribes when on-device transcript is empty (pass `circleId`).
- Demo mode: offline stand-in in `demo.ts` (script + same pure date rules), no network.
- Screenshots in `docs/screenshots/ai-*.png`.
## In flight / partially done
- none
## Next steps (ordered)
1. helm: merge, apply migration, `supabase functions deploy assistant transcribe`.
2. Validate live: chat "dentist Tuesday at 11" → Yes → event visible to family; dictate a cardiology sentence; record on iPhone → transcript non-empty; "where am I" → ai_log row with distress=true.
## Blockers / needs human
- Live model behaviour (thalamus/Kimi-K3 JSON output) untested here: no keys in worktree by design.
- `events` has no note column: dictated note is folded into the title "Title (note)".
## Key files touched
- supabase/functions/{assistant,transcribe,_shared/assistantCore.ts,_shared/aiGuard.ts}
- src/screens/{AssistantChat,EventVoice,EventConfirm,FamilyHome,PersonForm}.tsx, App.tsx (eventVoice/eventConfirm routes now serve family too)
- src/lib/{api,api.real,demo,types,voice}.ts
