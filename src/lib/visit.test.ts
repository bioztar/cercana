import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTimes, doseSupported, parseVisit } from '../../supabase/functions/_shared/visit.ts';

const T = 'The doctor said start amlodipine 5 milligrams every morning, and stop the memory pill. Come back on Tuesday.';

test('doseSupported: numbers must have been said (digits or words)', () => {
  assert.equal(doseSupported('5 mg', T), true);
  assert.equal(doseSupported('10 mg', T), false);
  assert.equal(doseSupported('one pill', 'take one pill daily'), true);
  assert.equal(doseSupported('1 pill', 'take one pill daily'), true);
  assert.equal(doseSupported('2,5 mg', 'dos coma 5? no: 2,5 mg'), true);
  assert.equal(doseSupported('a pill', 'anything'), true); // no numbers to check
});

test('cleanTimes keeps valid HH:MM, dedupes, sorts, caps at 4', () => {
  assert.deepEqual(cleanTimes(['20:00', '08:00', '08:00', '25:00', 'x', 7]), ['08:00', '20:00']);
  assert.deepEqual(cleanTimes('08:00'), []);
  assert.equal(cleanTimes(['01:00', '02:00', '03:00', '04:00', '05:00']).length, 4);
});

test('parseVisit keeps supported proposals and drops malformed / invented ones', () => {
  const r = parseVisit(
    {
      summary: 'BP is high.',
      patient_summary: 'All is well.',
      med_changes: [
        { action: 'add', name: 'Amlodipine', dose: '5 mg', times: ['08:00'] },
        { action: 'add', name: 'Invented', dose: '40 mg', times: [] }, // 40 never said
        { action: 'add', name: 'NoDose', dose: '', times: [] },
        { action: 'stop', name: 'Memory pill', dose: '', times: [] },
        { action: 'delete', name: 'Bad', dose: '5', times: [] },
        'junk',
      ],
      follow_ups: [
        { title: 'Doctor check', starts_at: '2026-09-29T10:00:00+02:00' },
        { title: 'No date', starts_at: 'sometime' },
        { title: '', starts_at: '2026-09-29T10:00:00+02:00' },
      ],
    },
    T,
  );
  assert.ok(r);
  assert.deepEqual(r.med_changes.map((m) => [m.action, m.name, m.status]), [
    ['add', 'Amlodipine', 'pending'],
    ['stop', 'Memory pill', 'pending'],
  ]);
  assert.equal(r.follow_ups.length, 1);
  assert.equal(r.follow_ups[0].starts_at, '2026-09-29T08:00:00.000Z');
});

test('parseVisit: no summary = unusable; patient_summary falls back to summary', () => {
  assert.equal(parseVisit({ summary: '  ' }, T), null);
  assert.equal(parseVisit(null, T), null);
  assert.equal(parseVisit({ summary: 'Fine.' }, T)?.patient_summary, 'Fine.');
});

test('change needs a dose or times', () => {
  const r = parseVisit({ summary: 's', med_changes: [{ action: 'change', name: 'X', dose: '', times: [] }] }, T);
  assert.equal(r?.med_changes.length, 0);
});
