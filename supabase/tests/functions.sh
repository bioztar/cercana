#!/usr/bin/env bash
# Edge-function flow tests against the LOCAL stack: starts `supabase functions serve`, runs
# supabase/tests/flows.test.ts with Deno, stops the server. Needs the database prepared by run.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

# Local dev keys only (`supabase status`), passed through the environment, never printed.
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY)=')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY"

supabase functions serve --no-verify-jwt >/tmp/functions-serve.log 2>&1 &
SERVE=$!
trap 'kill $SERVE 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$SUPABASE_URL/functions/v1/ping" || true)
  [[ "$code" == "200" ]] && break
  sleep 1
done
[[ "$code" == "200" ]] || { echo "functions did not start"; tail -50 /tmp/functions-serve.log; exit 1; }

deno task test
