// Caller identity for edge functions. There is no login: a device proves it belongs to a circle by
// sending the circle's 6-character code (kept in the device-local session), optionally with the id
// of the claimed `people` row it acts as. See docs/security.md. Rules mirror src/lib/permissions.ts.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export type Role = 'lead' | 'admin' | 'member';
export type Member = { id: string; circle_id: string; role: Role; claimed: boolean; name: string };
export type Circle = { id: string; code: string; patient_name: string };
export type Caller = {
  circle: Circle;
  /** The claimed profile this device acts as, or null (patient device, or not claimed yet). */
  member: Member | null;
  patient: boolean;
};
export type Denied = { status: number; error: string };

export const normalizeCode = (input: unknown): string =>
  typeof input === 'string' ? input.toUpperCase().replace(/[\s-]/g, '') : '';

/** Constant-time string equality (codes are short; still no early exit). */
export function sameCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown';
}

/** Counted hit against a fixed window; false = over the limit. Fails closed on DB errors. */
export async function allow(db: SupabaseClient, key: string, limit: number, window: string): Promise<boolean> {
  const res = await db.rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window: window });
  if (res.error) {
    console.error('rate_limit_hit failed', res.error.message);
    return false;
  }
  return res.data === true;
}

/**
 * Resolves the caller from `{circle_id, code, member_id?, role?}` in the request body.
 * A wrong code costs the same as an unknown circle (404) and is throttled per IP so the 6-char
 * code cannot be brute-forced through the functions.
 */
export async function authCircle(
  db: SupabaseClient,
  req: Request,
  body: Record<string, unknown>,
): Promise<{ ok: true; caller: Caller } | { ok: false; denied: Denied }> {
  const circleId = body.circle_id;
  const code = normalizeCode(body.code);
  if (typeof circleId !== 'string' || !UUID.test(circleId) || !CODE.test(code)) {
    return { ok: false, denied: { status: 400, error: 'circle_id and code are required' } };
  }
  if (!(await allow(db, `auth:ip:${clientIp(req)}`, 60, '1 minute'))) {
    return { ok: false, denied: { status: 429, error: 'too many attempts, try again in a minute' } };
  }
  const res = await db.from('circles').select('id, code, patient_name').eq('id', circleId).maybeSingle();
  if (res.error) return { ok: false, denied: { status: 500, error: res.error.message } };
  const circle = res.data as Circle | null;
  if (!circle || !sameCode(circle.code, code)) {
    return { ok: false, denied: { status: 404, error: 'no circle with that code' } };
  }

  let member: Member | null = null;
  if (body.member_id !== undefined && body.member_id !== null) {
    if (typeof body.member_id !== 'string' || !UUID.test(body.member_id)) {
      return { ok: false, denied: { status: 400, error: 'member_id must be a uuid' } };
    }
    const m = await db.from('people').select('id, circle_id, role, claimed, name').eq('id', body.member_id).eq('circle_id', circle.id).maybeSingle();
    if (m.error) return { ok: false, denied: { status: 500, error: m.error.message } };
    member = (m.data as Member | null) ?? null;
    if (!member || !member.claimed) return { ok: false, denied: { status: 403, error: 'that profile is not yours' } };
  }
  return { ok: true, caller: { circle, member, patient: body.role === 'patient' } };
}

export const isStaff = (c: Caller) => !!c.member && (c.member.role === 'lead' || c.member.role === 'admin');
export const isLead = (c: Caller) => c.member?.role === 'lead';

/** Reads a JSON body, or null. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json();
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null;
