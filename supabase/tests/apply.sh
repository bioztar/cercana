#!/usr/bin/env bash
# Applies schema.sql (fresh database only) and the migrations (filename order) to the LOCAL
# `supabase start` database, the same way helm applies them to the project. Migrations are
# idempotent, so running this on a database that already has them is fine.
#
# Usage: supabase/tests/apply.sh                 # everything
#        UNTIL=20260928 supabase/tests/apply.sh  # only migrations whose file name sorts before UNTIL
#        FROM=20260928 supabase/tests/apply.sh   # only migrations from FROM on (schema.sql never re-run)
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL=(docker exec -i supabase_db_cercana psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
if [[ -n "${DATABASE_URL:-}" ]]; then PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q); fi

if [[ -z "${FROM:-}" && "$("${PSQL[@]}" -At -c "select to_regclass('public.circles') is null")" == "t" ]]; then
  echo "-- schema.sql"
  "${PSQL[@]}" < schema.sql
fi
for f in migrations/*.sql; do
  name=$(basename "$f")
  if [[ -n "${UNTIL:-}" && ! "$name" < "$UNTIL" ]]; then continue; fi
  if [[ -n "${FROM:-}" && "$name" < "$FROM" ]]; then continue; fi
  echo "-- $f"
  "${PSQL[@]}" < "$f"
done
echo "applied"
