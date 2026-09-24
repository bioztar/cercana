import test from 'node:test';
import assert from 'node:assert/strict';
import { aboutOf, authorOf, sliceFor } from './feed.ts';
import type { Moment, Person } from './types.ts';

const person = (id: string, name: string): Person => ({
  id, circle_id: 'c', name, relation: null, phone: null, photo_url: null, birthday: null, role: 'member', claimed: true,
});
const people = [person('a', 'Anna'), person('p', 'Pedro'), person('l', 'Lucia')];
const moment = (id: string, o: Partial<Moment>): Moment => ({
  id, circle_id: 'c', person_id: null, author_person_id: null, author: null, body: id, photo_url: null, audio_url: null,
  created_at: `2026-09-2${id}T10:00:00Z`, ...o,
});

test('authorOf: by id, then by name, else null', () => {
  assert.equal(authorOf(moment('1', { author_person_id: 'p' }), people)?.name, 'Pedro');
  assert.equal(authorOf(moment('1', { author: '  anna ' }), people)?.name, 'Anna'); // legacy moment, name only
  assert.equal(authorOf(moment('1', { author_person_id: 'gone', author: 'Lucia' }), people)?.name, 'Lucia');
  assert.equal(authorOf(moment('1', { author: 'Stranger' }), people), null);
  assert.equal(authorOf(moment('1', {}), people), null);
});

test('aboutOf: only when it concerns someone other than the author', () => {
  assert.equal(aboutOf(moment('1', { person_id: 'l', author_person_id: 'a' }), people)?.name, 'Lucia');
  assert.equal(aboutOf(moment('1', { person_id: 'a', author_person_id: 'a' }), people), null);
  assert.equal(aboutOf(moment('1', { author_person_id: 'a' }), people), null);
});

test('sliceFor: by or about, newest first', () => {
  const all = [
    moment('1', { person_id: 'l', author_person_id: 'a' }),
    moment('2', { person_id: 'a', author_person_id: 'p' }),
    moment('3', { person_id: 'p', author_person_id: 'p' }),
    moment('4', { person_id: null, author_person_id: 'a' }),
  ];
  assert.deepEqual(sliceFor('a', all).map((m) => m.id), ['4', '2', '1']);
  assert.deepEqual(sliceFor('l', all).map((m) => m.id), ['1']);
  assert.deepEqual(sliceFor('nobody', all), []);
});
