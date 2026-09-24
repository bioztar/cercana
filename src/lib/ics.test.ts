import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ICAL from 'ical.js';
import { expandIcs, normalizeFeedUrl } from '../../supabase/functions/_shared/ics.ts';

const text = readFileSync(new URL('./fixtures/sample.ics', import.meta.url), 'utf8');
const from = new Date('2026-09-23T00:00:00Z');
const to = new Date('2026-11-23T00:00:00Z');
const events = expandIcs(ICAL, text, from, to);
const byTitle = (t: string) => events.filter((e) => e.title === t);

test('weekly event expands, honours EXDATE and the RECURRENCE-ID override', () => {
  const standups = events.filter((e) => e.uid === 'weekly-standup@test').map((e) => `${e.starts_at.slice(0, 10)} ${e.title}`);
  assert.deepEqual(standups, [
    '2026-09-28 Standup',
    // 2026-10-05 removed by EXDATE
    '2026-10-12 Standup (moved)',
    '2026-10-19 Standup',
    '2026-10-26 Standup',
    '2026-11-02 Standup',
    '2026-11-09 Standup',
    '2026-11-16 Standup',
  ]);
  assert.equal(byTitle('Standup (moved)')[0].starts_at, '2026-10-12T11:00:00.000Z');
  assert.equal(byTitle('Standup')[0].location, 'Zoom');
});

test('all-day multi-day trip: date-only, exclusive end', () => {
  const [trip] = byTitle('Trip to Madrid');
  assert.equal(trip.all_day, true);
  assert.equal(trip.starts_at, '2026-09-26T00:00:00.000Z');
  assert.equal(trip.ends_at, '2026-09-29T00:00:00.000Z');
});

test('all-day single day without DTEND spans one day', () => {
  const [lunch] = byTitle('Lunch for Lucia');
  assert.equal(lunch.all_day, true);
  assert.equal(lunch.starts_at, '2026-09-27T00:00:00.000Z');
  assert.equal(lunch.ends_at, '2026-09-28T00:00:00.000Z');
});

test('timed event with TZID is normalised to UTC (Madrid is UTC+2 in September)', () => {
  const [d] = byTitle('Dentist');
  assert.equal(d.all_day, false);
  assert.equal(d.starts_at, '2026-09-25T14:00:00.000Z');
  assert.equal(d.ends_at, '2026-09-25T15:00:00.000Z');
  assert.equal(d.location, 'Calle Mayor 1');
});

test('cancelled and out-of-window events are dropped', () => {
  assert.equal(byTitle('Cancelled thing').length, 0);
  assert.equal(byTitle('Long ago').length, 0);
});

test('rows are unique per (uid, starts_at) and sorted', () => {
  const keys = events.map((e) => `${e.uid}|${e.starts_at}`);
  assert.equal(new Set(keys).size, keys.length);
  const starts = events.map((e) => e.starts_at);
  assert.deepEqual(starts, [...starts].sort());
});

test('normalizeFeedUrl', () => {
  assert.equal(normalizeFeedUrl('webcal://p01-caldav.icloud.com/published/2/abc'), 'https://p01-caldav.icloud.com/published/2/abc');
  assert.equal(normalizeFeedUrl(' https://calendar.google.com/x/basic.ics '), 'https://calendar.google.com/x/basic.ics');
  assert.equal(normalizeFeedUrl('file:///etc/passwd'), null);
  assert.equal(normalizeFeedUrl('javascript:alert(1)'), null);
});
