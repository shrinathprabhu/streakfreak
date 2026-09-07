import {
  entryKey,
  localDate,
  validDate,
  PRESETS,
  validateHabit,
  type Backup,
  type Entry,
  type Habit,
  type Snapshot,
} from './habits.ts';
const DB_NAME = 'streakfreak';
let database: Promise<IDBDatabase> | undefined;
function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB)
    return Promise.reject(
      new Error(
        'This browser cannot store your habits. Enable browser storage and reload.',
      ),
    );
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('habits', { keyPath: 'id' });
        const entries = db.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('habitId', 'habitId');
        db.createObjectStore('meta');
      };
      request.onerror = () => {
        database = undefined;
        reject(
          new Error(
            'Local storage could not be opened. Check your browser’s storage settings.',
          ),
        );
      };
      request.onblocked = () => {
        database = undefined;
        reject(
          new Error(
            'Close other Streakfreak tabs, then reload to update storage.',
          ),
        );
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
    });
  return database;
}
const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(
        new Error(
          tx.error?.name === 'QuotaExceededError'
            ? 'Your device is out of storage. Export a backup, then free up space.'
            : 'Your change could not be saved on this device. Please try again.',
        ),
      );
  });
export async function initialize(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(['habits', 'meta'], 'readwrite');
  const done = transactionDone(tx);
  const request = tx.objectStore('meta').get('initialized');
  request.onsuccess = () => {
    if (request.result) return;
    for (const [i, preset] of PRESETS.slice(0, 4).entries())
      tx.objectStore('habits').put({
        ...preset,
        id: `starter-${i}`,
        startDate: localDate(),
      });
    tx.objectStore('meta').put(true, 'initialized');
  };
  await done;
}
export async function readSnapshot(): Promise<Snapshot> {
  const db = await openDatabase();
  const tx = db.transaction(['habits', 'entries'], 'readonly');
  const done = transactionDone(tx);
  const habits = tx.objectStore('habits').getAll();
  const entries = tx.objectStore('entries').getAll();
  await done;
  return { habits: habits.result, entries: entries.result };
}
export async function saveHabit(habit: Habit): Promise<void> {
  const validated = validateHabit(habit);
  const db = await openDatabase();
  const tx = db.transaction(['habits', 'entries'], 'readwrite');
  const done = transactionDone(tx);
  // Never strand history by moving the start date after existing entries.
  const request = tx.objectStore('entries').index('habitId').getAll(habit.id);
  let invalid = false;
  request.onsuccess = () => {
    if (request.result.some((e: Entry) => e.date < validated.startDate)) {
      invalid = true;
      tx.abort();
    } else tx.objectStore('habits').put(validated);
  };
  try {
    await done;
  } catch (error) {
    if (invalid)
      throw new Error(
        'The start date cannot be later than an existing check-in.',
      );
    throw error;
  }
}
export async function saveEntry(
  habitId: string,
  date: string,
  value: number,
): Promise<void> {
  if (!Number.isFinite(value) || value < 0 || value > 1000000)
    throw new Error('Enter a number between 0 and 1,000,000.');
  const db = await openDatabase();
  const tx = db.transaction(['habits', 'entries'], 'readwrite');
  const done = transactionDone(tx);
  let invalid = false;
  const request = tx.objectStore('habits').get(habitId);
  request.onsuccess = () => {
    const h = request.result as Habit | undefined;
    if (!h || date > localDate() || date < h.startDate || !validDate(date)) {
      invalid = true;
      tx.abort();
      return;
    }
    const id = entryKey(habitId, date);
    const existing = tx.objectStore('entries').get(id);
    existing.onsuccess = () => {
      const prior = existing.result as Entry | undefined;
      tx.objectStore('entries').put({
        id,
        habitId,
        date,
        value,
        target: prior?.target ?? h.target,
        direction: prior?.direction ?? h.direction,
        updatedAt: new Date().toISOString(),
      } satisfies Entry);
    };
  };
  try {
    await done;
  } catch (error) {
    if (invalid)
      throw new Error(
        'This habit is no longer available or the check-in date is outside its schedule.',
      );
    throw error;
  }
}
export async function removeEntry(
  habitId: string,
  date: string,
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('entries', 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('entries').delete(entryKey(habitId, date));
  await done;
}
export async function deleteHabit(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(['habits', 'entries'], 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('habits').delete(id);
  const request = tx.objectStore('entries').index('habitId').openKeyCursor(id);
  request.onsuccess = () => {
    const c = request.result;
    if (c) {
      tx.objectStore('entries').delete(c.primaryKey);
      c.continue();
    }
  };
  await done;
}
export async function mergeBackup(backup: Backup): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(['habits', 'entries', 'meta'], 'readwrite');
  const done = transactionDone(tx);
  // Earlier local history keeps its original valid start date when merging.
  for (const h of backup.habits) {
    const request = tx.objectStore('habits').get(h.id);
    request.onsuccess = () => {
      const old = request.result as Habit | undefined;
      tx.objectStore('habits').put({
        ...h,
        startDate:
          old && old.startDate < h.startDate ? old.startDate : h.startDate,
      });
    };
  }
  for (const e of backup.entries) tx.objectStore('entries').put(e);
  tx.objectStore('meta').put(true, 'initialized');
  await done;
}
