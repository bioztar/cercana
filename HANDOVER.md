# HANDOVER — cercana — 2026-09-26 07:05
## State: AI features live on cercana.pro7ocol.com + Supabase (main 0c97de0): real assistant, dictated events, server transcription, 1:1 chats, Who is this? / Read this for me, doctor-visit capture, evening digest + distress alerts.
## Done this session (PRs #42–#49)
- `_shared/ai.ts`: chat() via thalamus (key alias `cercana`, nebius/* only, rpm 60) → Nebius Kimi-K3; transcribe() via Deepgram nova-3.
- Edge fns (all deployed from main): assistant, transcribe, see, visit (anon-callable, per-circle 300/day cap in `_shared/aiGuard.ts`, media-bucket URLs only), digest + distress-alert (DB-only: `x-cron-secret`).
- Migrations applied live: 20260926_01 ai_log, 02 messages, 04 visits, 05 digest (pg_cron hourly, fires 20:00 circle-local), 06 ai_log lockdown, 07 cron secret. (03 intentionally absent.)
- Secrets: Supabase fn secrets THALAMUS_API_KEY, THALAMUS_BASE_URL, DEEPGRAM_API_KEY, CRON_SECRET; Vault cercana_functions_url, cercana_service_key, cercana_cron_secret. Never commit values.
- Live-validated: assistant (EN/ES dates, family, distress), transcribe, visit (meds/follow-up proposals), digest via pg_net, see eval 24 checks / 0 wrong names, letter scam vs normal. Test rows deleted; eval photos kept at media/helm-test/eval/.
## Next steps (ordered)
1. Vitaly: try on phone — ?demo=patient / ?demo=family, then the real circle.
2. devices has no person link → distress/letter alerts go to ALL family devices, not only the lead. Add devices.person_id.
3. Events have no note column; notes are folded into the title "Title (note)".
4. Real auth + RLS (everything is still anon-wide demo policies apart from ai_log/visits/messages/digests).
5. Native iOS build to test mic + camera on device.
## Key files
- supabase/functions/_shared/{ai,aiGuard,assistantCore,see,visit,digestMetrics}.ts — AI logic (pure parts tested from src/lib/*.test.ts)
- src/screens/{AssistantChat,SeeHelper,Chat*,Visit*}.tsx, src/components/DigestCard.tsx
