import test from 'node:test';
import assert from 'node:assert/strict';
import { describeMedChange, followUpEvent, pendingCount, planMedChange, visitForPatient, withStatus } from './visit.ts';
import type { MedChange, Medication, Proposals, Visit } from './types.ts';

const med = (id: string, name: string, active = true): Medication => ({
  id, circle_id: 'c', name, dose: '1 pill', times: ['08:00'], active, created_by_person_id: null, created_at: '2026-01-01T00:00:00Z',
});
const chg = (o: Partial<MedChange>): MedChange => ({ action: 'add', name: 'X', dose: '5 mg', times: [], status: 'pending', ...o });
const meds = [med('a', 'Memory pill'), med('b', 'Old pill', false)];

test('add creates; add without dose does nothing', () => {
  assert.deepEqual(planMedChange(chg({ name: 'Amlodipine', times: ['08:00'] }), meds), {
    kind: 'create', input: { name: 'Amlodipine', dose: '5 mg', times: ['08:00'] },
  });
  assert.equal(planMedChange(chg({ dose: '' }), meds).kind, 'none');
});

test('stop deactivates an active match (case-insensitive); unknown or inactive = none', () => {
  assert.deepEqual(planMedChange(chg({ action: 'stop', name: ' memory PILL ', dose: '' }), meds), {
    kind: 'update', id: 'a', patch: { active: false },
  });
  assert.equal(planMedChange(chg({ action: 'stop', name: 'Old pill', dose: '' }), meds).kind, 'none');
  assert.equal(planMedChange(chg({ action: 'stop', name: 'Nope', dose: '' }), meds).kind, 'none');
});

test('change patches only what was said; unknown medicine falls back to create', () => {
  assert.deepEqual(planMedChange(chg({ action: 'change', name: 'Memory pill', dose: '2 pills', times: [] }), meds), {
    kind: 'update', id: 'a', patch: { dose: '2 pills' },
  });
  assert.deepEqual(planMedChange(chg({ action: 'change', name: 'Memory pill', dose: '', times: ['20:00'] }), meds), {
    kind: 'update', id: 'a', patch: { times: ['20:00'] },
  });
  assert.equal(planMedChange(chg({ action: 'change', name: 'New one' }), meds).kind, 'create');
});

test('followUpEvent lasts one hour', () => {
  const e = followUpEvent({ title: 'Cardiology', starts_at: '2026-10-01T09:00:00.000Z', status: 'pending' });
  assert.equal(e.ends_at, '2026-10-01T10:00:00.000Z');
  assert.equal(e.all_day, false);
});

test('withStatus is immutable and pendingCount counts only pending', () => {
  const p: Proposals = { med_changes: [chg({}), chg({ name: 'Y' })], follow_ups: [{ title: 't', starts_at: '2026-10-01T09:00:00.000Z', status: 'pending' }] };
  const q = withStatus(p, 'med_changes', 0, 'approved');
  assert.equal(p.med_changes[0].status, 'pending');
  assert.equal(q.med_changes[0].status, 'approved');
  assert.equal(withStatus(p, 'follow_ups', 5, 'skipped'), p);
  assert.equal(pendingCount({ proposals: q }), 2);
});

test('visitForPatient: newest within 7 days only', () => {
  const now = new Date('2026-09-26T12:00:00Z');
  const v = (id: string, created_at: string) => ({ id, created_at }) as Visit;
  assert.equal(visitForPatient([v('old', '2026-09-10T00:00:00Z')], now), null);
  assert.equal(visitForPatient([v('a', '2026-09-24T00:00:00Z'), v('b', '2026-09-25T00:00:00Z')], now)?.id, 'b');
});

test('describeMedChange reads plainly', () => {
  assert.equal(describeMedChange(chg({ times: ['08:00'] })), 'Add X — 5 mg, at 08:00');
  assert.equal(describeMedChange(chg({ action: 'stop', name: 'Memory pill', dose: '' })), 'Stop Memory pill');
});
