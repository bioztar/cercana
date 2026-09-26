import test from 'node:test';
import assert from 'node:assert/strict';
import { chatSummaries, lastLine, messageText, threadMessages, unreadIds, visibleChatPeople } from './chats.ts';
import type { Message, Person } from './types.ts';

const person = (id: string): Person =>
  ({ id, circle_id: 'c', name: id, relation: null, phone: null, photo_url: null, birthday: null, role: 'member', claimed: true }) as Person;
const msg = (id: string, personId: string, fromPatient: boolean, at: string, extra: Partial<Message> = {}): Message => ({
  id, circle_id: 'c', person_id: personId, from_patient: fromPatient, body: null, audio_url: null, transcript: null,
  created_at: at, read_at: null, ...extra,
});

test('messageText prefers typed text, then transcript, else null', () => {
  assert.equal(messageText(msg('a', 'p', true, '1', { body: ' hi ', transcript: 'x' })), 'hi');
  assert.equal(messageText(msg('a', 'p', true, '1', { transcript: 'hello there' })), 'hello there');
  assert.equal(messageText(msg('a', 'p', true, '1', { audio_url: 'u' })), null);
});

test('lastLine falls back to a voice-note label', () => {
  assert.equal(lastLine(msg('a', 'p', true, '1', { audio_url: 'u' })), '🎤 Voice message');
  assert.equal(lastLine(msg('a', 'p', true, '1', { body: 'see you' })), 'see you');
});

test('threadMessages filters one pair and sorts oldest first', () => {
  const all = [msg('2', 'p', true, '2026-01-02'), msg('1', 'p', false, '2026-01-01'), msg('3', 'q', true, '2026-01-03')];
  assert.deepEqual(threadMessages(all, 'p').map((m) => m.id), ['1', '2']);
});

test('unreadIds: patient reads family messages, family reads Mom\'s; read ones and other threads excluded', () => {
  const all = [
    msg('1', 'p', false, '1'), msg('2', 'p', true, '2'), msg('3', 'p', false, '3', { read_at: 'x' }), msg('4', 'q', false, '4'),
  ];
  assert.deepEqual(unreadIds(all, 'p', 'patient'), ['1']);
  assert.deepEqual(unreadIds(all, 'p', 'family'), ['2']);
});

test('chatSummaries: newest activity first, silent people last, unread counted per viewer', () => {
  const people = [person('a'), person('b'), person('c')];
  const all = [msg('1', 'b', false, '2026-01-01'), msg('2', 'a', false, '2026-01-02'), msg('3', 'a', false, '2026-01-03')];
  const r = chatSummaries(people, all, 'patient');
  assert.deepEqual(r.map((x) => x.person.id), ['a', 'b', 'c']);
  assert.deepEqual(r.map((x) => x.unread), [2, 1, 0]);
  assert.equal(r[2].last, null);
  assert.equal(chatSummaries(people, all, 'family')[0].unread, 0);
});

test('visibleChatPeople: staff see all, a member only their own, an unclaimed device none', () => {
  const people = [person('a'), person('b')];
  assert.equal(visibleChatPeople(people, 'a', true).length, 2);
  assert.deepEqual(visibleChatPeople(people, 'b', false).map((p) => p.id), ['b']);
  assert.equal(visibleChatPeople(people, null, false).length, 0);
});
