// Shared plumbing for AI edge functions: CORS, JSON replies, service-role client, daily caps, ai_log writes,
// signed URLs for private media. The anon key is public, so every AI function is internet-facing:
// check the circle code (circleAuth.ts), cap and validate before spending tokens.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { CAPS } from './assistantCore.ts';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** All circles together, per UTC day. Overridable per project with the AI_GLOBAL_DAILY_CAP secret. */
export const GLOBAL_DAILY_CALLS = Number(Deno.env.get('AI_GLOBAL_DAILY_CAP')) || 1500;

const utcDay = () => new Date().toISOString().slice(0, 10);

/** One atomic counter step in `rate_limits` (rate_limit_hit is service-role only); true = still within the limit. */
async function take(db: SupabaseClient, key: string, limit: number): Promise<boolean> {
  const res = await db.rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window: '1 day' });
  if (res.error) throw new Error(`rate_limit_hit failed: ${res.error.message}`);
  return res.data === true;
}

/**
 * Reserves one AI call for today (UTC) against the circle's cap AND the project-wide cap; true when either
 * is exhausted. Reserving (rather than counting ai_log afterwards) keeps concurrent requests from all
 * slipping under the limit together, and minting extra circles cannot lift the global one.
 */
export async function overDailyCap(db: SupabaseClient, circleId: string): Promise<boolean> {
  const day = utcDay();
  const [circleOk, allOk] = await Promise.all([
    take(db, `ai:circle:${circleId}:${day}`, CAPS.dailyCalls),
    take(db, `ai:all:${day}`, GLOBAL_DAILY_CALLS),
  ]);
  return !circleOk || !allOk;
}

export const MEDIA_TTL_SECONDS = 10 * 60;

/**
 * A short-lived signed URL for an object of the private `media` bucket, or null unless `path` belongs
 * to the circle (own prefix or a migrated legacy object). AI backends fetch the URL once.
 */
export async function signedMediaUrl(db: SupabaseClient, circleId: string, path: unknown): Promise<string | null> {
  if (typeof path !== 'string' || !path || path.length > 300) return null;
  const own = await db.rpc('media_path_in_circle', { p_circle: circleId, p_path: path });
  if (own.error || own.data !== true) return null;
  const signed = await db.storage.from('media').createSignedUrl(path, MEDIA_TTL_SECONDS);
  return signed.error ? null : signed.data.signedUrl;
}

export type LogRow = {
  circle_id: string;
  kind: 'assistant' | 'dictation' | 'who' | 'letter' | 'visit' | 'digest'; // = ai_log.kind check constraint
  speaker_person_id: string | null;
  input: string;
  output: unknown;
  distress?: boolean;
};

export async function writeLog(db: SupabaseClient, row: LogRow): Promise<void> {
  const res = await db.from('ai_log').insert({ ...row, distress: row.distress ?? false });
  if (res.error) console.error('ai_log insert failed', res.error.message); // never block the answer on logging
}
