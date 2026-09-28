# Cercana

> **No login, limited privacy.** The 6-character circle code is the circle's credential: writes
> to people, pings, circles, push tokens and the private `media` bucket go through edge functions
> that check it, and the code itself is never readable with the anon key. Everything else the app
> reads is still readable by anyone with the anon key. Details, limits and the apply order:
> [docs/security.md](docs/security.md).

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

## Invite, roles and the family feed

**Invite link.** `https://cercana.pro7ocol.com/join/<CODE>` (base URL is `DEFAULT_APP_URL` in `src/lib/util.ts`; on
native the deep link is `cercana://join/<CODE>`, or type the code after choosing "I'm family").
The invite screen shows the patient's name and *"Which one are you?"*: pick an unclaimed profile,
or "I'm not on the list" to add yourself (name, relation, phone, photo). Claiming stores the profile
id on the device. No password, no email. "Share invite" uses the OS share sheet (native),
`navigator.share` or clipboard (web). Leaving the circle frees the profile again.

**Roles** (`src/lib/permissions.ts`, the one place every check lives, unit-tested):

| | lead (exactly one) | admin | member | patient phone |
|---|---|---|---|---|
| edit own profile | yes | yes | yes | no |
| edit any profile, add people, invite, refresh calendars, delete moments | yes | yes | no | no |
| calendars | any | any | only ones linked to themselves | no |
| post moments and pings | yes | yes | yes | no |
| make/unmake admins, hand over lead, remove people | yes | no | no | no |

The person who sets the circle up (on the patient's phone, "This phone is for …") becomes the lead.
A profile nobody claimed (grandkid, nurse) is just a profile. The `people` and `ping` edge functions
enforce the same table server-side for profiles and pings, keyed on the circle code the device
holds (see [docs/security.md](docs/security.md)); moments and reads are still open to anyone with
the anon key.

**Family feed.** The patient home shows "From your family": every moment, newest first, with the
author's face, name and relation; tap the author for their card. A person's card shows the same
feed filtered to moments by or about them.

## Run

```bash
npm install
cp .env.example .env        # fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start              # press i (iOS simulator / Expo Go / dev build) or w (web)
```

Without those two settings the app shows a full-screen message naming the missing one.

**Demo mode (no backend needed):** on the web, open `/?demo=patient`, `/?demo=patient&person=anna`,
`/?demo=family` (add `&as=pedro|carmen|lucia` to see another role), or `/?demo=join` in **any** build, including production. Data is in-memory sample fixtures, a
"Demo — sample family" ribbon is shown, sending a ping fires the patient overlay locally, and demo
never reads or writes the visitor's real session. `EXPO_PUBLIC_DEMO=1` at build time turns the
same mode on for the whole build (offline demos, screenshots).

Checks: `npm test` (dates, briefing, ICS expansion, helpers), `npm run typecheck`,
`npx expo export -p web`.

## Backend (Supabase)

1. Run `supabase/schema.sql` (idempotent) in the SQL editor, then every file in
   `supabase/migrations/` in filename order (each idempotent): tables, RLS, realtime, the private
   `media` bucket, the `calendars_public` view, rate limits.
2. Deploy the edge functions: `supabase functions deploy` (all of them: `circle`, `people`, `ping`,
   `media`, `assistant`, `see`, `transcribe`, `visit`, `sync-calendars`, `digest`, `distress-alert`).
   Supabase injects the service-role key; it never appears in the client or the repo.
3. Optional: the commented `pg_cron` block at the end of `schema.sql` syncs calendars every 30 minutes.

Local stack for the database and function tests: `supabase start`, then
`supabase/tests/run.sh --functions` (pgTAP + Deno; see [docs/security.md](docs/security.md#tests)).
Nothing in the repo talks to the live project.

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
src/components/MediaImage.tsx, src/lib/mediaUrl.ts   stored media paths → signed URLs
supabase/schema.sql          tables, RLS, realtime, storage (fresh project); then supabase/migrations/
supabase/functions/          circle, people, ping, media (writes + signed URLs), AI functions,
                             sync-calendars, _shared/circleAuth.ts (circle-code check)
supabase/tests/              pgTAP + function flow tests against `supabase start`
docs/security.md             identity model, what anon can do, apply order
```
