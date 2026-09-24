import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardImportant } from './dashboard.ts';
import { defaultReminders } from './important.ts';
import type { Checkin, ImportantEvent } from './types.ts';

const now = new Date(2026, 8, 24, 13, 0); // Thu 24 Sep 2026, 1pm local

const ev = (id: string, s: Date, e: Date | null = null): ImportantEvent => ({
  id, circle_id: 'c', title: id, starts_at: s.toISOString(), ends_at: e?.toISOString() ?? null,
  location: null, for_person: 'mom', created_by_person_id: null, reminders: defaultReminders(s, e),
  created_at: now.toISOString(),
});
const checkin = (eventId: string): Checkin => ({
  id: `k-${eventId}`, circle_id: 'c', important_event_id: eventId, answer: 'went', note_audio_url: null,
  answered_at: now.toISOString(),
});

test('an overdue, unanswered check-in still shows (the "No important events yet" bug)', () => {
  // Blood test 09:00-09:30 this morning: its check reminder (11:30) and re-ask (12:30) both already
  // passed by noon, so `nextImportant` (end-time based) would drop it entirely.
  const bloodTest = ev('blood', new Date(2026, 8, 24, 9, 0), new Date(2026, 8, 24, 9, 30));
  const rows = dashboardImportant([bloodTest], [], now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event.id, 'blood');
  assert.equal(rows[0].urgent, true);
  assert.equal(rows[0].status, 'Mom hasn’t answered');
});

test('ranks: urgent first, then upcoming soonest-first, then waiting, then answered most-recent-first', () => {
  const urgent = ev('urgent', new Date(2026, 8, 24, 9, 0), new Date(2026, 8, 24, 9, 30)); // overdue, unanswered
  const soon = ev('soon', new Date(2026, 8, 26, 10, 0)); // upcoming
  const later = ev('later', new Date(2026, 8, 28, 10, 0)); // upcoming, further out
  const waiting = ev('waiting', new Date(2026, 8, 24, 11, 0), new Date(2026, 8, 24, 11, 15)); // just over, not yet re-ask
  const answeredOld = ev('answered-old', new Date(2026, 8, 20, 9, 0));
  const answeredNew = ev('answered-new', new Date(2026, 8, 22, 9, 0));
  const checkins = [checkin('answered-old'), checkin('answered-new')];
  const rows = dashboardImportant([later, answeredOld, soon, answeredNew, waiting, urgent], checkins, now);
  assert.deepEqual(rows.map((r) => r.event.id), ['urgent', 'soon', 'later', 'waiting', 'answered-new', 'answered-old']);
});

test('an answered event never shows as urgent', () => {
  const e = ev('e', new Date(2026, 8, 24, 9, 0), new Date(2026, 8, 24, 9, 30));
  const rows = dashboardImportant([e], [checkin('e')], now);
  assert.equal(rows[0].urgent, false);
  assert.equal(rows[0].status, 'Mom went');
});
