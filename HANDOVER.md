# HANDOVER — cercana (branch cercana-mvp) — 2026-09-24 14:50
## State: MVP feature-complete on the branch (patient app, family mode, calendars, invite/roles, family feed, demo mode); web is live from an earlier merge, later commits await helm's merge + redeploy.
## Done this session
- Patient home (faces, birthday banner, spoken briefing, "Hear today", press-and-hold Settings), person card (WhatsApp/phone, Coming up, Lately slice), ping overlay with speech.
- Family mode: People (roles, badges, edit/add/remove by permission), Calendars (ICS feeds, ics_url write-only), Moments (photo/voice, delete for staff), Ping, Share invite.
- Invite link `/join/<CODE>` + claim profile; roles lead/admin/member in `src/lib/permissions.ts`; Family Feed.
- Supabase: schema.sql (idempotent), edge functions `ping`, `sync-calendars` (both deployed by helm).
- Demo mode: `?demo=patient|family|join` at runtime in any web build (+ `&as=`, `&person=`), `EXPO_PUBLIC_DEMO=1` at build time.
- 47 unit tests (`npm test`); live smoke scripts vs Supabase passed (kept in the session scratchpad, not committed).
## In flight / partially done
- Nothing half-done. Not verified: audible TTS, iOS push (needs EAS projectId), real iPhone run.
## Next steps (ordered)
1. helm: merge cercana-cercana-mvp, redeploy web (schema + functions already live).
2. Run on a real iPhone (`eas build --profile development`), add `extra.eas.projectId` to app.json for push.
3. Real auth + RLS (reuse `can(actor, action)`), then drop the anon-wide demo policies.
4. Andrey's mockups land in `design/`; restyle after.
## Blockers / needs human
- Lead profile is claimable by anyone holding the code until the lead claims it (no auth this week).
- iOS needs an Apple developer account + EAS project for device builds and push.
## Key files touched
- src/lib/permissions.ts — every permission decision
- src/lib/api.ts / api.real.ts / demo.ts — data access, real vs fixtures behind one switch
- src/lib/briefing.ts, dates.ts, feed.ts, util.ts — pure, tested logic
- supabase/schema.sql, supabase/functions/* — backend
- App.tsx — role/route state, invite routing
