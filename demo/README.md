# demo/ — "Maria's family" (code ABUELA)

A complete **fictional** family for demos. Faces, photos and voices are AI-generated
(Picsart: flux-2-pro images, eleven-multilingual-v2 voices). No real people.

| Person | Relation | Role | Notes |
|---|---|---|---|
| Maria | the patient | — | 79, Barcelona |
| Anna | daughter | lead | "In London" until Sunday (anna.ics) |
| Pedro | son | admin | Sunday lunch with the cake (family.ics) |
| Carmen | sister | member | geraniums in Valencia |
| Lucia | granddaughter | member | birthday 25 Sep — turns 16 |
| Diego | grandson | member | 9, made a drawing |
| Rosa | carer | admin | weekday visits 09:00–13:00 (family.ics) |

## Re-seed

1. Upload `assets/*` to the Supabase storage bucket `media` under `demo/` (public).
2. Run `seed-abuela.sql` (it deletes and recreates circle `ABUELA`).
3. Call the `sync-calendars` edge function once, or wait for the 30-minute schedule.

The seed points at the live project's public storage URLs; change the host if you re-seed elsewhere.
Phone numbers are deliberately empty — add real ones (with consent) so WhatsApp calls ring a real phone.
Lucia's birthday is fixed at 25 September; for a demo on another day, update her `birthday`.
