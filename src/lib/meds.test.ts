import test from 'node:test';
import assert from 'node:assert/strict';
import { doseStatus, dueDoseNow, nextDose, snoozeUntil, spokenLine, statusLabel, todaysDoses } from './meds.ts';
import type { Medication, MedicationLog } from './types.ts';

const now = new Date(2026, 8, 29, 9, 30); // Tuesday 29 Sep 2026, 09:30 local

const med = (id: string, name: string, times: string[], active = true): Medication => ({
  id, circle_id: 'c', name, dose: '1 pill', times, active, created_by_person_id: null, created_at: now.toISOString(),
});

const log = (medicationId: string, scheduledFor: Date, status: MedicationLog['status'], answeredAt = scheduledFor): MedicationLog => ({
  id: 'l', circle_id: 'c', medication_id: medicationId, scheduled_for: scheduledFor.toISOString(), status, answered_at: answeredAt.toISOString(),
});

test('doseStatus: upcoming before, due within the window, missed after', () => {
  const at = new Date(2026, 8, 29, 8, 0);
  assert.equal(doseStatus(at, null, new Date(2026, 8, 29, 7, 59)), 'upcoming');
  assert.equal(doseStatus(at, null, new Date(2026, 8, 29, 8, 0)), 'due');
  assert.equal(doseStatus(at, null, new Date(2026, 8, 29, 9, 0)), 'due');
  assert.equal(doseStatus(at, null, new Date(2026, 8, 29, 9, 1)), 'missed');
});

test('doseStatus: a log always wins, regardless of time', () => {
  const at = new Date(2026, 8, 29, 8, 0);
  assert.equal(doseStatus(at, log('m', at, 'taken'), new Date(2026, 8, 29, 20, 0)), 'taken');
  assert.equal(doseStatus(at, log('m', at, 'skipped'), now), 'skipped');
});

test('todaysDoses: one row per active medicine per time, sorted, inactive skipped', () => {
  const bp = med('bp', 'Blood pressure pill', ['08:00', '20:00']);
  const memory = med('mem', 'Memory pill', ['09:00']);
  const off = med('off', 'Old pill', ['06:00'], false);
  const taken = log('bp', new Date(2026, 8, 29, 8, 0), 'taken', new Date(2026, 8, 29, 8, 4));
  const doses = todaysDoses([bp, memory, off], [taken], now);
  assert.deepEqual(doses.map((d) => `${d.medication.id}@${d.time}`), ['bp@08:00', 'mem@09:00', 'bp@20:00']);
  assert.equal(doses[0].status, 'taken');
  assert.equal(doses[1].status, 'due'); // 09:00, now is 09:30
  assert.equal(doses[2].status, 'upcoming');
});

test('nextDose: first open dose (due/missed/upcoming), null once everything is answered', () => {
  const bp = med('bp', 'Blood pressure pill', ['08:00']);
  const takenDose = todaysDoses([bp], [log('bp', new Date(2026, 8, 29, 8, 0), 'taken')], now);
  assert.equal(nextDose(takenDose), null);
  const openDose = todaysDoses([bp], [], now);
  assert.equal(nextDose(openDose)?.time, '08:00');
});

test('dueDoseNow: only a due dose, and not one snoozed past now', () => {
  const bp = med('bp', 'Blood pressure pill', ['09:00']);
  const doses = todaysDoses([bp], [], now); // due: 09:00, now 09:30
  const due = dueDoseNow(doses, now);
  assert.equal(due?.time, '09:00');
  const snoozed = { [doses[0].key]: new Date(now.getTime() + 15 * 60_000).toISOString() };
  assert.equal(dueDoseNow(doses, now, snoozed), null);
  assert.equal(dueDoseNow(doses, new Date(now.getTime() + 16 * 60_000), snoozed)?.time, '09:00');
});

test('snoozeUntil: 30 minutes ahead', () => {
  const at = snoozeUntil(now);
  assert.equal(new Date(at).getTime() - now.getTime(), 30 * 60_000);
});

test('spokenLine and statusLabel', () => {
  const bp = med('bp', 'Blood pressure pill', ['08:00']);
  const doses = todaysDoses([bp], [log('bp', new Date(2026, 8, 29, 8, 0), 'taken', new Date(2026, 8, 29, 8, 4))], now);
  assert.equal(spokenLine(doses[0]), 'Time for your Blood pressure pill, 1 pill');
  assert.equal(statusLabel(doses[0]), 'taken 8:04 am');
  const open = todaysDoses([bp], [], now);
  assert.equal(statusLabel(open[0]), 'missed');
});
