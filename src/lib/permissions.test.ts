import test from 'node:test';
import assert from 'node:assert/strict';
import { actorFor, can, type Action, type Actor, type PersonTarget } from './permissions.ts';

const lead: Actor = { kind: 'member', id: 'L', role: 'lead' };
const admin: Actor = { kind: 'member', id: 'A', role: 'admin' };
const member: Actor = { kind: 'member', id: 'M', role: 'member' };
const drifter: Actor = { kind: 'member', id: null, role: 'member' }; // family device that has not claimed a profile
const patient: Actor = { kind: 'patient' };

const t = (id: string, role: PersonTarget['role'] = 'member', claimed = true): PersonTarget => ({ id, role, claimed });
const check = (a: Actor, action: Action) => can(a, action);

test('patient device is view-only for every action', () => {
  const actions: Action[] = [
    { type: 'person.add' }, { type: 'person.edit', target: t('P') }, { type: 'person.remove', target: t('P') },
    { type: 'person.setRole', target: t('P'), role: 'admin' }, { type: 'lead.handover', target: t('P') },
    { type: 'invite.share' }, { type: 'calendar.add', personIds: ['P'] }, { type: 'calendar.remove', personIds: ['P'] },
    { type: 'calendar.refresh' }, { type: 'moment.post' }, { type: 'moment.delete' }, { type: 'ping.send' },
  ];
  for (const a of actions) assert.equal(check(patient, a), false, a.type);
});

test('everyone can always edit their own profile; members cannot edit others', () => {
  assert.equal(check(member, { type: 'person.edit', target: t('M') }), true);
  assert.equal(check(member, { type: 'person.edit', target: t('X') }), false);
  assert.equal(check(drifter, { type: 'person.edit', target: t('X') }), false);
  assert.equal(check(admin, { type: 'person.edit', target: t('X') }), true);
  assert.equal(check(admin, { type: 'person.edit', target: t('L', 'lead') }), true);
  assert.equal(check(lead, { type: 'person.edit', target: t('X') }), true);
});

test('editBrief: Mom (patient device), lead/admin — not plain members or an unclaimed device', () => {
  assert.equal(check(patient, { type: 'editBrief' }), true);
  assert.equal(check(lead, { type: 'editBrief' }), true);
  assert.equal(check(admin, { type: 'editBrief' }), true);
  assert.equal(check(member, { type: 'editBrief' }), false);
  assert.equal(check(drifter, { type: 'editBrief' }), false);
});

test('viewCheckin: creator + lead/admin only, never a plain member or the patient device', () => {
  assert.equal(check(lead, { type: 'viewCheckin', creatorId: 'M' }), true); // lead sees any
  assert.equal(check(admin, { type: 'viewCheckin', creatorId: 'M' }), true);
  assert.equal(check(member, { type: 'viewCheckin', creatorId: 'M' }), true); // creator sees their own
  assert.equal(check(member, { type: 'viewCheckin', creatorId: 'X' }), false); // not the creator
  assert.equal(check(drifter, { type: 'viewCheckin', creatorId: null }), false);
  assert.equal(check(patient, { type: 'viewCheckin', creatorId: 'M' }), false);
});

test('adding people, inviting, refreshing calendars, deleting moments: staff only', () => {
  for (const type of ['person.add', 'invite.share', 'calendar.refresh', 'moment.delete'] as const) {
    assert.equal(check(lead, { type }), true, `lead ${type}`);
    assert.equal(check(admin, { type }), true, `admin ${type}`);
    assert.equal(check(member, { type }), false, `member ${type}`);
  }
});

test('posting moments and pings: every family member', () => {
  for (const a of [lead, admin, member, drifter]) {
    assert.equal(check(a, { type: 'moment.post' }), true);
    assert.equal(check(a, { type: 'ping.send' }), true);
  }
});

test('calendars: staff any; members only when linked solely to themselves', () => {
  assert.equal(check(admin, { type: 'calendar.add', personIds: ['X', 'Y'] }), true);
  assert.equal(check(member, { type: 'calendar.add', personIds: ['M'] }), true);
  assert.equal(check(member, { type: 'calendar.add', personIds: ['M', 'X'] }), false);
  assert.equal(check(member, { type: 'calendar.add', personIds: ['X'] }), false);
  assert.equal(check(member, { type: 'calendar.add', personIds: [] }), false);
  assert.equal(check(member, { type: 'calendar.remove', personIds: ['M'] }), true);
  assert.equal(check(member, { type: 'calendar.remove', personIds: ['X'] }), false);
  assert.equal(check(drifter, { type: 'calendar.add', personIds: ['M'] }), false);
});

test('removing people: lead only, never the lead profile', () => {
  assert.equal(check(lead, { type: 'person.remove', target: t('X') }), true);
  assert.equal(check(lead, { type: 'person.remove', target: t('L', 'lead') }), false);
  assert.equal(check(admin, { type: 'person.remove', target: t('X') }), false);
  assert.equal(check(member, { type: 'person.remove', target: t('M') }), false);
});

test('roles: lead makes/unmakes admins, not on themselves, never on the lead', () => {
  assert.equal(check(lead, { type: 'person.setRole', target: t('X'), role: 'admin' }), true);
  assert.equal(check(lead, { type: 'person.setRole', target: t('A', 'admin'), role: 'member' }), true);
  assert.equal(check(lead, { type: 'person.setRole', target: t('L', 'lead'), role: 'member' }), false);
  assert.equal(check(admin, { type: 'person.setRole', target: t('X'), role: 'admin' }), false);
  assert.equal(check(member, { type: 'person.setRole', target: t('X'), role: 'admin' }), false);
});

test('hand-over: lead → another claimed non-lead person only', () => {
  assert.equal(check(lead, { type: 'lead.handover', target: t('A', 'admin') }), true);
  assert.equal(check(lead, { type: 'lead.handover', target: t('X', 'member', false) }), false); // unclaimed profile
  assert.equal(check(lead, { type: 'lead.handover', target: t('L', 'lead') }), false); // themselves
  assert.equal(check(admin, { type: 'lead.handover', target: t('X') }), false);
  assert.equal(check(member, { type: 'lead.handover', target: t('X') }), false);
});

test('actorFor: patient, claimed family member, unclaimed family device', () => {
  const people = [{ id: 'L', role: 'lead' as const }, { id: 'M', role: 'member' as const }];
  assert.deepEqual(actorFor({ role: 'patient' }, people), { kind: 'patient' });
  assert.deepEqual(actorFor({ role: 'family', memberId: 'L' }, people), { kind: 'member', id: 'L', role: 'lead' });
  assert.deepEqual(actorFor({ role: 'family' }, people), { kind: 'member', id: null, role: 'member' });
  assert.deepEqual(actorFor({ role: 'family', memberId: 'gone' }, people), { kind: 'member', id: null, role: 'member' });
});
