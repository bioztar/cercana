// Face-match honesty eval for the `see` "who" mode. NOT shipped in the app; run by hand:
//   THALAMUS_API_KEY=... THALAMUS_BASE_URL=... node scripts/see-eval.ts cast.json
// cast.json: { "members": [{id,name,relation,photo_url}], "trials": [{ "image_url": "...", "expect": "<member id>" | null }] }
// `expect: null` = a non-member (or unclear photo) that must be declined. Trial photos must differ from the reference photos.
// A WRONG NAME is the failure that matters: exit code 1 if wrong > 0.
import { readFileSync } from 'node:fs';

(globalThis as any).Deno = { env: { get: (k: string) => process.env[k] } }; // _shared/ai.ts reads settings via Deno.env
const { chat } = await import('../supabase/functions/_shared/ai.ts');
const { whoMessages, parseWho } = await import('../supabase/functions/_shared/see.ts');

const cast = JSON.parse(readFileSync(process.argv[2] ?? 'cast.json', 'utf8'));
const tally = { correct: 0, wrong: 0, declined: 0 };
for (const t of cast.trials) {
  const match = parseWho(await chat(whoMessages(t.image_url, cast.members), { json: true, maxTokens: 200 }), cast.members);
  const got = match?.id ?? null;
  const verdict = got === null ? 'declined' : got === t.expect ? 'correct' : 'wrong';
  // A decline of a real member is safe (counted as declined); naming a non-member or the wrong member is "wrong".
  tally[verdict === 'declined' && t.expect === null ? 'correct' : verdict] += 1;
  console.log(`${verdict.padEnd(9)} expect=${t.expect ?? 'nobody'} got=${got ?? 'nobody'} ${t.image_url}`);
}
console.log(JSON.stringify(tally));
process.exit(tally.wrong > 0 ? 1 : 0);
