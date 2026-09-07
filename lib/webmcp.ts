import { localDate, validDate, type Snapshot } from './habits.ts';
export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
interface ModelContext {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
}
export function registerHabitTools(actions: {
  getSnapshot: () => Snapshot;
  save: (habitId: string, date: string, value: number) => Promise<void>;
}) {
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: 'read_habit_progress',
      title: 'Read habit progress',
      description:
        'Read the habit names, goals, and local check-ins visible in Streakfreak. Only use when the person asks about their habits.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => actions.getSnapshot(),
    },
    {
      name: 'save_habit_check_in',
      title: 'Save a habit check-in',
      description:
        'Record or update one daily habit amount on this device, using the same action as the check-in form. Dates must be today or earlier and on or after the habit start date.',
      inputSchema: {
        type: 'object',
        properties: {
          habitId: { type: 'string' },
          date: {
            type: 'string',
            description: 'Local calendar date YYYY-MM-DD',
          },
          value: { type: 'number', minimum: 0, maximum: 1000000 },
        },
        required: ['habitId', 'date', 'value'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!input || typeof input !== 'object')
          throw new Error('Provide habitId, date, and value.');
        const { habitId, date, value } = input as Record<string, unknown>;
        const habit = actions
          .getSnapshot()
          .habits.find((h) => h.id === habitId);
        if (
          !habit ||
          !validDate(date) ||
          date > localDate() ||
          date < habit.startDate ||
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1000000
        )
          throw new Error('Invalid habit, date, or amount.');
        await actions.save(habit.id, date, value);
        return { habitId: habit.id, date, value, saved: true };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional browser integration must not prevent local tracking. */
    }
  }
  return () => lifecycle.abort();
}
