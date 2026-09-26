import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeMetrics, countRepeats, doseCounts, driftFlags, fallbackNote, isNight, normalise, watchLine, windowFor,
  zonedTime, type Metrics,
} from '../../supabase/functions/_shared/digestMetrics.ts';
import { latestDigest, trendBars } from './digest.ts';
import type { Digest } from './types.ts';

const TZ = 'Europe/Madrid';
const m = (o: Partial<Metrics> = {}): Metrics => ({
  questions: 6, repeats: 1, repeatRate: 0.15, night: 0, dosesExpected: 2, dosesTaken: 2, dosesMissed: 0,
  pings: 0, moments: 0, messages: 0, distress: 0, ...o,
});

test('normalise drops case, accents and punctuation', () => {
  assert.deepEqual(normalise('¿Qué día es HOY?'), ['que', 'dia', 'es', 'hoy']);
});

test('countRepeats catches near-duplicates, not different questions', () => {
  assert.equal(countRepeats(['What day is it today?', 'what day is today', 'When is Pedro coming?']), 1);
  assert.equal(countRepeats(['Where is Ana?', 'What is for lunch?']), 0);
  assert.equal(countRepeats(['?!', '...']), 0);
});

test('zonedTime + windowFor respect the time zone (summer = UTC+2, winter = UTC+1)', () => {
  assert.equal(zonedTime('2026-07-01', '08:00', TZ).toISOString(), '2026-07-01T06:00:00.000Z');
  assert.equal(zonedTime('2026-01-15', '08:00', TZ).toISOString(), '2026-01-15T07:00:00.000Z');
  const w = windowFor(new Date('2026-09-26T18:00:00Z'), TZ);
  assert.equal(w.day, '2026-09-26');
  assert.equal(w.end.getTime() - w.start.getTime(), 86_400_000);
  const d = windowFor(new Date(), TZ, '2026-09-25');
  assert.equal(d.start.toISOString(), '2026-09-24T22:00:00.000Z');
  assert.equal(d.end.toISOString(), '2026-09-25T22:00:00.000Z');
});

test('isNight covers 23:00-06:00 local', () => {
  assert.equal(isNight(new Date('2026-09-25T21:30:00Z'), TZ), true); // 23:30
  assert.equal(isNight(new Date('2026-09-26T03:59:00Z'), TZ), true); // 05:59
  assert.equal(isNight(new Date('2026-09-26T04:00:00Z'), TZ), false); // 06:00
  assert.equal(isNight(new Date('2026-09-25T20:59:00Z'), TZ), false); // 22:59
});

test('doseCounts: taken, missed after the grace hour, pending, and meds created later', () => {
  const meds = [
    { id: 'a', times: ['08:00', '14:00'], active: true, created_at: '2026-01-01T00:00:00Z' },
    { id: 'b', times: ['09:00'], active: true, created_at: '2026-09-26T10:00:00Z' }, // created after its dose
    { id: 'c', times: ['09:00'], active: false, created_at: '2026-01-01T00:00:00Z' },
  ];
  const { start, end } = windowFor(new Date('2026-09-26T18:00:00Z'), TZ, '2026-09-26');
  const logs = [{ medication_id: 'a', scheduled_for: zonedTime('2026-09-26', '08:00', TZ).toISOString(), status: 'taken' as const }];
  const now = new Date('2026-09-26T12:30:00Z'); // 14:30 Madrid: 14:00 dose is past its grace hour? no, 30 min -> pending
  assert.deepEqual(doseCounts(meds, logs, start, end, now, TZ), { expected: 2, taken: 1, missed: 0 });
  assert.deepEqual(doseCounts(meds, logs, start, end, new Date('2026-09-26T18:00:00Z'), TZ), { expected: 2, taken: 1, missed: 1 });
});

test('computeMetrics: rate, night count, doses', () => {
  const r = computeMetrics({
    questions: ['what day is it', 'what day is it today', 'lunch?', 'who is Ana'],
    activityAt: [new Date('2026-09-25T22:00:00Z'), new Date('2026-09-26T10:00:00Z')],
    tz: TZ, doses: { expected: 2, taken: 1, missed: 1 }, pings: 1, moments: 2, messages: 0, distress: 0,
  });
  assert.equal(r.questions, 4);
  assert.equal(r.repeats, 1);
  assert.equal(r.repeatRate, 0.25);
  assert.equal(r.night, 1);
  assert.equal(r.dosesMissed, 1);
  assert.equal(computeMetrics({ ...{ questions: [], activityAt: [], tz: TZ, doses: { expected: 0, taken: 0, missed: 0 }, pings: 0, moments: 0, messages: 0, distress: 0 } }).repeatRate, 0);
});

test('driftFlags: needs history, needs a clear rise, ignores noise', () => {
  const week = Array.from({ length: 7 }, () => m());
  assert.deepEqual(driftFlags(m(), week), []);
  assert.deepEqual(driftFlags(m({ questions: 7 }), week), []); // 7 < 1.5 x 6
  assert.deepEqual(driftFlags(m({ questions: 14, repeatRate: 0.5, night: 3, dosesMissed: 2 }), week), ['questions', 'repeatRate', 'night', 'dosesMissed']);
  assert.deepEqual(driftFlags(m({ night: 1 }), week), []); // 1 late event is below the floor
  assert.deepEqual(driftFlags(m({ questions: 30 }), week.slice(0, 2)), []); // too little history
});

test('watchLine is an observation, never a diagnosis', () => {
  assert.equal(watchLine([], 'Carmen'), null);
  const line = watchLine(['night', 'dosesMissed'], 'Carmen') ?? '';
  assert.match(line, /^Worth watching: Carmen was up and active late at night more than usual and missed more medicines/);
  assert.doesNotMatch(line, /dementia|diagnos(is|e)\b.*(is|has)|alzheimer/i);
});

test('fallbackNote reads kindly with no data', () => {
  assert.match(fallbackNote('Carmen', m({ questions: 0, dosesExpected: 0 })), /quiet day/);
});

const digest = (day: string, questions: number): Digest => ({
  id: day, circle_id: 'c', day, note: 'n', watch: null, metrics: m({ questions }), created_at: `${day}T20:00:00Z`,
});

test('trendBars: 14 days ending at the newest digest, gaps are null, ratio scales to the max', () => {
  const bars = trendBars([digest('2026-09-26', 10), digest('2026-09-24', 5)], 'questions');
  assert.equal(bars.length, 14);
  assert.equal(bars[13].day, '2026-09-26');
  assert.equal(bars[13].ratio, 1);
  assert.equal(bars[12].value, null);
  assert.equal(bars[11].ratio, 0.5);
  assert.deepEqual(trendBars([], 'questions'), []);
});

test('latestDigest picks the newest day', () => {
  assert.equal(latestDigest([digest('2026-09-24', 1), digest('2026-09-26', 2)])?.day, '2026-09-26');
  assert.equal(latestDigest([]), null);
});
