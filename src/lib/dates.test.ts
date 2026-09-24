import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBirthday, daysUntil, nextOccurrence, ageTurning, birthdayPhrase, upcomingBirthday, timeAgo,
} from './dates.ts';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 15, 30);

test('parseBirthday', () => {
  assert.deepEqual(parseBirthday('1990-03-05'), { month: 3, day: 5, year: 1990 });
  assert.equal(parseBirthday('0004-02-29')?.year, null);
  assert.equal(parseBirthday('nope'), null);
  assert.equal(parseBirthday(null), null);
});

test('daysUntil: today, tomorrow, later', () => {
  const b = parseBirthday('2001-09-24')!;
  assert.equal(daysUntil(b, d(2026, 9, 24)), 0);
  assert.equal(daysUntil(b, d(2026, 9, 23)), 1);
  assert.equal(daysUntil(b, d(2026, 9, 25)), 364);
});

test('year rollover', () => {
  const b = parseBirthday('2001-01-02')!;
  assert.equal(daysUntil(b, d(2026, 12, 30)), 3);
  assert.equal(nextOccurrence(b, d(2026, 12, 30)).getFullYear(), 2027);
  assert.equal(ageTurning(b, d(2026, 12, 30)), 26);
});

test('Feb 29 → Feb 28 in non-leap years, Feb 29 in leap years', () => {
  const b = parseBirthday('2000-02-29')!;
  const n = nextOccurrence(b, d(2026, 2, 1));
  assert.equal(n.getMonth(), 1);
  assert.equal(n.getDate(), 28);
  assert.equal(nextOccurrence(b, d(2027, 3, 1)).getDate(), 29); // 2028 is leap
  assert.equal(daysUntil(b, d(2027, 2, 27)), 1);
});

test('DST does not shift day counts', () => {
  const b = parseBirthday('1980-04-01')!;
  assert.equal(daysUntil(b, d(2026, 3, 20)), 12);
});

test('age unknown when year unknown', () => {
  assert.equal(ageTurning(parseBirthday('0004-05-05')!, d(2026, 1, 1)), null);
});

test('phrases', () => {
  const today = d(2026, 9, 24); // Thursday
  const b = parseBirthday('2000-09-26')!;
  assert.equal(birthdayPhrase('Lucia', 0, today), "Today is Lucia's birthday");
  assert.equal(birthdayPhrase('Lucia', 1, today), "Tomorrow is Lucia's birthday");
  assert.equal(birthdayPhrase('Lucia', 2, today, b), "On Saturday it is Lucia's birthday, 26 years old");
  assert.equal(birthdayPhrase('Lucia', 9, today), "On 3 October it is Lucia's birthday");
});

test('upcomingBirthday picks nearest within window', () => {
  const people = [
    { name: 'A', birthday: '2000-09-30' },
    { name: 'B', birthday: '2000-09-25' },
    { name: 'C', birthday: null },
    { name: 'D', birthday: '2000-12-01' },
  ];
  assert.equal(upcomingBirthday(people, d(2026, 9, 24))?.person.name, 'B');
  assert.equal(upcomingBirthday(people, d(2026, 10, 20)), null);
});

test('timeAgo', () => {
  const now = d(2026, 9, 24);
  assert.equal(timeAgo(d(2026, 9, 24), now), 'today');
  assert.equal(timeAgo(d(2026, 9, 23), now), 'yesterday');
  assert.equal(timeAgo(d(2026, 9, 21), now), '3 days ago');
});
