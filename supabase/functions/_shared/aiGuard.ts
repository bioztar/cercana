// Shared plumbing for AI edge functions: CORS, JSON replies, service-role client, per-circle daily cap, ai_log writes.
// The anon key is public, so every AI function is internet-facing: cap + validate before spending tokens.
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

/** True when the circle has already used today's AI budget (UTC day, counted from ai_log rows). */
export async function overDailyCap(db: SupabaseClient, circleId: string): Promise<boolean> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const res = await db.from('ai_log').select('id', { count: 'exact', head: true }).eq('circle_id', circleId).gte('created_at', start.toISOString());
  if (res.error) throw new Error(`ai_log count failed: ${res.error.message}`);
  return (res.count ?? 0) >= CAPS.dailyCalls;
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
