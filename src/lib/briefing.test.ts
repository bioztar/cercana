import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBriefing, comingUp, eventPhrase, eventSpan, isActive, ongoingSentence, ordinal, timeLabel, todaySentences,
  type EventLite,
} from './briefing.ts';

const now = new Date(2026, 8, 24, 9, 0); // Thursday 24 September 2026, 09:00 local
const utcDay = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d)).toISOString();
const allDay = (title: string, from: [number, number], toInclusive?: [number, number]): EventLite => ({
  title,
  starts_at: utcDay(...from),
  ends_at: utcDay(toInclusive ? toInclusive[0] : from[0], (toInclusive ? toInclusive[1] : from[1]) + 1),
  all_day: true,
});
const timed = (title: string, h: number, m = 0, dayOffset = 0, durH = 1): EventLite => {
  const s = new Date(2026, 8, 24 + dayOffset, h, m);
  return { title, starts_at: s.toISOString(), ends_at: new Date(s.getTime() + durH * 3_600_000).toISOString(), all_day: false };
};

test('ordinal and timeLabel', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 24, 31].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '24th', '31st']);
  assert.equal(timeLabel(new Date(2026, 8, 24, 16, 0)), '4 pm');
  assert.equal(timeLabel(new Date(2026, 8, 24, 9, 30)), '9:30 am');
  assert.equal(timeLabel(new Date(2026, 8, 24, 0, 5)), '12:05 am');
  assert.equal(timeLabel(new Date(2026, 8, 24, 12, 0)), '12 pm');
});

test('eventSpan: all-day multi-day is inclusive, end exclusive in data', () => {
  const s = eventSpan(allDay('Trip', [9, 26], [9, 28]));
  assert.equal(s.firstDay.getDate(), 26);
  assert.equal(s.lastDay.getDate(), 28);
  const one = eventSpan(allDay('Birthday lunch', [9, 24]));
  assert.equal(one.firstDay.getTime(), one.lastDay.getTime());
});

test('phrases: timed tomorrow, all-day weekday, far date', () => {
  assert.equal(eventPhrase(timed('Dentist', 16, 0, 1), now), 'Tomorrow at 4 pm — Dentist');
  assert.equal(eventPhrase(allDay('Trip to Madrid', [9, 26]), now), 'Saturday — Trip to Madrid');
  assert.equal(eventPhrase(allDay('Concert', [10, 3]), now), 'Saturday 3 October — Concert');
  assert.equal(eventPhrase(timed('Pills', 18, 30, 0), now), 'Today at 6:30 pm — Pills');
});

test('phrases: multi-day upcoming and ongoing', () => {
  assert.equal(eventPhrase(allDay('Trip to Madrid', [9, 26], [9, 28]), now), 'Saturday until Monday — Trip to Madrid');
});

test('ongoing multi-day event reads as a sentence', () => {
  assert.equal(eventPhrase(allDay('In London', [9, 22], [9, 27]), now, 'Anna'), 'Anna is in London until Sunday.');
  assert.equal(eventPhrase(allDay('At the clinic', [9, 23], [9, 25]), now, 'Pedro'), 'Pedro is at the clinic until tomorrow.');
  assert.equal(eventPhrase(allDay('At the clinic', [9, 23], [9, 26]), now, 'Pedro'), 'Pedro is at the clinic until Saturday.');
  assert.equal(eventPhrase(allDay('Trip to Madrid', [9, 22], [9, 27]), now, 'Anna'), 'Anna: Trip to Madrid, until Sunday.');
  assert.equal(eventPhrase(allDay('In London', [9, 22], [9, 24]), now, 'Anna'), 'Anna is in London until today.');
  assert.equal(eventPhrase(allDay('Trip', [9, 22], [9, 27]), now), 'Trip, until Sunday.');
  assert.equal(ongoingSentence('Interview', 'Anna', 'Friday'), 'Anna: Interview, until Friday');
});

test('briefing uses the same ongoing phrasing', () => {
  const text = buildBriefing({
    patientName: 'Maria',
    now,
    events: [{ ...allDay('In London', [9, 22], [9, 27]), owners: ['Anna'] }],
    birthdayPhrase: "Tomorrow is Lucia's birthday — your granddaughter turns 16",
  });
  assert.equal(
    text,
    "Good morning Maria. Today is Thursday the 24th. Anna is in London until Sunday. Tomorrow is Lucia's birthday — your granddaughter turns 16.",
  );
});

test('isActive drops past events', () => {
  assert.equal(isActive(allDay('Yesterday', [9, 23]), now), false);
  assert.equal(isActive(allDay('Today', [9, 24]), now), true);
  assert.equal(isActive(timed('Breakfast', 7, 0, 0), now), false); // ended 08:00
  assert.equal(isActive(timed('Lunch', 13, 0, 0), now), true);
});

test('comingUp: ongoing first, then by start, limited, past dropped', () => {
  const list = comingUp(
    [
      timed('Dentist', 16, 0, 1),
      allDay('Old', [9, 20]),
      allDay('Anna in London', [9, 22], [9, 27]),
      timed('Pills', 18, 0, 0),
      allDay('Trip', [9, 26]),
    ],
    now,
    3,
  );
  assert.deepEqual(list.map((c) => c.event.title), ['Anna in London', 'Pills', 'Dentist']);
  assert.equal(list[0].ongoing, true);
  assert.equal(list[1].ongoing, false);
});

test('todaySentences', () => {
  const s = todaySentences(
    [
      { ...allDay('Anna flies to London', [9, 24]), owners: ['Anna'] },
      { ...timed('Dentist', 16, 0, 0), owners: ['Pedro'] },
      timed('Tomorrow thing', 10, 0, 1),
      { ...allDay('Trip', [9, 22], [9, 27]), owners: ['Carmen'] },
    ],
    now,
  );
  assert.deepEqual(s, [
    'Carmen: Trip, until Sunday.',
    'Today, Anna flies to London.',
    'At 4 pm, Pedro: Dentist.',
  ]);
});

test('buildBriefing: full sentence', () => {
  const text = buildBriefing({
    patientName: 'Maria',
    now,
    events: [{ ...allDay('Anna flies to London', [9, 24]), owners: ['Anna'] }],
    birthdayPhrase: "On Saturday it is Lucia's birthday",
  });
  assert.equal(
    text,
    "Good morning Maria. Today is Thursday the 24th. Today, Anna flies to London. On Saturday it is Lucia's birthday.",
  );
});

test('buildBriefing: nothing on calendar, no birthday', () => {
  assert.equal(
    buildBriefing({ patientName: 'Maria', now: new Date(2026, 8, 24, 15, 0), events: [] }),
    'Good afternoon Maria. Today is Thursday the 24th.',
  );
});
