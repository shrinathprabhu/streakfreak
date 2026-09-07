import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarYear,
  complete,
  createBackup,
  daySummary,
  entryKey,
  entryMap,
  habitStreak,
  localDate,
  PRESETS,
  shiftDate,
  streaks,
  toCSV,
  validDate,
  validateBackup,
  validateHabit,
  type Entry,
  type Habit,
  type Snapshot,
} from '../lib/habits.ts';
const habit: Habit = { ...PRESETS[0], id: 'water', startDate: '2026-01-01' };
function entry(date: string, value = 8, overrides: Partial<Entry> = {}): Entry {
  return {
    id: entryKey(habit.id, date),
    habitId: habit.id,
    date,
    value,
    target: 8,
    direction: 'atLeast',
    updatedAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}
await test('local dates retain the local calendar day', () => {
  assert.equal(localDate(new Date(2026, 0, 2, 0, 1)), '2026-01-02');
});
await test('calendar arithmetic crosses leap days and year boundaries', () => {
  assert.equal(shiftDate('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftDate('2024-02-29', 1), '2024-03-01');
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
});
await test('calendar arithmetic survives daylight saving transitions', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    assert.equal(shiftDate('2026-03-08', 1), '2026-03-09');
    assert.equal(shiftDate('2026-11-01', 1), '2026-11-02');
  } finally {
    process.env.TZ = previous;
  }
});
await test('calendar includes each day exactly once and pads full weeks', () => {
  for (const year of [2024, 2026, 2012]) {
    const days = calendarYear(year);
    const dates = days.filter(Boolean);
    assert.equal(dates.length, year % 4 === 0 ? 366 : 365);
    assert.equal(new Set(dates).size, dates.length);
    assert.equal(days.length % 7, 0);
    assert.equal(dates[0], `${year}-01-01`);
    assert.equal(dates.at(-1), `${year}-12-31`);
  }
  assert.equal(calendarYear(2012).length, 378);
});
await test('at-most goals require an explicit entry and accept zero', () => {
  assert.equal(complete(undefined), false);
  assert.equal(
    complete(entry('2026-01-01', 0, { target: 2, direction: 'atMost' })),
    true,
  );
  assert.equal(
    complete(entry('2026-01-01', 2, { target: 2, direction: 'atMost' })),
    true,
  );
  assert.equal(
    complete(entry('2026-01-01', 2.1, { target: 2, direction: 'atMost' })),
    false,
  );
});
await test('at-least goals count only after reaching target', () => {
  assert.equal(complete(entry('2026-01-01', 7.5)), false);
  assert.equal(complete(entry('2026-01-01', 8)), true);
  assert.equal(complete(entry('2026-01-01', 9)), true);
});
await test('today can remain incomplete without breaking yesterday’s streak', () => {
  assert.deepEqual(streaks(['2026-09-05', '2026-09-06'], '2026-09-07'), {
    current: 2,
    best: 2,
  });
});
await test('gaps break the current streak but retain best', () => {
  assert.deepEqual(
    streaks(
      ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-07'],
      '2026-09-07',
    ),
    { current: 1, best: 3 },
  );
  assert.deepEqual(streaks(['2026-09-04'], '2026-09-07'), {
    current: 0,
    best: 1,
  });
});
await test('multiple completed habits in a day count as a single streak day', () => {
  assert.deepEqual(
    streaks(
      ['2026-09-06', '2026-09-06', '2026-09-07', '2026-09-08'],
      '2026-09-07',
    ),
    { current: 2, best: 2 },
  );
});
await test('habit streak ignores other habits and incomplete check-ins', () => {
  assert.deepEqual(
    habitStreak(
      habit,
      [
        entry('2026-09-05'),
        entry('2026-09-06', 2),
        entry('2026-09-07', 8, { habitId: 'other' }),
      ],
      '2026-09-07',
    ),
    { current: 0, best: 1 },
  );
});
await test('heatmap intensity uses only habits scheduled that day', () => {
  const upcoming = { ...habit, id: 'later', startDate: '2026-09-08' };
  assert.deepEqual(
    daySummary(
      [habit, upcoming],
      entryMap([entry('2026-09-07')]),
      '2026-09-07',
    ),
    { due: 1, done: 1, level: 4 },
  );
});
await test('validates impossible dates and future habit start dates', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-13-01'), false);
  assert.throws(() =>
    validateHabit({ ...habit, startDate: '2027-01-01' }, '2026-09-07'),
  );
});
await test('JSON backup round trip retains goals and check-in snapshots', () => {
  const snapshot: Snapshot = {
    habits: [habit],
    entries: [entry('2026-09-07')],
  };
  const result = validateBackup(
    JSON.parse(JSON.stringify(createBackup(snapshot))),
    '2026-09-07',
  );
  assert.deepEqual(result.habits, snapshot.habits);
  assert.deepEqual(result.entries, snapshot.entries);
});
await test('invalid backup versions, orphan entries, and duplicate IDs are rejected', () => {
  const backup = createBackup({
    habits: [habit],
    entries: [entry('2026-09-07')],
  });
  assert.throws(() => validateBackup({ ...backup, version: 99 }));
  assert.throws(() => validateBackup({ ...backup, habits: [] }));
  assert.throws(() => validateBackup({ ...backup, habits: [habit, habit] }));
  assert.throws(() =>
    validateBackup({
      ...backup,
      entries: [...backup.entries, ...backup.entries],
    }),
  );
});
await test('invalid numeric amounts, dates, and goals cannot be imported', () => {
  const backup = createBackup({
    habits: [habit],
    entries: [entry('2026-09-07')],
  });
  for (const amount of [-1, NaN, Infinity, 1000001])
    assert.throws(() =>
      validateBackup({
        ...backup,
        entries: [{ ...backup.entries[0], value: amount }],
      }),
    );
  assert.throws(() =>
    validateBackup({ ...backup, habits: [{ ...habit, target: 0 }] }),
  );
  assert.throws(() =>
    validateBackup({ ...backup, entries: [entry('2026-02-30')] }),
  );
  assert.throws(() =>
    validateBackup({ ...backup, entries: [entry('2027-01-01')] }, '2026-09-07'),
  );
});
await test('CSV escapes commas, quotes, line breaks, and spreadsheet formulas', () => {
  const csv = toCSV({
    habits: [
      { ...habit, name: '=HYPERLINK("bad")', description: 'one, two\nthree' },
    ],
    entries: [entry('2026-09-07')],
  });
  assert.ok(csv.includes(`"'=HYPERLINK(""bad"")"`));
  assert.ok(csv.includes('"one, two\nthree"'));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"true"'));
});
await test('CSV retains habits with no entries', () => {
  const csv = toCSV({ habits: [habit], entries: [] });
  assert.ok(csv.includes('"Stay hydrated"'));
  assert.equal(csv.split('\r\n').length, 2);
});
