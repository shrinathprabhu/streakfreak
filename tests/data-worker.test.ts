import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import type { Backup } from '../lib/habits.ts';
import type { DataTask, DataTaskResponse } from '../lib/data-tasks.ts';

await test('background backup processing preserves local journal data', async (t) => {
  const worker = new Worker(
    new URL('./helpers/data-worker-harness.mjs', import.meta.url),
  );
  t.after(() => worker.terminate());
  const [ready] = await once(worker, 'message');
  assert.equal(ready.ready, true);

  async function run(task: DataTask) {
    const reply = once(worker, 'message');
    worker.postMessage(task);
    const [result] = await reply;
    return result as DataTaskResponse;
  }
  let backup: Backup;
  await t.test(
    'exports JSON and CSV with historical goals and multiline reflections',
    async () => {
      const json = await run({ kind: 'export', format: 'json' });
      assert.equal(json.ok, true);
      assert.ok(json.ok && json.result instanceof Blob);
      assert.equal(json.result.type, 'application/json');
      backup = JSON.parse(await json.result.text());
      assert.equal(backup.habits.length, 4);
      assert.equal(backup.entries.length, 1);
      assert.equal(
        backup.entries[0].note,
        'Made time for myself.\nA clearer head.',
      );
      const csv = await run({ kind: 'export', format: 'csv' });
      assert.ok(csv.ok && csv.result instanceof Blob);
      assert.equal(csv.result.type, 'text/csv;charset=utf-8');
      assert.ok(
        (await csv.result.text()).includes(
          '"Made time for myself.\nA clearer head."',
        ),
      );
    },
  );
  await t.test(
    'parsing a backup only previews it, then confirmation commits the merge',
    async () => {
      const updated = structuredClone(backup);
      updated.entries[0].note = 'Revisited my outcome.';
      const parsed = await run({
        kind: 'parse',
        file: new File([JSON.stringify(updated)], 'backup.json'),
      });
      assert.ok(parsed.ok && parsed.result && !(parsed.result instanceof Blob));
      assert.equal(parsed.result.entries[0].note, updated.entries[0].note);
      const before = await run({ kind: 'export', format: 'json' });
      assert.ok(before.ok && before.result instanceof Blob);
      assert.equal(
        JSON.parse(await before.result.text()).entries[0].note,
        backup.entries[0].note,
      );
      assert.deepEqual(await run({ kind: 'merge', backup: parsed.result }), {
        ok: true,
        result: undefined,
      });
      const after = await run({ kind: 'export', format: 'json' });
      assert.ok(after.ok && after.result instanceof Blob);
      const restored = JSON.parse(await after.result.text());
      assert.deepEqual(restored.entries, updated.entries);
      assert.deepEqual(restored.habits, updated.habits);
    },
  );
  await t.test(
    'malformed, unrelated and oversized files return recoverable errors',
    async () => {
      for (const file of [
        new File(['{broken'], 'broken.json'),
        new File(['{"app":"unrelated","version":1}'], 'unrelated.json'),
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'too-large.json'),
      ]) {
        const result = await run({ kind: 'parse', file });
        assert.equal(result.ok, false);
        assert.ok(!result.ok && result.error.length > 0);
      }
      const result = await run({ kind: 'export', format: 'json' });
      assert.ok(result.ok && result.result instanceof Blob);
      assert.equal(
        JSON.parse(await result.result.text()).entries[0].note,
        'Revisited my outcome.',
      );
    },
  );
});
