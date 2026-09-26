import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allDaySpan, commentText, monthGrid, nearbyEvents, proposalToEvent, rangeLabel, singleDay, summarizeComments, titleFromTranscript,
  weekendRange,
} from './voice.ts';
import type { Comment, EventRow } from './types.ts';

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

test('weekendRange: midweek looks ahead to Saturday', () => {
  const wed = new Date(2026, 8, 23); // Wed 23 Sep 2026
  const w = weekendRange(wed, 0);
  assert.equal(ymd(w.first), '2026-9-26');
  assert.equal(ymd(w.last), '2026-9-27');
  assert.equal(ymd(weekendRange(wed, 1).first), '2026-10-3');
});

test('weekendRange: on Saturday and Sunday this weekend is the one under way', () => {
  assert.equal(ymd(weekendRange(new Date(2026, 8, 26), 0).first), '2026-9-26');
  assert.equal(ymd(weekendRange(new Date(2026, 8, 27), 0).first), '2026-9-26');
  assert.equal(ymd(weekendRange(new Date(2026, 8, 27), 1).first), '2026-10-3');
});

test('rangeLabel', () => {
  assert.equal(rangeLabel(weekendRange(new Date(2026, 8, 23), 0)), '26–27 Sep');
  assert.equal(rangeLabel(weekendRange(new Date(2026, 8, 23), 1)), '3–4 Oct');
  assert.equal(rangeLabel({ first: new Date(2026, 8, 30), last: new Date(2026, 9, 1) }), '30 Sep – 1 Oct');
  assert.equal(rangeLabel(singleDay(new Date(2026, 8, 24, 15))), '24 Sep');
});

test('allDaySpan: UTC midnight start, exclusive end after the last day', () => {
  const s = allDaySpan(weekendRange(new Date(2026, 8, 23), 0));
  assert.equal(s.starts_at, '2026-09-26T00:00:00.000Z');
  assert.equal(s.ends_at, '2026-09-28T00:00:00.000Z');
});

test('monthGrid: Monday-first with leading padding', () => {
  const g = monthGrid(2026, 9); // Oct 2026 starts on a Thursday
  assert.equal(g.filter((d) => d === null).length, 3);
  assert.equal(g.length, 31 + 3);
  assert.equal(g[3]?.getDate(), 1);
  assert.equal(monthGrid(2026, 8)[1]?.getDate(), 1); // Sep 2026 starts on a Tuesday: one pad
});

const ev = (id: string, uid: string, starts: string): EventRow => ({
  id, calendar_id: 'c', uid, title: id, location: null, starts_at: starts, ends_at: null, all_day: false, person_ids: [],
});

test('nearbyEvents: window, dedupe, order', () => {
  const now = new Date(2026, 8, 24, 12);
  const list = nearbyEvents(
    [
      ev('far', 'far', new Date(2026, 9, 20).toISOString()),
      ev('b', 'b', new Date(2026, 8, 25, 10).toISOString()),
      ev('b2', 'b', new Date(2026, 8, 25, 10).toISOString()), // same event on a second calendar
      ev('a', 'a', new Date(2026, 8, 23, 10).toISOString()),
      ev('old', 'old', new Date(2026, 8, 1).toISOString()),
    ],
    now,
  );
  assert.deepEqual(list.map((e) => e.id), ['a', 'b']);
});

const cm = (id: string, moment_id: string, at: string, o: Partial<Comment> = {}): Comment => ({
  id, moment_id, circle_id: 'c', author_person_id: null, author_name: 'Maria', body: id, audio_url: null, created_at: at, ...o,
});

test('summarizeComments: count and newest per moment', () => {
  const s = summarizeComments([
    cm('1', 'm1', '2026-09-24T10:00:00Z'),
    cm('3', 'm1', '2026-09-24T12:00:00Z'),
    cm('2', 'm1', '2026-09-24T11:00:00Z'),
    cm('4', 'm2', '2026-09-24T09:00:00Z'),
  ]);
  assert.equal(s.m1.count, 3);
  assert.equal(s.m1.last.id, '3');
  assert.equal(s.m2.count, 1);
  assert.equal(s.m3, undefined);
});

test('commentText falls back to Voice message', () => {
  assert.equal(commentText({ body: ' hi ', audio_url: null }), 'hi');
  assert.equal(commentText({ body: null, audio_url: 'x' }), 'Voice message');
  assert.equal(commentText({ body: '', audio_url: null }), '');
});

test('titleFromTranscript', () => {
  assert.equal(titleFromTranscript('  next weekend we are going to see the relatives. '), 'Next weekend we are going to see the relatives');
  assert.equal(titleFromTranscript(''), '');
  assert.ok(titleFromTranscript('word '.repeat(40)).length <= 62);
});

test('proposalToEvent folds the note into the title and defaults the end', () => {
  const e = proposalToEvent({ title: 'Cardiology', starts_at: '2026-10-03T07:30:00.000Z', note: 'bring the blood test', location: 'Hospital Clínic' });
  assert.equal(e.title, 'Cardiology (bring the blood test)');
  assert.equal(e.ends_at, '2026-10-03T08:30:00.000Z');
  assert.equal(e.all_day, false);
  assert.equal(e.location, 'Hospital Clínic');
  const a = proposalToEvent({ title: 'Dentist', starts_at: '2026-09-29T00:00:00.000Z', all_day: true });
  assert.equal(a.ends_at, '2026-09-30T00:00:00.000Z');
  assert.equal(a.location, null);
});
