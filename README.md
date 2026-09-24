# Cercana

> **Demo-only: no privacy.** There is no login. Anyone with the Supabase anon key can read and
> change everything in the database and the `media` bucket. The 6-character circle code is not a
> security boundary. **Do not put real personal data in a demo deployment.** The single exception
> is calendar feed addresses: a secret ICS URL is write-only from clients (never selectable by
> the anon key), see [Calendars](#calendars).

Cercana helps a person living with memory loss stay close to the people they love.
One Expo codebase runs as an **iOS app** and a **web app**.

**The patient's phone** shows close people as big faces. Tap one to call them on WhatsApp, hear
what they last talked about, see what is coming up in their calendar, and hear a spoken morning
briefing (today's events and the next birthday). Family pings arrive as a full-screen message
that is read aloud.

**Family** (phone or desktop browser) add people and photos, post moments (text, photo, voice
note), attach calendars, and send pings.

First launch asks *"Who is using this phone?"*: **"This phone is for [name]"** creates a circle and
shows a join code; **"I'm family"** joins with that code.

## Run

```bash
npm install
cp .env.example .env        # fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start              # press i (iOS simulator / Expo Go / dev build) or w (web)
```

Without those two settings the app shows a full-screen message naming the missing one.

**Demo mode (no backend):** `EXPO_PUBLIC_DEMO=1 npx expo start --web`, then open
`/?demo=patient`, `/?demo=patient&person=anna` or `/?demo=family`. Data is in-memory fixtures;
sending a ping fires the patient overlay locally. It is a build-time flag; never set it on a real deployment.

Checks: `npm test` (dates, briefing, ICS expansion, helpers), `npm run typecheck`,
`npx expo export -p web`.

## Backend (Supabase)

1. Run `supabase/schema.sql` (idempotent) in the SQL editor: tables, demo RLS, realtime, the
   `media` bucket, the `calendars_public` view.
2. Deploy the edge functions: `supabase functions deploy ping` and
   `supabase functions deploy sync-calendars`. Supabase injects the service-role key; it never
   appears in the client or the repo.
3. Optional: the commented `pg_cron` block at the end of `schema.sql` syncs calendars every 30 minutes.

## Deploy the web app

```bash
docker build \
  --build-arg EXPO_PUBLIC_SUPABASE_URL=... \
  --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=... \
  -t cercana-web .
docker run -p 8080:80 cercana-web
```

Multi-stage: node builds `expo export -p web`, `nginx:alpine` serves `dist/` with SPA fallback.

## iOS

Bundle id `com.pro7ocol.cercana`. Build with EAS (`npx eas-cli@latest build -p ios`).
Push notifications need an EAS project: add `extra.eas.projectId` to `app.json`; until then the
app skips push registration (and logs once). Realtime pings and local birthday reminders still work.

## Calendars

Family attach published ICS feeds (Google "Secret address in iCal format", iCloud public
calendar, Outlook published calendar) and tick which people each calendar belongs to. The
`sync-calendars` function fetches them server-side (browsers cannot: no CORS), expands recurring
events for yesterday .. +60 days, and stores them as `events`. Events show on each linked
person's card under **Coming up**, and feed the spoken morning briefing.

The ICS URL is insertable but **never selectable** by clients (column privileges + the
`calendars_public` view). After saving, only a non-secret hint (`…/basic.ics` or the host) is
shown. Delete and re-add to change a URL.

## Behaviour notes

- WhatsApp: `https://wa.me/<digits>` opens the chat; the call is one tap inside WhatsApp.
- Speech: browsers may block automatic speech until the page has been tapped once; the
  **Hear today** button always works.
- Web notifications appear only while the tab is open but hidden (no web push).
- Out of scope: call recording, background microphone, geofencing.

## Layout

```
App.tsx                      state navigation (no router)
src/lib/                     dates, briefing, helpers, api (real vs demo), notify, speech
src/screens/                 Welcome, PatientHome, PersonScreen, PingOverlay, FamilyHome + tabs
supabase/schema.sql          tables, RLS, realtime, storage
supabase/functions/          ping, sync-calendars, _shared/ics.ts (pure, unit-tested)
```
