import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMediaUrl, letterFeedBody, letterSpoken, parseLetter, parseWho, shouldAlert, whoMessages, whoReply, UNSURE,
} from '../../supabase/functions/_shared/see.ts';

const known = [
  { id: 'p1', name: 'Pedro', relation: 'your son', photo_url: 'https://x/p1.jpg' },
  { id: 'p2', name: 'Anna', relation: null, photo_url: 'https://x/p2.jpg' },
  { id: 'p3', name: 'Nophoto', relation: 'a friend', photo_url: null },
];

test('parseWho: only confident, real, photographed members', () => {
  assert.equal(parseWho({ person_id: 'p1', confidence: 0.95 }, known)?.name, 'Pedro');
  assert.equal(parseWho({ person_id: 'p1', confidence: 0.6 }, known), null);
  assert.equal(parseWho({ person_id: 'p1' }, known), null);
  assert.equal(parseWho({ person_id: 'zzz', confidence: 0.99 }, known), null);
  assert.equal(parseWho({ person_id: 'p3', confidence: 0.99 }, known), null);
  assert.equal(parseWho({ person_id: null, confidence: 0.99 }, known), null);
  assert.equal(parseWho('nonsense', known), null);
});

test('whoReply comes from the person row, never model text', () => {
  assert.equal(whoReply(known[0]), "That's Pedro, your son.");
  assert.equal(whoReply(known[1]), "That's Anna.");
  assert.equal(whoReply(null), UNSURE);
});

test('whoMessages labels each reference photo and skips people without one', () => {
  const parts = whoMessages('https://x/q.jpg', known)[1].content as { type: string; text?: string }[];
  assert.equal(parts.filter((p) => p.type === 'image_url').length, 3); // 2 refs + target
  assert.ok(parts.some((p) => p.text === 'id=p1 name=Pedro (your son)'));
  assert.ok(!parts.some((p) => p.text?.includes('Nophoto')));
});

test('parseLetter fails toward caution and clamps fields', () => {
  const l = parseLetter({ summary: 'Your bill.', action_needed: 'yes', scam_risk: 'weird', reasons: ['a', 1, 'b', 'c', 'd'] });
  assert.equal(l.scam_risk, 'medium');
  assert.equal(l.action_needed, false);
  assert.deepEqual(l.reasons, ['a', 'b', 'c']);
  assert.match(parseLetter(null).summary, /can't read/);
});

test('alerts on high scam risk or action needed only', () => {
  const base = { summary: 's', action_needed: false, due: null, scam_risk: 'low' as const, reasons: [] };
  assert.equal(shouldAlert(base), false);
  assert.equal(shouldAlert({ ...base, scam_risk: 'medium' }), false);
  assert.equal(shouldAlert({ ...base, scam_risk: 'high' }), true);
  assert.equal(shouldAlert({ ...base, action_needed: true }), true);
});

test('letterSpoken says "I\'ve told" only when it alerts', () => {
  const base = { summary: 'A prize!', action_needed: false, due: null, scam_risk: 'high' as const, reasons: [] };
  assert.match(letterSpoken(base, 'Pedro'), /scam\. Don't pay or call anyone\. I've told Pedro\./);
  assert.doesNotMatch(letterSpoken({ ...base, scam_risk: 'low' }, 'Pedro'), /told/);
  assert.match(letterSpoken({ ...base, scam_risk: 'low' }, 'Pedro'), /nothing you need to do/);
  assert.doesNotMatch(letterSpoken({ ...base, scam_risk: 'medium' }, 'Pedro'), /told/);
});

test('letterFeedBody card text', () => {
  const l = { summary: 'Pay the water bill.', action_needed: true, due: 'Oct 3', scam_risk: 'low' as const, reasons: [] };
  assert.equal(letterFeedBody('Carmen', l), '✉️ Carmen photographed a letter: Pay the water bill. Needs action, due Oct 3.');
});

test('isMediaUrl only accepts our public media bucket', () => {
  const base = 'https://a.supabase.co';
  assert.equal(isMediaUrl(`${base}/storage/v1/object/public/media/photo/1.jpg`, base), true);
  assert.equal(isMediaUrl('http://169.254.169.254/x', base), false);
  assert.equal(isMediaUrl(`${base}.evil.com/storage/v1/object/public/media/x`, base), false);
  assert.equal(isMediaUrl(42, base), false);
});
