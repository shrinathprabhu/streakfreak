export type Direction = 'atLeast' | 'atMost';
export type HabitIcon =
  | 'water'
  | 'steps'
  | 'sleep'
  | 'screen'
  | 'book'
  | 'mind'
  | 'workout'
  | 'journal'
  | 'spark';
export type HabitColor = 'blue' | 'orange' | 'purple' | 'green' | 'pink';
export interface Habit {
  id: string;
  name: string;
  description: string;
  unit: string;
  target: number;
  direction: Direction;
  icon: HabitIcon;
  color: HabitColor;
  startDate: string;
}
export interface Entry {
  id: string;
  habitId: string;
  date: string;
  value: number;
  target: number;
  direction: Direction;
  updatedAt: string;
  /** Optional for entries and backups created before reflections were added. */
  note?: string;
}
export const MAX_NOTE_LENGTH = 2000;

export function validateNote(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_NOTE_LENGTH)
    throw new Error(
      `Keep your reflection to ${MAX_NOTE_LENGTH.toLocaleString('en-US')} characters or fewer.`,
    );
  return value.trim();
}
export interface Snapshot {
  habits: Habit[];
  entries: Entry[];
}
export interface Backup extends Snapshot {
  app: 'streakfreak';
  version: 1;
  exportedAt: string;
}
export type Preset = Omit<Habit, 'id' | 'startDate'>;
export const PRESETS: Preset[] = [
  {
    name: 'Stay hydrated',
    description: 'A little sip, a little better.',
    unit: 'glasses',
    target: 8,
    direction: 'atLeast',
    icon: 'water',
    color: 'blue',
  },
  {
    name: 'Get your steps in',
    description: 'Make room for a little movement.',
    unit: 'steps',
    target: 8000,
    direction: 'atLeast',
    icon: 'steps',
    color: 'orange',
  },
  {
    name: 'Rest & recharge',
    description: 'Good days start the night before.',
    unit: 'hours',
    target: 8,
    direction: 'atLeast',
    icon: 'sleep',
    color: 'purple',
  },
  {
    name: 'Less scrolling',
    description: 'A little more life, a little less screen.',
    unit: 'hours',
    target: 2,
    direction: 'atMost',
    icon: 'screen',
    color: 'green',
  },
  {
    name: 'Read a little',
    description: 'One more page. One new perspective.',
    unit: 'pages',
    target: 10,
    direction: 'atLeast',
    icon: 'book',
    color: 'orange',
  },
  {
    name: 'A moment of calm',
    description: 'Breathe in. Let a little go.',
    unit: 'minutes',
    target: 10,
    direction: 'atLeast',
    icon: 'mind',
    color: 'purple',
  },
  {
    name: 'Move your body',
    description: 'Move in a way that feels like you.',
    unit: 'minutes',
    target: 30,
    direction: 'atLeast',
    icon: 'workout',
    color: 'blue',
  },
  {
    name: 'Put it on paper',
    description: 'A little space for what’s on your mind.',
    unit: 'check-in',
    target: 1,
    direction: 'atLeast',
    icon: 'journal',
    color: 'pink',
  },
];
export const COLORS: HabitColor[] = [
  'blue',
  'orange',
  'purple',
  'green',
  'pink',
];
export const ICONS: HabitIcon[] = [
  'water',
  'steps',
  'sleep',
  'screen',
  'book',
  'mind',
  'workout',
  'journal',
  'spark',
];
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
export function shiftDate(date: string, days: number): string {
  const value = parseDate(date);
  value.setDate(value.getDate() + days);
  return localDate(value);
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 2000 &&
    Number.isFinite(parseDate(value).getTime()) &&
    localDate(parseDate(value)) === value
  );
}
export function complete(entry: Entry | undefined): boolean {
  return (
    !!entry &&
    (entry.direction === 'atMost'
      ? entry.value <= entry.target
      : entry.value >= entry.target)
  );
}
export function entryKey(habitId: string, date: string): string {
  return `${habitId}:${date}`;
}
export function entryMap(entries: Entry[]): Map<string, Entry> {
  return new Map(entries.map((e) => [e.id, e]));
}
export function streaks(
  dates: string[],
  today: string,
): { current: number; best: number } {
  const sorted = [...new Set(dates.filter((d) => d <= today))].sort();
  let best = 0,
    run = 0,
    previous = '';
  for (const date of sorted) {
    run = previous && shiftDate(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  const done = new Set(sorted);
  let cursor = done.has(today) ? today : shiftDate(today, -1);
  let current = 0;
  while (done.has(cursor)) {
    current++;
    cursor = shiftDate(cursor, -1);
  }
  return { current, best };
}
export function habitStreak(habit: Habit, entries: Entry[], today: string) {
  return streaks(
    entries
      .filter(
        (e) =>
          e.habitId === habit.id && e.date >= habit.startDate && complete(e),
      )
      .map((e) => e.date),
    today,
  );
}
export function calendarYear(year: number): (string | null)[] {
  const first = `${year}-01-01`;
  const offset = (parseDate(first).getDay() + 6) % 7;
  const result: (string | null)[] = Array(offset).fill(null);
  let date = first;
  while (date.startsWith(String(year))) {
    result.push(date);
    date = shiftDate(date, 1);
  }
  while (result.length % 7) result.push(null);
  return result;
}
export function daySummary(
  habits: Habit[],
  map: Map<string, Entry>,
  date: string,
) {
  const due = habits.filter((h) => h.startDate <= date);
  const done = due.filter((h) =>
    complete(map.get(entryKey(h.id, date))),
  ).length;
  return {
    due: due.length,
    done,
    level:
      done === 0
        ? 0
        : Math.max(1, Math.ceil((done / Math.max(due.length, 1)) * 4)),
  };
}
export function formatAmount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export function createBackup(snapshot: Snapshot): Backup {
  return {
    app: 'streakfreak',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...snapshot,
  };
}
const textField = (v: unknown, max: number, min = 0): v is string =>
  typeof v === 'string' && v.trim().length >= min && v.length <= max;
const positive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1000000;
export function validateHabit(value: unknown, today = localDate()): Habit {
  if (!value || typeof value !== 'object')
    throw new Error('A habit is missing its details.');
  const h = value as Habit;
  if (
    !textField(h.id, 100, 1) ||
    !textField(h.name, 60, 1) ||
    !textField(h.description, 160) ||
    !textField(h.unit, 24, 1) ||
    !positive(h.target) ||
    !['atLeast', 'atMost'].includes(h.direction) ||
    !COLORS.includes(h.color) ||
    !ICONS.includes(h.icon) ||
    !validDate(h.startDate) ||
    h.startDate > today
  )
    throw new Error(
      'One of the habits has invalid details. Check its name, goal, or start date.',
    );
  return {
    id: h.id,
    name: h.name.trim(),
    description: h.description.trim(),
    unit: h.unit.trim(),
    target: h.target,
    direction: h.direction,
    icon: h.icon,
    color: h.color,
    startDate: h.startDate,
  };
}
export function validateBackup(raw: unknown, today = localDate()): Backup {
  if (!raw || typeof raw !== 'object')
    throw new Error('This file is not a Streakfreak backup.');
  const input = raw as Backup;
  if (input.app !== 'streakfreak' || input.version !== 1)
    throw new Error('Choose a Streakfreak JSON backup (version 1).');
  if (
    !Array.isArray(input.habits) ||
    input.habits.length > 500 ||
    !Array.isArray(input.entries) ||
    input.entries.length > 200000
  )
    throw new Error('The backup has too many records or is incomplete.');
  const habits = input.habits.map((h) => validateHabit(h, today));
  const ids = new Set(habits.map((h) => h.id));
  if (ids.size !== habits.length)
    throw new Error('The backup contains duplicate habit IDs.');
  const habitLookup = new Map(habits.map((h) => [h.id, h]));
  const entryIds = new Set<string>();
  const entries = input.entries.map((e) => {
    if (
      !e ||
      !ids.has(e.habitId) ||
      !validDate(e.date) ||
      e.date > today ||
      e.date < habitLookup.get(e.habitId)!.startDate ||
      e.id !== entryKey(e.habitId, e.date) ||
      entryIds.has(e.id) ||
      typeof e.value !== 'number' ||
      !Number.isFinite(e.value) ||
      e.value < 0 ||
      e.value > 1000000 ||
      !positive(e.target) ||
      !['atLeast', 'atMost'].includes(e.direction) ||
      typeof e.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(e.updatedAt))
    )
      throw new Error(
        'The backup contains an invalid or duplicate daily entry.',
      );
    entryIds.add(e.id);
    return {
      id: e.id,
      habitId: e.habitId,
      date: e.date,
      value: e.value,
      target: e.target,
      direction: e.direction,
      updatedAt: e.updatedAt,
      ...(e.note === undefined ? {} : { note: validateNote(e.note) }),
    };
  });
  return {
    app: 'streakfreak',
    version: 1,
    exportedAt: new Date().toISOString(),
    habits,
    entries,
  };
}
export function toCSV(snapshot: Snapshot): string {
  // Spreadsheet formula prefixes are escaped even when the cell is quoted.
  const cell = (value: string | number | boolean | null | undefined) =>
    `"${String(value ?? '')
      .replace(/^[\s]*[=+\-@\t\r]/, (s) => `'${s}`)
      .replaceAll('"', '""')}"`;
  const rows: (string | number | boolean)[][] = [
    [
      'habit_id',
      'habit',
      'description',
      'unit',
      'date',
      'value',
      'goal',
      'direction',
      'completed',
      'start_date',
      'note',
    ],
  ];
  for (const h of snapshot.habits) {
    const entries = snapshot.entries
      .filter((e) => e.habitId === h.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!entries.length)
      rows.push([
        h.id,
        h.name,
        h.description,
        h.unit,
        '',
        '',
        h.target,
        h.direction,
        '',
        h.startDate,
        '',
      ]);
    for (const e of entries)
      rows.push([
        h.id,
        h.name,
        h.description,
        h.unit,
        e.date,
        e.value,
        e.target,
        e.direction,
        complete(e),
        h.startDate,
        e.note ?? '',
      ]);
  }
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
