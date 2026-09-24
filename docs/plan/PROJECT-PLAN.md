# Cercana — plan to a demoable MVP

Status as of Thursday 24 September 2026, 13:40 · Live: https://cercana.pro7ocol.com · Repo: https://github.com/bioztar/cercana
Full formatted version: `docs/plan/project-plan.html`

## What "demo-ready" means

Vitaly picks up his iPhone with Cercana installed, puts a laptop next to it, and in three minutes shows:

1. The phone **speaks the morning briefing**: "Good morning Maria… Anna is in London until Sunday. Tomorrow is Lucia's birthday."
2. Tap Anna's face → **WhatsApp call**.
3. On the laptop, a family member **posts a voice note with a photo** → it appears in "From your family" on the phone.
4. The family member taps **Ping** → the iPhone notifies, then **says aloud** "Anna says: thinking of you".
5. A trip added to Anna's **Google/iCloud calendar** shows up on her card.
6. A new relative opens the **invite link**, picks "I'm Pedro", and is in.

Web does all of this today except the native push in step 4. **The iPhone app is the main gap.**

## Where we are

| Phase | Progress |
|---|---|
| 1 · Scope & foundation | ✅ done |
| 2 · Core app live on web | ✅ done |
| 3 · Demo polish | 2 / 6 |
| 4 · iPhone app on a device | 0 / 7 — **critical path** |
| 5 · Design pass (Andrey) | started |
| 6 · Demo day | 0 / 3 |

## Done so far

- Scoped over 5 rounds of questions; name checked against the App Store.
- One codebase → iPhone app + web (Expo SDK 57). Public repo, `main` protected (PR-only).
- **Patient side:** big faces, spoken greeting + morning briefing, birthday banner, person card (WhatsApp / phone / "Tell me about"), "Coming up", "From your family" feed, ping overlay that speaks.
- **Family side:** people + photos, moments (text / photo / voice), ping, calendars, share invite.
- **Invite link** `/join/<code>` + "Which one are you?"; **roles** lead → admins → members.
- **Calendar feeds** (Google / iCloud / Outlook) linked to several people; secret links unreadable by the app.
- Backend on Supabase (Paris): realtime pings, calendar sync every 30 min. Live smoke tests 21/21 + 15/15; 48/48 unit tests.
- Web live over HTTPS. Demo: https://cercana.pro7ocol.com/?demo=patient · https://cercana.pro7ocol.com/?demo=family · https://cercana.pro7ocol.com/?demo=join

## What's left — build plan

Owners: **Vitaly**, **Andrey**, **helm** (orchestrator), **crewmate** (coding agent). Time estimates are rough.

### Phase 3 — Demo polish (today)

| # | Step | Owner | Est. | Needs | Status |
|---|---|---|---|---|---|
| 3.1 | Fix-ups: demo join link, Demo ribbon overlap, "Maria's son" wording | crewmate | 30 m | — | ✅ done · PR #2 |
| 3.2 | Merge, redeploy, check live | helm | 15 m | 3.1 | ✅ done · live `046a095` |
| 3.3 | Confirm the 30-min calendar sync fires | helm | 5 m | — | ⏳ queued |
| 3.4 | **Demo family content**: 5 people, consent-safe faces, relations, numbers, a birthday tomorrow, one trip, 3–4 moments with photos | **Andrey** | 45 m | — | to do |
| 3.5 | Load it into the live app as "Maria's family" | helm | 15 m | 3.4 | to do |
| 3.6 | Three-minute demo script (helm drafts, Vitaly edits) | helm → Vitaly | 20 m | — | to do |

### Phase 4 — iPhone app on a real device (critical path)

| # | Step | Owner | Est. | Needs | Status |
|---|---|---|---|---|---|
| 4.1 | Free Expo account at expo.dev → send username | **Vitaly** | 5 m | — | 🔴 waiting on Vitaly |
| 4.2 | Link project to Expo (`eas init`), bundle id `com.pro7ocol.cercana`, push setup | helm | 20 m | 4.1 | to do |
| 4.3 | Apple sign-in + 2FA when EAS asks | **Vitaly** | 10 m | 4.2 | to do |
| 4.4 | App icon (1024 px) + splash screen | **Andrey** | 30–60 m | — | to do |
| 4.5 | Build the iPhone app (EAS, TestFlight / internal) | crewmate | 45 m incl. queue | 4.3 (4.4 nice to have) | to do |
| 4.6 | Install on Vitaly's iPhone; test ping → notification → speech, voice notes, WhatsApp, briefing audio | **Vitaly** + helm | 30 m | 4.5 | to do |
| 4.7 | Fix what the device test finds | crewmate | ~1 h buffer | 4.6 | to do |

### Phase 5 — Design pass

| # | Step | Owner | Est. | Needs | Status |
|---|---|---|---|---|---|
| 5.1 | Mockups in order: patient home + feed → person card → ping overlay → join → family People & roles. Phone 390 px first. PR into `design/` | **Andrey** | his pace | — | started |
| 5.2 | Restyle the app to the mockups | crewmate | 1.5–2 h | 5.1 | to do |
| 5.3 | Readability check: large text, contrast, one-hand tapping | helm + Andrey | 30 m | 5.2 | to do |

### Phase 6 — Demo day

| # | Step | Owner | Est. | Needs | Status |
|---|---|---|---|---|---|
| 6.1 | Rehearse: iPhone as Maria, laptop as Anna, run the script twice | **Vitaly** (+ Andrey) | 30 m | 3.5, 3.6, 4.7 | to do |
| 6.2 | Record a 2-minute walkthrough video | **Vitaly** | 30 m | 6.1 | to do |
| 6.3 | First real family member uses it | **Vitaly** | after demo | 6.1 | later |

## What blocks what

- **Critical path:** Vitaly's Expo account (4.1) → eas init (4.2) → Apple 2FA (4.3) → iPhone build (4.5) → device test (4.6) → fixes (4.7) → rehearse (6.1) → video (6.2). About 3 hours of work once the account exists.
- **In parallel, nobody waiting:** Andrey on demo content (3.4), icon (4.4) and mockups (5.1) · helm on demo script (3.6) and sync check (3.3).
- **Design pass is not on the critical path.** The demo works in the current look; if the patient-home mockup lands before rehearsal we restyle, otherwise we demo as is.

## Who does what

**Vitaly**
1. **Now:** Expo account at expo.dev → send the username (5 m)
2. Apple sign-in + 2FA when the build asks (10 m)
3. Install on your iPhone and run the device test with helm (30 m)
4. Edit the demo script (10 m)
5. Rehearse, then record the video (1 h)
6. Forward the repo rules (`CLAUDE.md`) to Andrey
7. Keep or delete the unused Supabase project "bioztar's Project"

**Andrey**
1. **First:** demo family content — faces we're allowed to use (generated or licensed stock), names, relations, 3–4 moments with photos (45 m)
2. App icon 1024 px + splash screen (30–60 m)
3. Mockups in the 5.1 order, PR into `design/`
4. Readability check after the restyle

Content and icon come first because both unblock the demo; the mockups can keep going in parallel without holding anything up.

## Honest limits of the demo

- **No real login yet.** Anyone with the invite code can join; roles are enforced in the app only. Real sign-in comes before any stranger uses it.
- **The phone can't talk from the lock screen.** iOS shows the notification; the voice plays once it's tapped open.
- **No call recording, no always-on microphone.** iOS doesn't allow either; family-written moments and one-tap voice notes replace them.
- **Google calendar changes can take hours to show up.** iCloud updates faster.
- **Web gets no push when the tab is closed.** Push works in the iPhone app.

## After the demo (v2, not scheduled)

| Item | Why | Rough size |
|---|---|---|
| Real sign-in (email link) + database-enforced roles | Before any family outside ours; reuses the permissions module | ~3 h |
| Chats + voice replies from the patient | From Andrey's concept doc | 1–2 days |
| Invite link opens the installed app (universal links) | Today it opens web | ~1 h |
| Privacy policy, GDPR consent, support email `cercana@pro7ocol.com` | App Store + care homes | ~half day |
| App Store submission | Public availability | ~1 day incl. review |
| "Left home" safety ping (geofence) | Strongest real-world safety feature | ~half day |
