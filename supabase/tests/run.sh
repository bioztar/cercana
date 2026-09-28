#!/usr/bin/env bash
# Database tests against the LOCAL stack only (`supabase start` must be running; never the project):
#   1. fresh database, schema.sql + all migrations up to the lockdown, as the live project has them
#   2. pre-lockdown seed (public media URLs)
#   3. the two lockdown migrations, twice (idempotent)
#   4. pgTAP: anon writes refused, reads kept, legacy media converted
# Then, with `--functions`, the edge-function flow tests (supabase/tests/flows.test.ts) against
# `supabase functions serve`.
set -euo pipefail
cd "$(dirname "$0")/.."
T=tests

supabase db reset --local >/dev/null
UNTIL=20260928 $T/apply.sh
docker exec -i supabase_db_cercana psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < $T/seed_legacy.sql
FROM=20260928 $T/apply.sh
FROM=20260928 $T/apply.sh
supabase test db --local $T/pgtap

if [[ "${1:-}" == "--functions" ]]; then
  $T/functions.sh
fi
