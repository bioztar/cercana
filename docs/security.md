# Security model

Cercana has **no login**. Every phone talks to Supabase with the public anon key, and the database
cannot tell one phone from another. This page says what that means after the RLS lockdown
(`supabase/migrations/20260928_01_lockdown_groundwork.sql` + `20260928_02_rls_lockdown.sql`),
what still relies on it, and how to apply it.

## Identity: the circle code

- A circle is created with a random 6-character code (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, ~30 bits).
  The code is the circle's **credential**: it lives only in the device-local session
  (`cercana.session.v1`), is shared through the invite link / spoken to family, and is **never
  readable with the anon key** (column privilege on `circles.code`).
- A family phone also holds the id of the `people` row it claimed (`session.memberId`). A patient
  phone has no row; it sends `role: 'patient'`.
- Every write that matters is an edge function call with `{circle_id, code, member_id?}`
  (`supabase/functions/_shared/circleAuth.ts`). The function runs as service role, checks the code
  in constant time (wrong code = unknown circle, 404, throttled per IP), and applies the same role
  rules as `src/lib/permissions.ts` (lead / admin / member, own profile).

Limits of this model, to be clear about:

- Anyone who has the code (family, anyone they forward the link to) can act as any claimed member
  of that circle: `member_id` is claimed, not proven. Roles protect against mistakes, not against a
  malicious family member.
- The anon key can still **read** the tables the app reads across all circles (people, moments,
  comments, messages, events, ...). Per-circle read isolation needs a real per-device token; that
  is the next step, not this one.
- Realtime delivers every `pings` row to any subscriber; only the writer side is locked.

## What the anon key can do

| Table / bucket | anon SELECT | anon writes | Writes go through |
| --- | --- | --- | --- |
| `pings` | yes (realtime, spoken aloud on the patient phone) | none | `ping` — needs the code, family only, 5/min and 100/day per circle |
| `people` | yes | none | `people` — join / claim / unclaim / create / update / delete / set_role / transfer_lead |
| `circles` | `id, patient_name, created_at, brief_*` — never `code` | `brief_time, brief_enabled` only | `circle` — create (5/IP/hour, 100/day), lookup by code (20/IP/min), register_device |
| `devices` (push tokens) | none | none | `circle` register_device |
| `media` bucket | none (private) | none | `media` — upload ticket (`uploadToSignedUrl`), signed read URLs (1 h), 300 uploads/circle/hour |
| `rate_limits` | none | none | `rate_limit_hit()` — service role only |
| `moments`, `comments`, `messages`, `checkins`, `visits`, `events`, `medications`, ... | yes | yes (unchanged, `demo_all`) | direct — next lockdown |

Media objects live under `<circle_id>/<photo|audio>/<file>`; rows store that **path**, never a
URL. The client resolves paths to signed URLs on render (`src/lib/mediaUrl.ts`, batched and
cached) and the AI functions sign them server-side (`signedMediaUrl`). Objects uploaded before the
lockdown (`photo/...`, `audio/...`) are recorded in `legacy_media` with the circle whose row
referenced them; `media_path_in_circle(circle, path)` accepts a circle's own prefix or its legacy
objects, nothing else.

AI functions (`assistant`, `see`, `transcribe`, `visit`) require the code too. Caps are reserved
atomically per UTC day: 300 calls per circle and 1500 for all circles together
(`AI_GLOBAL_DAILY_CAP` secret to change), so minting circles no longer buys more calls — and
minting is throttled anyway.

## Apply order (helm)

The lockdown is two migrations so that nothing breaks in between: `_01` only adds what the new
functions and client need (old clients keep working), `_02` revokes the direct writes.

1. **Groundwork** — `supabase/migrations/20260928_01_lockdown_groundwork.sql` in the SQL editor
   (or `supabase db push`): `rate_limits` + `rate_limit_hit()`, `legacy_media` +
   `media_path_in_circle()`. Additive, idempotent.
2. **Functions** — `supabase functions deploy circle people ping media assistant see transcribe visit`
   (no `--no-verify-jwt`: the client sends the anon JWT as before). The AI functions now require
   the circle code, so AI features of app builds older than step 3 / 5 fail until updated
   (everything else in an old build keeps working until step 4). Optional:
   `supabase secrets set AI_GLOBAL_DAILY_CAP=...` (default 1500/day).
3. **Web** — redeploy the site from `main`. From here new clients call the functions and store
   media paths; old clients still write directly, and their public URLs still work.
4. **Lockdown** — `supabase/migrations/20260928_02_rls_lockdown.sql`. Idempotent. Drops the
   `demo_all` policies of pings / people / circles / devices and the storage policies, flips the
   `media` bucket to private and rewrites the public media URLs already stored into paths
   (recorded in `legacy_media`). Direct writes from old app builds fail from now on with
   "permission denied"; the web app is the fallback until they update.
5. **iOS** — new EAS build.

Rollback of step 4 is not provided on purpose (it would re-open the writes). To pause between 3
and 4 is fine for as long as needed.

`supabase/schema.sql` describes the same end state for a fresh project (schema.sql, then every
migration in order — see `supabase/tests/apply.sh`).

## Tests

- `supabase/tests/pgtap/rls_lockdown.test.sql` — pgTAP against the local stack, after a
  pre-lockdown seed (`seed_legacy.sql`) and both migrations applied twice: anon INSERT /
  UPDATE / DELETE on `pings`, `people`, `circles`, `devices` refused, reads kept, legacy media
  converted, bucket private, rate limiter counts.
- `supabase/tests/flows.test.ts` — the app's flows through the functions with the anon key:
  create circle, send ping, edit contact, join, roles, upload + read a photo through signed URLs,
  and the direct writes they replaced being refused.
- Run everything locally: `supabase start && supabase/tests/run.sh --functions`. CI does the same
  (`.github/workflows/ci.yml`). Nothing here touches the live project.
