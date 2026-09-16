'use client';

import DataWorker from '../workers/data.worker.ts?worker';
import type { Backup } from './habits.ts';
import type {
  DataTask,
  DataTaskResponse,
  DataTaskResult,
} from './data-tasks.ts';

export function runDataTask(
  task: Extract<DataTask, { kind: 'export' }>,
): Promise<Blob>;
export function runDataTask(
  task: Extract<DataTask, { kind: 'parse' }>,
): Promise<Backup>;
export function runDataTask(
  task: Extract<DataTask, { kind: 'merge' }>,
): Promise<void>;
export function runDataTask(task: DataTask): Promise<DataTaskResult> {
  return new Promise((resolve, reject) => {
    // Vite emits a same-origin asset URL; Vinext rewrites import.meta.url to
    // a file URL during its server pass, so don't use it as a worker base.
    const worker = new DataWorker();
    const fail = () => {
      worker.terminate();
      reject(
        new Error(
          'Background backup processing is unavailable. Reload and try again.',
        ),
      );
    };
    worker.onmessage = ({ data }: MessageEvent<DataTaskResponse>) => {
      worker.terminate();
      if (data.ok) resolve(data.result);
      else reject(new Error(data.error));
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    try {
      worker.postMessage(task);
    } catch {
      fail();
    }
  });
}
