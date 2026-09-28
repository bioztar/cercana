// Edge function `media`: signed URLs for the private `media` bucket (anon has no storage policies).
// Objects live under `<circle_id>/<photo|audio>/<file>`; rows store that path, never a URL.
//   {circle_id, code, action:'upload', kind:'photo'|'audio', content_type}
//       → {path, token}: client uploads with storage.uploadToSignedUrl(path, token, blob)
//   {circle_id, code, action:'sign', paths:[...]}
//       → {urls:{[path]: signedUrl}, expires_in}: only paths of this circle (media_path_in_circle)
// Deploy: supabase functions deploy media
import { cors, json, serviceClient } from '../_shared/aiGuard.ts';
import { allow, authCircle, readJson } from '../_shared/circleAuth.ts';

export const READ_TTL_SECONDS = 60 * 60;
const UPLOADS_PER_CIRCLE_PER_HOUR = 300;
const MAX_PATHS = 100;

const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };
const AUDIO_TYPES: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson(req);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const db = serviceClient();
  const auth = await authCircle(db, req, body);
  if (!auth.ok) return json({ error: auth.denied.error }, auth.denied.status);
  const circleId = auth.caller.circle.id;
  const bucket = db.storage.from('media');

  if (body.action === 'upload') {
    const kind = body.kind === 'photo' || body.kind === 'audio' ? body.kind : null;
    const type = typeof body.content_type === 'string' ? body.content_type.split(';')[0].trim().toLowerCase() : '';
    const ext = kind === 'photo' ? PHOTO_TYPES[type] : kind === 'audio' ? AUDIO_TYPES[type] : undefined;
    if (!kind || !ext) return json({ error: 'kind (photo|audio) and a supported content_type are required' }, 400);
    if (!(await allow(db, `media:upload:${circleId}`, UPLOADS_PER_CIRCLE_PER_HOUR, '1 hour'))) {
      return json({ error: 'Too many uploads right now, please try again later.' }, 429);
    }
    const path = `${circleId}/${kind}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const signed = await bucket.createSignedUploadUrl(path);
    if (signed.error) return json({ error: signed.error.message }, 500);
    return json({ path, token: signed.data.token });
  }

  if (body.action === 'sign') {
    const raw = Array.isArray(body.paths) ? body.paths : [];
    const paths = [...new Set(raw.filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length <= 300))].slice(0, MAX_PATHS);
    const allowed: string[] = [];
    for (const p of paths) {
      if (p.startsWith(`${circleId}/`) && !p.includes('..')) {
        allowed.push(p);
        continue;
      }
      const own = await db.rpc('media_path_in_circle', { p_circle: circleId, p_path: p });
      if (!own.error && own.data === true) allowed.push(p);
    }
    const urls: Record<string, string> = {};
    if (allowed.length > 0) {
      const signed = await bucket.createSignedUrls(allowed, READ_TTL_SECONDS);
      if (signed.error) return json({ error: signed.error.message }, 500);
      for (const s of signed.data) if (s.signedUrl && s.path) urls[s.path] = s.signedUrl;
    }
    return json({ urls, expires_in: READ_TTL_SECONDS });
  }

  return json({ error: 'unknown action' }, 400);
});
