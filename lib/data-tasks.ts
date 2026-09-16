import { createBackup, toCSV, validateBackup, type Backup } from './habits.ts';
import { mergeBackup, readSnapshot } from './storage.ts';

export type DataTask =
  | { kind: 'export'; format: 'json' | 'csv' }
  | { kind: 'parse'; file: File }
  | { kind: 'merge'; backup: Backup };
export type DataTaskResult = Blob | Backup | void;
export type DataTaskResponse =
  | { ok: true; result: DataTaskResult }
  | { ok: false; error: string };

// Runs inside the dedicated browser worker. IndexedDB stays on this origin.
export async function performDataTask(task: DataTask): Promise<DataTaskResult> {
  if (task.kind === 'export') {
    const snapshot = await readSnapshot();
    return new Blob(
      [
        task.format === 'json'
          ? JSON.stringify(createBackup(snapshot), null, 2)
          : toCSV(snapshot),
      ],
      {
        type:
          task.format === 'json'
            ? 'application/json'
            : 'text/csv;charset=utf-8',
      },
    );
  }
  if (task.kind === 'parse') {
    if (task.file.size > 10 * 1024 * 1024)
      throw new Error('Choose a backup smaller than 10 MB.');
    try {
      return validateBackup(JSON.parse(await task.file.text()));
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new Error(
          'This file is not valid JSON. Choose a Streakfreak backup.',
        );
      throw error;
    }
  }
  // The preview and schema validation happen before this explicit confirmation.
  await mergeBackup(task.backup);
}
