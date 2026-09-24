import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerHeadline, cardText, checkQuestion, defaultReminders, deliveryOf, dueCheckin, importantPhrase,
  nextImportant, notificationPlan, statusText, todaysImportantSentences,
} from './important.ts';
import type { Checkin, ImportantEvent } from './types.ts';

const now = new Date(2026, 8, 28, 9, 0); // Monday 28 Sep 2026, 09:00 local
const start = new Date(2026, 8, 29, 10, 30); // Tuesday 10:30

const ev = (id: string, s: Date, e: Date | null = null): ImportantEvent => ({
  id, circle_id: 'c', title: 'Cardiologist appointment', starts_at: s.toISOString(), ends_at: e?.toISOString() ?? null,
  location: null, for_person: 'mom', created_by_person_id: null, reminders: defaultReminders(s, e),
  created_at: now.toISOString(),
});
const checkin = (eventId: string): Checkin => ({
  id: 'k', circle_id: 'c', important_event_id: eventId, answer: 'went', note_audio_url: null, answered_at: now.toISOString(),
});

test('defaultReminders: 20:00 the evening before, 2 h before, check 2 h after end (or start)', () => {
  const r = defaultReminders(start, null).map((x) => new Date(x.at));
  assert.deepEqual(r[0], new Date(2026, 8, 28, 20, 0));
  assert.deepEqual(r[1], new Date(2026, 8, 29, 8, 30));
  assert.deepEqual(r[2], new Date(2026, 8, 29, 12, 30));
  const withEnd = defaultReminders(start, new Date(2026, 8, 29, 11, 30)).map((x) => new Date(x.at));
  assert.deepEqual(withEnd[2], new Date(2026, 8, 29, 13, 30));
});

test('nextImportant skips finished events', () => {
  const past = ev('p', new Date(2026, 8, 20, 10, 0));
  const soon = ev('s', start);
  assert.equal(nextImportant([past, soon], now)?.id, 's');
  assert.equal(nextImportant([past], now), null);
});

test('dueCheckin: after the check time, unanswered, within a day', () => {
  const e = ev('e', start);
  assert.equal(dueCheckin([e], [], new Date(2026, 8, 29, 12, 0)), null);
  assert.equal(dueCheckin([e], [], new Date(2026, 8, 29, 12, 31))?.id, 'e');
  assert.equal(dueCheckin([e], [checkin('e')], new Date(2026, 8, 29, 12, 31)), null);
  assert.equal(dueCheckin([e], [], new Date(2026, 8, 30, 13, 0)), null); // over a day late
});

test('card, briefing phrase and question', () => {
  const e = ev('e', start);
  assert.equal(cardText(e, now), 'Cardiologist appointment, Tomorrow at 10:30 am');
  assert.equal(importantPhrase(e, now), 'Important: Cardiologist appointment, tomorrow at 10:30 am');
  assert.equal(importantPhrase(ev('far', new Date(2026, 9, 20, 10, 0)), now), null);
  assert.equal(importantPhrase(null, now), null);
  assert.equal(checkQuestion('Cardiologist appointment'), 'Did you go to the doctor?');
  assert.equal(checkQuestion('Dentist'), 'Did you go to the dentist?');
  assert.equal(checkQuestion('Lunch with Pedro'), 'Did you go?');
});

test('status text and delivery', () => {
  const e = ev('e', start);
  assert.equal(statusText(e, null, now), 'Reminders are set');
  assert.equal(statusText(e, null, new Date(2026, 8, 29, 13, 0)), 'Waiting for Mom’s answer');
  assert.equal(statusText(e, checkin('e'), now), 'Mom went');
  assert.equal(answerHeadline('missed'), "Mom couldn't make it");
  assert.equal(deliveryOf(e.reminders[0], now), 'scheduled');
  assert.equal(deliveryOf(e.reminders[0], new Date(2026, 8, 28, 20, 1)), 'delivered');
});

test('todaysImportantSentences: only today\'s events, sorted, none for other days', () => {
  const today1 = ev('e1', new Date(2026, 8, 28, 8, 0));
  const today2 = ev('e2', new Date(2026, 8, 28, 16, 0));
  const tomorrow = ev('e3', start);
  assert.deepEqual(todaysImportantSentences([tomorrow, today2, today1], now), [
    'Cardiologist appointment at 8 am.',
    'Cardiologist appointment at 4 pm.',
  ]);
  assert.deepEqual(todaysImportantSentences([tomorrow], now), []);
});

test('notificationPlan: future reminders of unanswered events only, sorted, stable ids', () => {
  const e = ev('e', start);
  const plan = notificationPlan([e, ev('done', start)], [checkin('done')], new Date(2026, 8, 29, 8, 0));
  assert.deepEqual(plan.map((p) => p.id), ['imp-e-on_day', 'imp-e-check']);
  assert.equal(plan[0].title, 'Today: Cardiologist appointment');
  assert.equal(plan[1].title, 'Did you go to the doctor?');
  const all = notificationPlan([e], [], now);
  assert.equal(all.length, 3);
  assert.equal(all[0].title, 'Tomorrow: Cardiologist appointment');
  assert.equal(all[0].body, 'Cardiologist appointment, Tomorrow at 10:30 am. Reminder from your family.');
});
