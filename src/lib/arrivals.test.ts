import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalFromComment, arrivalFromMoment, enqueueArrival, spokenForComment, spokenForMoment } from './arrivals.ts';
import type { Comment, Moment, Person } from './types.ts';

const person = (id: string, name: string, relation: string | null = null): Person => ({
  id, circle_id: 'c', name, relation, phone: null, photo_url: `${id}.jpg`, birthday: null, role: 'member', claimed: true,
});
const people = [person('pedro', 'Pedro', 'your son'), person('anna', 'Anna', 'your daughter-in-law')];

const moment = (o: Partial<Moment>): Moment => ({
  id: 'm1', circle_id: 'c', person_id: null, author_person_id: 'pedro', author: 'Pedro', body: null,
  photo_url: null, audio_url: null, created_at: '2026-09-24T10:00:00Z', by_patient: false, ...o,
});
const comment = (o: Partial<Comment>): Comment => ({
  id: 'c1', moment_id: 'm1', circle_id: 'c', author_person_id: 'pedro', author_name: 'Pedro', body: null,
  audio_url: null, created_at: '2026-09-24T10:00:00Z', ...o,
});

test('spokenForMoment: voice > text > photo-only', () => {
  assert.equal(spokenForMoment('Pedro', { audio_url: 'a.mp3', body: 'hi' }), 'New voice message from Pedro.');
  assert.equal(spokenForMoment('Pedro', { audio_url: null, body: 'On our way' }), 'Pedro says: On our way');
  assert.equal(spokenForMoment('Pedro', { audio_url: null, body: null }), 'Pedro sent you a photo');
});

test('spokenForComment: voice > text', () => {
  assert.equal(spokenForComment('Anna', { audio_url: 'a.mp3', body: null }), 'Anna replied with a voice message.');
  assert.equal(spokenForComment('Anna', { audio_url: null, body: 'Looking forward!' }), 'Anna replied: Looking forward!');
});

test('arrivalFromMoment: null when authored by this device (by_patient)', () => {
  assert.equal(arrivalFromMoment(moment({ by_patient: true }), people), null);
});

test('arrivalFromMoment: resolves sender name/relation/avatar and builds the arrival', () => {
  const a = arrivalFromMoment(moment({ audio_url: 'v.mp3' }), people);
  assert.equal(a?.id, 'moment:m1');
  assert.equal(a?.kind, 'moment');
  assert.equal(a?.name, 'Pedro');
  assert.equal(a?.relation, 'your son');
  assert.equal(a?.photoUrl, 'pedro.jpg');
  assert.equal(a?.audioUrl, 'v.mp3');
  assert.equal(a?.spoken, 'New voice message from Pedro.');
});

test('arrivalFromComment: null for Mom\'s own reply (author_person_id null)', () => {
  assert.equal(arrivalFromComment(comment({ author_person_id: null, author_name: 'Carmen' }), people), null);
});

test('arrivalFromComment: builds "X replied" arrival', () => {
  const a = arrivalFromComment(comment({ body: 'Great!' }), people);
  assert.equal(a?.id, 'comment:c1');
  assert.equal(a?.spoken, 'Pedro replied: Great!');
});

test('enqueueArrival: dedupes by id and skips arrivals at/before the feed watermark', () => {
  const seen = new Set<string>();
  const a1 = arrivalFromMoment(moment({ id: 'm1' }), people)!;
  let q = enqueueArrival([], seen, a1, null);
  assert.equal(q.length, 1);
  q = enqueueArrival(q, seen, a1, null); // realtime + push double-delivery
  assert.equal(q.length, 1);
  const old = arrivalFromMoment(moment({ id: 'm2', created_at: '2020-01-01T00:00:00Z' }), people);
  q = enqueueArrival(q, seen, old, '2026-01-01T00:00:00Z');
  assert.equal(q.length, 1);
});

test('enqueueArrival: ignores a null arrival', () => {
  assert.deepEqual(enqueueArrival([], new Set(), null, null), []);
});
