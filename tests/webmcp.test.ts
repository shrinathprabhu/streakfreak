import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHabitTools, type Tool } from '../lib/webmcp.ts';
import { localDate, PRESETS, type Snapshot } from '../lib/habits.ts';
await test('optional tool contract shares validated app actions and cleans up', async () => {
  const registered: Tool[] = [];
  let signal: AbortSignal | undefined;
  const fakeDocument = {
    modelContext: {
      registerTool: (tool: Tool, options: { signal: AbortSignal }) => {
        registered.push(tool);
        signal = options.signal;
      },
    },
  };
  Object.defineProperty(globalThis, 'document', {
    value: fakeDocument,
    configurable: true,
  });
  const snapshot: Snapshot = {
    habits: [{ ...PRESETS[0], id: 'water', startDate: localDate() }],
    entries: [],
  };
  let saved: unknown[] = [];
  const cleanup = registerHabitTools({
    getSnapshot: () => snapshot,
    save: async (...args) => {
      saved = args;
    },
  });
  assert.deepEqual(
    registered.map((t) => t.name),
    ['read_habit_progress', 'save_habit_check_in'],
  );
  assert.deepEqual(registered[0].execute({}), snapshot);
  const result = (await registered[1].execute({
    habitId: 'water',
    date: localDate(),
    value: 8,
  })) as { saved: boolean };
  assert.equal(result.saved, true);
  assert.deepEqual(saved, ['water', localDate(), 8, undefined]);
  await registered[1].execute({
    habitId: 'water',
    date: localDate(),
    value: 8,
    note: 'Goal met. Feeling focused.',
  });
  assert.deepEqual(saved, [
    'water',
    localDate(),
    8,
    'Goal met. Feeling focused.',
  ]);
  await assert.rejects(
    Promise.resolve(
      registered[1].execute({
        habitId: 'water',
        date: localDate(),
        value: 8,
        note: 'a'.repeat(2001),
      }),
    ),
  );
  await assert.rejects(
    Promise.resolve(
      registered[1].execute({ habitId: 'water', date: localDate(), value: -1 }),
    ),
  );
  await assert.rejects(
    Promise.resolve(
      registered[1].execute({
        habitId: 'missing',
        date: localDate(),
        value: 8,
      }),
    ),
  );
  cleanup?.();
  assert.equal(signal?.aborted, true);
  Reflect.deleteProperty(globalThis, 'document');
});
