import test from 'node:test';
import assert from 'node:assert/strict';
import { agenda, dateTile, dayHeading, eventMoments, groupByDay, momentEvent } from './calendarView.ts';
import type { EventRow, Moment, Person } from './types.ts';

const person = (id: string, birthday: string | null = null): Person => ({
  id, circle_id: 'c', name: id, relation: null, phone: null, photo_url: null, birthday, role: 'member', claimed: true,
});
const ev = (id: string, cal: string, starts: string, ends: string | null, persons: string[], allDay = false): EventRow => ({
  id, calendar_id: cal, uid: id.replace(/-\w+$/, ''), title: id, location: null, starts_at: starts, ends_at: ends,
  all_day: allDay, person_ids: persons,
});
const moment = (id: string, at: string, person_id: string | null, by: string | null, event_id: string | null = null): Moment => ({
  id, circle_id: 'c', person_id, author_person_id: by, author: null, body: id, photo_url: null, audio_url: null,
  created_at: at, event_id,
});

const today = new Date(2026, 8, 24, 9); // Thu 24 Sep 2026 local

test('dayHeading names today and tomorrow', () => {
  assert.equal(dayHeading(new Date(2026, 8, 24), today), 'Today, Thursday, September 24');
  assert.equal(dayHeading(new Date(2026, 8, 25), today), 'Tomorrow, Friday, September 25');
  assert.equal(dayHeading(new Date(2026, 8, 27), today), 'Sunday, September 27');
});

test('agenda merges one event across calendars and adds birthdays', () => {
  const events = [
    ev('walk-a', 'c1', new Date(2026, 8, 26, 10).toISOString(), new Date(2026, 8, 26, 11).toISOString(), ['anna']),
    ev('walk-b', 'c2', new Date(2026, 8, 26, 10).toISOString(), new Date(2026, 8, 26, 11).toISOString(), ['pedro']),
    ev('old', 'c1', new Date(2026, 8, 1, 10).toISOString(), new Date(2026, 8, 1, 11).toISOString(), ['anna']),
  ];
  // same uid: give walk-b the uid of walk-a
  events[1] = { ...events[1], uid: events[0].uid };
  const items = agenda(events, [person('anna'), person('lucia', '2010-09-25')], today, new Date(2026, 9, 24));
  assert.deepEqual(items.map((i) => i.title), ['lucia’s birthday', 'walk-a']);
  assert.deepEqual(items[1].personIds.sort(), ['anna', 'pedro']);
});

test('groupByDay puts an ongoing event under today; dateTile spans', () => {
  const trip = ev('trip', 'c1', new Date(Date.UTC(2026, 8, 22)).toISOString(), new Date(Date.UTC(2026, 8, 26)).toISOString(), ['anna'], true);
  const items = agenda([trip], [], today, new Date(2026, 9, 24));
  const groups = groupByDay(items, today);
  assert.equal(groups[0].heading, 'Today, Thursday, September 24');
  assert.deepEqual(dateTile(items[0]), { top: 'TUE–FRI', bottom: '22–25' });
});

test('moments link to events by day + person', () => {
  const walk = ev('walk', 'c1', new Date(2026, 8, 24, 10).toISOString(), new Date(2026, 8, 24, 11).toISOString(), ['anna', 'lucia']);
  const items = agenda([walk], [], new Date(2026, 8, 1), new Date(2026, 9, 24));
  const hit = moment('m1', new Date(2026, 8, 24, 12).toISOString(), 'lucia', 'anna');
  const wrongDay = moment('m2', new Date(2026, 8, 20, 12).toISOString(), 'lucia', 'anna');
  const wrongPerson = moment('m3', new Date(2026, 8, 24, 12).toISOString(), 'pedro', 'pedro');
  assert.equal(momentEvent(hit, items)?.title, 'walk');
  assert.equal(momentEvent(wrongDay, items), null);
  assert.equal(momentEvent(wrongPerson, items), null);
  assert.deepEqual(eventMoments(items[0], [hit, wrongDay, wrongPerson]).map((m) => m.id), ['m1']);
});

test('regression: an author-only multi-day event must not steal the chip from the real event', () => {
  // Anna is "In London" all week (participants: anna only) and also posts about Lucia's exam the same day
  // a same-day walk includes Lucia. The exam moment is *about* Lucia, so it must link to the walk, not London.
  const london = ev('london', 'c1', new Date(2026, 8, 24).toISOString(), new Date(2026, 8, 28).toISOString(), ['anna'], true);
  const walk = ev('walk', 'c2', new Date(2026, 8, 24, 10).toISOString(), new Date(2026, 8, 24, 11).toISOString(), ['anna', 'lucia']);
  const items = agenda([london, walk], [], new Date(2026, 8, 1), new Date(2026, 9, 1));
  const exam = moment('exam', new Date(2026, 8, 24, 15).toISOString(), 'lucia', 'anna');
  assert.equal(momentEvent(exam, items)?.title, 'walk');
});

test('event_id, when present, wins over the day+participant fallback', () => {
  const london = ev('london', 'c1', new Date(2026, 8, 24).toISOString(), new Date(2026, 8, 28).toISOString(), ['anna'], true);
  const walk = ev('walk', 'c2', new Date(2026, 8, 24, 10).toISOString(), new Date(2026, 8, 24, 11).toISOString(), ['anna', 'lucia']);
  const items = agenda([london, walk], [], new Date(2026, 8, 1), new Date(2026, 9, 1));
  const m = moment('m', new Date(2026, 8, 24, 15).toISOString(), 'lucia', 'anna', 'london');
  assert.equal(momentEvent(m, items)?.title, 'london');
  assert.deepEqual(eventMoments(items.find((i) => i.title === 'london')!, [m]).map((x) => x.id), ['m']);
});
