// Exercise the browser worker's message handler in a real background thread.
// fake-indexeddb supplies the browser API without touching the user's journal.
import 'fake-indexeddb/auto';
import { parentPort } from 'node:worker_threads';
import { initialize, readSnapshot, saveEntry } from '../../lib/storage.ts';
import { localDate } from '../../lib/habits.ts';

await initialize();
const { habits } = await readSnapshot();
await saveEntry(
  habits[0].id,
  localDate(),
  habits[0].target,
  'Made time for myself.\nA clearer head.',
);
globalThis.postMessage = (message) => parentPort.postMessage(message);
await import('../../workers/data.worker.ts');
parentPort.on('message', (data) => globalThis.onmessage({ data }));
parentPort.postMessage({ ready: true });
