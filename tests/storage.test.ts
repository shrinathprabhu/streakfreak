import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialize,
  readSnapshot,
  saveHabit,
  saveEntry,
  removeEntry,
  deleteHabit,
  mergeBackup,
} from '../lib/storage.ts';
import {
  createBackup,
  complete,
  entryKey,
  localDate,
  PRESETS,
  shiftDate,
  MAX_NOTE_LENGTH,
  type Habit,
} from '../lib/habits.ts';
const today = localDate();
await test('IndexedDB lifecycle is durable and safe', async (t) => {
  await t.test('initialization is idempotent, even concurrently', async () => {
    await Promise.all([initialize(), initialize()]);
    const state = await readSnapshot();
    assert.equal(state.habits.length, 4);
    assert.equal(state.entries.length, 0);
  });
  const habit: Habit = {
    ...PRESETS[0],
    id: 'test-habit',
    startDate: shiftDate(today, -10),
  };
  await t.test('a habit and check-in survive independent reads', async () => {
    await saveHabit(habit);
    await saveEntry(habit.id, today, 8);
    const state = await readSnapshot();
    assert.equal(state.habits.find((h) => h.id === habit.id)?.target, 8);
    assert.equal(
      state.entries.find((e) => e.id === entryKey(habit.id, today))?.value,
      8,
    );
  });
  await t.test(
    'goal edits preserve historical completion, including later entry edits',
    async () => {
      await saveHabit({ ...habit, target: 10 });
      await saveEntry(habit.id, today, 9);
      const saved = (await readSnapshot()).entries.find(
        (e) => e.id === entryKey(habit.id, today),
      );
      assert.equal(saved?.target, 8);
      assert.equal(complete(saved), true);
      await saveEntry(habit.id, shiftDate(today, -1), 9);
      const newer = (await readSnapshot()).entries.find(
        (e) => e.date === shiftDate(today, -1),
      );
      assert.equal(newer?.target, 10);
      assert.equal(complete(newer), false);
    },
  );
  await t.test(
    'reflections persist, survive amount-only edits, and can be cleared explicitly',
    async () => {
      const note = 'Finished my walk.\nOutcome: a clearer head.';
      await saveEntry(habit.id, today, 9, note);
      assert.equal(
        (await readSnapshot()).entries.find(
          (e) => e.id === entryKey(habit.id, today),
        )?.note,
        note,
      );
      await saveEntry(habit.id, today, 10);
      const changed = (await readSnapshot()).entries.find(
        (e) => e.id === entryKey(habit.id, today),
      );
      assert.equal(changed?.note, note);
      assert.equal(changed?.target, 8);
      await saveEntry(habit.id, today, 10, '');
      const cleared = (await readSnapshot()).entries.find(
        (e) => e.id === entryKey(habit.id, today),
      );
      assert.equal(cleared?.note, '');
      assert.equal(cleared?.value, 10);
    },
  );
  await t.test(
    'legacy imports preserve reflections while explicit imported notes replace them',
    async () => {
      await saveEntry(habit.id, today, 10, 'Keep this outcome.');
      const saved = (await readSnapshot()).entries.find(
        (e) => e.id === entryKey(habit.id, today),
      )!;
      const legacy = { ...saved };
      delete legacy.note;
      await mergeBackup(createBackup({ habits: [habit], entries: [legacy] }));
      assert.equal(
        (await readSnapshot()).entries.find((e) => e.id === legacy.id)?.note,
        'Keep this outcome.',
      );
      await mergeBackup(
        createBackup({
          habits: [habit],
          entries: [{ ...legacy, note: 'Imported reflection.' }],
        }),
      );
      assert.equal(
        (await readSnapshot()).entries.find((e) => e.id === legacy.id)?.note,
        'Imported reflection.',
      );
      await mergeBackup(
        createBackup({ habits: [habit], entries: [{ ...legacy, note: '' }] }),
      );
      assert.equal(
        (await readSnapshot()).entries.find((e) => e.id === legacy.id)?.note,
        '',
      );
    },
  );
  await t.test(
    'invalid writes reject without changing stored data',
    async () => {
      const before = await readSnapshot();
      await assert.rejects(saveEntry(habit.id, today, -1));
      await assert.rejects(saveEntry(habit.id, '2026-02-30', 4));
      await assert.rejects(saveEntry(habit.id, shiftDate(today, 1), 4));
      await assert.rejects(saveEntry('missing', today, 4));
      await assert.rejects(
        saveEntry(habit.id, today, 4, 'a'.repeat(MAX_NOTE_LENGTH + 1)),
      );
      assert.deepEqual(await readSnapshot(), before);
    },
  );
  await t.test(
    'moving a start date cannot strand existing history',
    async () => {
      await assert.rejects(saveHabit({ ...habit, startDate: today }));
      assert.equal(
        (await readSnapshot()).habits.find((h) => h.id === habit.id)?.startDate,
        habit.startDate,
      );
    },
  );
  await t.test('clearing a check-in does not delete its habit', async () => {
    await removeEntry(habit.id, today);
    const state = await readSnapshot();
    assert.equal(
      state.entries.some((e) => e.id === entryKey(habit.id, today)),
      false,
    );
    assert.ok(state.habits.some((h) => h.id === habit.id));
  });
  await t.test(
    'imports merge by stable IDs and preserve unrelated data',
    async () => {
      const other: Habit = { ...PRESETS[3], id: 'imported', startDate: today };
      await mergeBackup(
        createBackup({
          habits: [other],
          entries: [
            {
              id: entryKey(other.id, today),
              habitId: other.id,
              date: today,
              value: 0,
              target: 2,
              direction: 'atMost',
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      );
      const state = await readSnapshot();
      assert.equal(state.habits.length, 6);
      assert.equal(
        complete(state.entries.find((e) => e.habitId === other.id)),
        true,
      );
    },
  );
  await t.test(
    'merge retains earlier local start dates for existing history',
    async () => {
      await mergeBackup(
        createBackup({ habits: [{ ...habit, startDate: today }], entries: [] }),
      );
      assert.equal(
        (await readSnapshot()).habits.find((h) => h.id === habit.id)?.startDate,
        habit.startDate,
      );
    },
  );
  await t.test(
    'deletion removes associated entries in the same transaction',
    async () => {
      await deleteHabit(habit.id);
      const state = await readSnapshot();
      assert.ok(!state.habits.some((h) => h.id === habit.id));
      assert.ok(!state.entries.some((e) => e.habitId === habit.id));
      assert.ok(state.entries.some((e) => e.habitId === 'imported'));
    },
  );
});
