# demo/ — "Carmen's family" (code ABUELA)

A complete **fictional** family for demos. Faces, photos and voices are AI-generated
(Picsart: flux-2-pro images, eleven-multilingual-v2 voices). No real people.

| Person | Relation to Carmen | Role | Notes |
|---|---|---|---|
| Carmen | the patient | — | 79, Barcelona (`carmen.jpg`) |
| Pedro | son | lead | Sunday lunch with the cake (family-v2.ics), the park walk |
| Anna | daughter-in-law (Pedro's wife) | admin | "In London" until Sunday (anna.ics) |
| Diego | grandson (Pedro and Anna's son) | member | birthday 25 Sep — turns 10, made a drawing |

Unused assets from the earlier cast (`lucia.jpg`, `rosa.jpg`, `m_exam.jpg`, `m_garden.jpg`, `v_carmen.mp3`) stay in
the bucket for other demos.

## Re-seed

1. Upload `assets/*` to the Supabase storage bucket `media` under `demo/` (public).
2. Run `seed-abuela.sql` (it deletes and recreates circle `ABUELA`).
3. Call the `sync-calendars` edge function once, or wait for the 30-minute schedule.

The seed points at the live project's public storage URLs; change the host if you re-seed elsewhere.
Phone numbers are deliberately empty — add real ones (with consent) so WhatsApp calls ring a real phone.
Diego's birthday is fixed at 25 September; for a demo on another day, update his `birthday`.
