import test from 'node:test';
import assert from 'node:assert/strict';
import { reply } from './assistantScript.ts';
import type { EventRow, Person } from './types.ts';

const now = new Date(2026, 8, 24, 10, 0); // Thursday 24 Sep 2026

const person = (id: string, name: string, relation: string): Person => ({
  id, circle_id: 'c', name, relation, phone: null, photo_url: null, birthday: null, role: 'member', claimed: false,
});

const people: Person[] = [person('pedro', 'Pedro', 'your son'), person('anna', 'Anna', 'your daughter-in-law')];

const event = (title: string, startsAt: string, allDay = false): EventRow => ({
  id: title, calendar_id: 'cal', uid: title, title, location: null, starts_at: startsAt, ends_at: null,
  all_day: allDay, person_ids: [], created_by_person_id: null, includes_patient: true,
});

test('add/remind → confirmation card', () => {
  const r = reply('remind me to add lunch with Pedro tomorrow at 1:30', now, { people, events: [] });
  assert.equal(r.card?.when, 'Tomorrow 01:30');
  assert.match(r.text, /Yes \/ No$/);
  assert.equal(r.card?.title, 'Lunch with Pedro');
});

test('calendar keyword with a weekday and 24h time', () => {
  const r = reply('add doctor appointment on Monday at 15:00', now, { people, events: [] });
  assert.equal(r.card?.when, 'Monday 15:00');
});

test('Spanish "cita" also triggers a card', () => {
  const r = reply('cita con el doctor', now, { people, events: [] });
  assert.ok(r.card);
});

test('no day or time falls back to Tomorrow 10:00', () => {
  const r = reply('add milk', now, { people, events: [] });
  assert.equal(r.card?.when, 'Tomorrow 10:00');
});

test('who/family with a named person', () => {
  assert.equal(reply('who is Pedro?', now, { people, events: [] }).text, 'Pedro is your son.');
  assert.equal(reply('tell me about Anna', now, { people, events: [] }).text, 'Anna is your daughter-in-law.');
});

test('who/family with no name gives the list', () => {
  const r = reply('who is my family', now, { people, events: [] });
  assert.equal(r.text, 'Your family: Pedro (your son), Anna (your daughter-in-law).');
});

test('today lists today\'s events', () => {
  const events = [event('Lunch', new Date(2026, 8, 24, 13, 0).toISOString())];
  const r = reply('what is on today', now, { people, events });
  assert.match(r.text, /^Today: Lunch at 1 pm\.$/);
});

test('today with nothing scheduled', () => {
  const r = reply('today', now, { people, events: [] });
  assert.equal(r.text, 'Nothing on the calendar today.');
});

test('default fallback', () => {
  const r = reply('hello there', now, { people, events: [] });
  assert.equal(r.text, "I'm here. I can add things to your calendar or tell your family something.");
});
