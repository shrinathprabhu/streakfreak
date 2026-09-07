import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  entriesByHabit,
  habitStreak,
  PRESETS,
  shiftDate,
} from '../lib/habits.ts';

// Synthetic local data only. This measures computation, not browser Web Vitals.
const habits = Array.from({ length: 500 }, (_, i) => ({
  ...PRESETS[0],
  id: String(i),
  startDate: '2025-08-04',
}));
const dates = Array.from({ length: 400 }, (_, i) => shiftDate('2025-08-04', i));
const entries = habits.flatMap((h) =>
  dates.map((date, i) => ({
    id: `${h.id}:${date}`,
    habitId: h.id,
    date,
    value: i % 5 ? 8 : 4,
    target: 8,
    direction: 'atLeast',
    updatedAt: `${date}T12:00:00.000Z`,
  })),
);
const today = dates.at(-1);
const oldRuns = () => habits.map((h) => habitStreak(h, entries, today));
const groupedRuns = () => {
  const grouped = entriesByHabit(entries);
  return habits.map((h) => habitStreak(h, grouped.get(h.id) ?? [], today));
};
assert.deepEqual(groupedRuns(), oldRuns());
const samples = (fn) => {
  fn();
  return Array.from({ length: 3 }, () => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  }).sort((a, b) => a - b)[1];
};
const parsed = dates.slice(0, 365).map((date) => new Date(`${date}T12:00:00`));
const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' });
const result = {
  dataset: { habits: habits.length, entries: entries.length },
  medianMs: {
    fullHistoryScanPerHabit: samples(oldRuns),
    groupedHistory: samples(groupedRuns),
    perCellDateFormatter: samples(() =>
      parsed.map((d) => d.toLocaleDateString('en-US', { dateStyle: 'full' })),
    ),
    reusedDateFormatter: samples(() => parsed.map((d) => formatter.format(d))),
  },
};
console.log(
  JSON.stringify(
    result,
    (_, value) =>
      typeof value === 'number' ? Math.round(value * 100) / 100 : value,
    2,
  ),
);
