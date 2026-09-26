import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  instants, localParts, looksDistressed, resolveDate, resolveTime, shapeResponse, validateRequest, zonedToUtc,
} from '../../supabase/functions/_shared/assistantCore.ts';

const TZ = 'Europe/Madrid';
// Saturday 2026-09-26 10:00 Madrid (CEST, UTC+2)
const NOW = new Date('2026-09-26T08:00:00Z');

test('localParts / zonedToUtc round-trip across DST', () => {
  assert.deepEqual(localParts(NOW, TZ), { y: 2026, m: 9, d: 26, h: 10, mi: 0, weekday: 6 });
  assert.equal(zonedToUtc({ y: 2026, m: 9, d: 29 }, { h: 11, mi: 0 }, TZ).toISOString(), '2026-09-29T09:00:00.000Z');
  assert.equal(zonedToUtc({ y: 2026, m: 12, d: 1 }, { h: 11, mi: 0 }, TZ).toISOString(), '2026-12-01T10:00:00.000Z'); // CET
});

test('resolveDate: weekdays, en + es', () => {
  assert.deepEqual(resolveDate('I have the dentist Tuesday at 11', NOW, TZ), { y: 2026, m: 9, d: 29 });
  assert.deepEqual(resolveDate('next Tuesday', NOW, TZ), { y: 2026, m: 9, d: 29 });
  assert.deepEqual(resolveDate('el jueves', NOW, TZ), { y: 2026, m: 10, d: 1 });
  assert.deepEqual(resolveDate('el sábado', NOW, TZ), { y: 2026, m: 10, d: 3 }); // today is Saturday → next one
});

test('resolveDate: today/tomorrow, mañana morning is not tomorrow', () => {
  assert.deepEqual(resolveDate('mañana a las 9', NOW, TZ), { y: 2026, m: 9, d: 27 });
  assert.deepEqual(resolveDate('pasado mañana', NOW, TZ), { y: 2026, m: 9, d: 28 });
  assert.deepEqual(resolveDate('hoy', NOW, TZ), { y: 2026, m: 9, d: 26 });
  assert.equal(resolveDate('a las 9 de la mañana', NOW, TZ), null);
  assert.deepEqual(resolveDate('in 2 weeks', NOW, TZ), { y: 2026, m: 10, d: 10 });
});

test('resolveDate: day of month and month names roll forward', () => {
  assert.deepEqual(resolveDate('on the 3rd', NOW, TZ), { y: 2026, m: 10, d: 3 });
  assert.deepEqual(resolveDate('el 30', NOW, TZ), { y: 2026, m: 9, d: 30 });
  assert.deepEqual(resolveDate('3 de octubre', NOW, TZ), { y: 2026, m: 10, d: 3 });
  assert.deepEqual(resolveDate('January 5', NOW, TZ), { y: 2027, m: 1, d: 5 });
  assert.deepEqual(resolveDate('the 31st', NOW, TZ), { y: 2026, m: 10, d: 31 });
});

test('resolveDate: nothing to resolve', () => {
  assert.equal(resolveDate('what is on', NOW, TZ), null);
  assert.equal(resolveDate('at 11', NOW, TZ), null);
});

test('resolveTime', () => {
  assert.deepEqual(resolveTime('Tuesday at 11'), { h: 11, mi: 0 });
  assert.deepEqual(resolveTime('on the 3rd at 9:30'), { h: 9, mi: 30 });
  assert.deepEqual(resolveTime('a las 5 y media'), { h: 17, mi: 30 });
  assert.deepEqual(resolveTime('a las 11 y cuarto'), { h: 11, mi: 15 });
  assert.deepEqual(resolveTime('a las 8 de la tarde'), { h: 20, mi: 0 });
  assert.deepEqual(resolveTime('8 in the morning'), { h: 8, mi: 0 });
  assert.deepEqual(resolveTime('3pm'), { h: 15, mi: 0 });
  assert.deepEqual(resolveTime('at noon'), { h: 12, mi: 0 });
  assert.equal(resolveTime('el 3 de octubre'), null);
  assert.equal(resolveTime('the 3rd'), null);
});

test('instants: timed and all-day', () => {
  const t = instants({ y: 2026, m: 9, d: 29 }, { h: 11, mi: 0 }, TZ);
  assert.equal(t.starts_at, '2026-09-29T09:00:00.000Z');
  assert.equal(t.ends_at, '2026-09-29T10:00:00.000Z');
  const a = instants({ y: 2026, m: 9, d: 29 }, null, TZ);
  assert.deepEqual(a, { starts_at: '2026-09-29T00:00:00.000Z', ends_at: '2026-09-30T00:00:00.000Z', all_day: true });
});

test('looksDistressed', () => {
  assert.ok(looksDistressed('Where am I?'));
  assert.ok(looksDistressed("I'm scared"));
  assert.ok(looksDistressed('Tengo miedo'));
  assert.ok(looksDistressed('¿Dónde estoy?'));
  assert.ok(!looksDistressed('What is on today?'));
});

test('shapeResponse: own words beat the model date; proposal is built', () => {
  const raw = { reply: 'Add dentist on Tuesday at 11:00?', distress: false, event: { title: 'Dentist', date: '2026-09-30', time: '10:00', duration_min: null, location: null, note: null } };
  const r = shapeResponse(raw, { text: 'I have the dentist Tuesday at 11', mode: 'chat' }, NOW, TZ);
  assert.equal(r.proposal?.starts_at, '2026-09-29T09:00:00.000Z');
  assert.equal(r.proposal?.title, 'Dentist');
  assert.equal(r.distress, false);
});

test('shapeResponse: chat without a time drops the proposal, dictate makes it all-day', () => {
  const raw = { reply: 'What time?', event: { title: 'Dentist', date: '2026-09-29', time: null } };
  assert.equal(shapeResponse(raw, { text: 'dentist Tuesday', mode: 'chat' }, NOW, TZ).proposal, undefined);
  const d = shapeResponse({ reply: 'Ok', event: { title: 'Cardiology', date: '2026-10-03', time: null, note: 'bring the blood test', location: 'Hospital Clínic' } }, { text: 'Carmen has cardiology on the 3rd', mode: 'dictate' }, NOW, TZ);
  assert.equal(d.proposal?.all_day, true);
  assert.equal(d.proposal?.note, 'bring the blood test');
  assert.equal(d.proposal?.location, 'Hospital Clínic');
});

test('shapeResponse: garbage model output is safe; distress from words or model', () => {
  const g = shapeResponse('nope', { text: 'hello', mode: 'chat' }, NOW, TZ);
  assert.ok(g.reply.length > 0 && !g.proposal && !g.distress);
  assert.ok(shapeResponse({ reply: 'ok' }, { text: 'where am I', mode: 'chat' }, NOW, TZ).distress);
  assert.ok(shapeResponse({ reply: 'ok', distress: true }, { text: 'where is Juan', mode: 'chat' }, NOW, TZ).distress);
  assert.equal(shapeResponse({ event: { title: 'X', date: '2026-02-31', time: '10:00' } }, { text: 'x', mode: 'dictate' }, NOW, TZ).proposal, undefined);
});

test('validateRequest', () => {
  const ok = { circle_id: '11111111-1111-4111-8111-111111111111', speaker_person_id: null, mode: 'chat', text: ' hi ', history: [{ role: 'user', text: 'a' }, { role: 'bad', text: 'b' }], now: NOW.toISOString(), tz: TZ };
  const v = validateRequest(ok);
  assert.ok(v.ok && v.value.text === 'hi' && v.value.history.length === 1);
  assert.ok(!validateRequest({ ...ok, circle_id: 'x' }).ok);
  assert.ok(!validateRequest({ ...ok, mode: 'other' }).ok);
  assert.ok(!validateRequest({ ...ok, text: 'x'.repeat(1001) }).ok);
  assert.ok(!validateRequest({ ...ok, text: '' }).ok);
  assert.ok(!validateRequest({ ...ok, tz: 'Mars/Base' }).ok);
  assert.ok(!validateRequest({ ...ok, audio_url: 'http://x/a.m4a' }).ok);
});
