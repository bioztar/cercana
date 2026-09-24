import test from 'node:test';
import assert from 'node:assert/strict';
import { toEventRow, toEventRows } from './deviceCalendar.ts';

test('toEventRow maps device event to an events upsert row', () => {
  const row = toEventRow({
    id: 'ABC-123', title: 'Kindergarten show', location: 'School', allDay: false,
    startDate: new Date(2026, 9, 2, 10, 0), endDate: new Date(2026, 9, 2, 11, 0),
  });
  assert.equal(row.uid, 'ABC-123');
  assert.equal(row.title, 'Kindergarten show');
  assert.equal(row.all_day, false);
  assert.equal(row.starts_at, new Date(2026, 9, 2, 10, 0).toISOString());
});

test('toEventRow: no end date, all-day defaults', () => {
  const row = toEventRow({ id: 'x', title: null, location: null, startDate: '2026-10-02T00:00:00.000Z', endDate: null });
  assert.equal(row.ends_at, null);
  assert.equal(row.all_day, false);
});

test('toEventRows drops events with no id', () => {
  const rows = toEventRows([
    { id: '', title: 'no id', location: null, startDate: new Date(), endDate: null },
    { id: 'ok', title: 'has id', location: null, startDate: new Date(), endDate: null },
  ]);
  assert.deepEqual(rows.map((r) => r.uid), ['ok']);
});
