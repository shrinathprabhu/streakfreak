'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Flame,
  LayoutGrid,
  MessageSquareText,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
  WifiOff,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import {
  CheckIn,
  Choice,
  HabitForm,
  HabitSymbol,
} from '@/components/streakfreak/controls';
import { usePWA } from '@/hooks/use-pwa';
import {
  calendarYear,
  complete,
  createBackup,
  daySummary,
  entryKey,
  entryMap,
  entriesByHabit,
  formatAmount,
  habitStreak,
  localDate,
  parseDate,
  PRESETS,
  shiftDate,
  streaks,
  toCSV,
  validateBackup,
  type Backup,
  type Habit,
  type Preset,
  type Snapshot,
} from '@/lib/habits';
import * as db from '@/lib/storage';
import { registerHabitTools } from '@/lib/webmcp';

const EMPTY: Snapshot = { habits: [], entries: [] };
const calendarDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'full',
});
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
function downloadFile(content: string, mime: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export default function Tracker({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  const [year, setYear] = useState(2026);
  const [view, setView] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState<{
    initial: Habit | Preset;
    editing: boolean;
  } | null>(null);
  const [logging, setLogging] = useState<{
    habit: Habit;
    date: string;
    focusReflection?: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState<Backup | null>(null);
  const [notice, setNotice] = useState('');
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dailySection = useRef<HTMLElement>(null);
  const snapshotRef = useRef(snapshot);
  const pwa = usePWA();
  const refresh = useCallback(async () => {
    const next = await db.readSnapshot();
    setSnapshot(next);
    snapshotRef.current = next;
  }, []);
  useEffect(() => {
    let active = true;
    const reload = async () => {
      try {
        await db.initialize();
        if (active) {
          const now = localDate();
          setToday(now);
          setDate(now);
          setYear(Number(now.slice(0, 4)));
          await refresh();
          setReady(true);
          setStorageError('');
        }
      } catch (error) {
        if (active)
          setStorageError(
            error instanceof Error
              ? error.message
              : 'Local storage is unavailable.',
          );
      }
    };
    void reload();
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('streakfreak-changes');
      channel.current.onmessage = () =>
        void refresh().catch(() =>
          setStorageError(
            'Unable to refresh changes from another tab. Reload to try again.',
          ),
        );
    }
    const clock = () => {
      const next = localDate();
      setToday((old) => {
        if (old !== next)
          setDate((selected) => (selected === old ? next : selected));
        return next;
      });
    };
    const focus = () => {
      clock();
      void refresh().catch(() => {});
    };
    const timer = setInterval(clock, 30000);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', clock);
    void navigator.storage
      ?.persisted?.()
      .then(setPersistent)
      .catch(() => {});
    return () => {
      active = false;
      channel.current?.close();
      channel.current = null;
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', clock);
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const mutate = useCallback(
    async (
      operation: () => Promise<void>,
      message: string,
    ): Promise<boolean> => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      try {
        await operation();
        await refresh();
        channel.current?.postMessage('changed');
        setStorageError('');
        setNotice(message);
        return true;
      } catch (error) {
        setStorageError(
          error instanceof Error
            ? error.message
            : 'Your change could not be saved.',
        );
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  useEffect(
    () =>
      registerHabitTools({
        getSnapshot: () => snapshotRef.current,
        save: async (habitId, date, value, note) => {
          const ok = await mutate(
            () => db.saveEntry(habitId, date, value, note),
            'Check-in saved on this device.',
          );
          if (!ok)
            throw new Error('Check-in was not saved. See the app for details.');
        },
      }),
    [mutate],
  );
  const map = useMemo(() => entryMap(snapshot.entries), [snapshot.entries]);
  const displayedHabits = useMemo(
    () =>
      filter === 'all'
        ? snapshot.habits
        : snapshot.habits.filter((h) => h.id === filter),
    [snapshot.habits, filter],
  );
  const habitRuns = useMemo(() => {
    const grouped = entriesByHabit(snapshot.entries);
    return new Map(
      snapshot.habits.map((h) => [
        h.id,
        habitStreak(h, grouped.get(h.id) ?? [], today || localDate()),
      ]),
    );
  }, [snapshot.entries, snapshot.habits, today]);
  const dueToday = snapshot.habits.filter((h) => h.startDate <= today);
  const doneToday = dueToday.filter((h) =>
    complete(map.get(entryKey(h.id, today))),
  ).length;
  const allStreaks = useMemo(
    () =>
      streaks(
        snapshot.entries.filter(complete).map((e) => e.date),
        today || localDate(),
      ),
    [snapshot.entries, today],
  );
  const days = useMemo(() => calendarYear(year), [year]);
  const calendarCells = useMemo(
    () =>
      days.map((d) =>
        d
          ? {
              ...daySummary(displayedHabits, map, d),
              label: calendarDateFormatter.format(parseDate(d)),
            }
          : null,
      ),
    [days, displayedHabits, map],
  );
  const activeHabits = snapshot.habits.filter((h) => h.startDate <= date);
  const yearWins = useMemo(
    () =>
      snapshot.entries.filter(
        (e) =>
          e.date.startsWith(String(year)) &&
          complete(e) &&
          (filter === 'all' || e.habitId === filter),
      ).length,
    [snapshot.entries, year, filter],
  );
  const newHabit = () =>
    setForm({
      initial: {
        name: '',
        description: '',
        unit: 'check-in',
        target: 1,
        direction: 'atLeast',
        icon: 'spark',
        color: 'orange',
      },
      editing: false,
    });
  function chooseDate(next: string) {
    setDate(next);
    dailySection.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }
  function heatmapKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const offset: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
    };
    if (!(event.key in offset)) return;
    event.preventDefault();
    const next = index + offset[event.key];
    const cell =
      event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
        `[data-index="${next}"]`,
      );
    if (cell && !cell.disabled) cell.focus();
  }
  async function exportData(format: 'json' | 'csv') {
    try {
      const current = await db.readSnapshot();
      downloadFile(
        format === 'json'
          ? JSON.stringify(createBackup(current), null, 2)
          : toCSV(current),
        format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
        `streakfreak-${localDate()}.${format}`,
      );
      setNotice(`${format.toUpperCase()} export downloaded.`);
      setExporting(false);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : 'Export failed. Please try again.',
      );
    }
  }
  async function readImport(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error('Choose a backup smaller than 10 MB.');
      const parsed = validateBackup(JSON.parse(await file.text()));
      setImporting(parsed);
    } catch (error) {
      setStorageError(
        error instanceof SyntaxError
          ? 'This file is not valid JSON. Choose a Streakfreak backup.'
          : error instanceof Error
            ? error.message
            : 'Unable to read this file.',
      );
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to habits
      </a>
      <header className="site-header">
        <a
          className="brand"
          href={process.env.NEXT_PUBLIC_BASE_PATH || '/'}
          aria-label="Streakfreak home"
        >
          <span className="brand-mark">
            <Flame size={23} fill="currentColor" />
          </span>
          streakfreak<span className="brand-period">.</span>
        </a>
        <span className="header-note">Small habits. Big you.</span>
        <div className="header-actions">
          <span className="local-badge">
            <span />
            {pwa.online ? 'Local & private' : 'You’re offline'}
          </span>
          <button
            disabled={!ready}
            className="button secondary"
            onClick={() => setExporting(true)}
            aria-label="Export data"
          >
            <ArrowDownToLine size={16} /> Export data
          </button>
        </div>
      </header>
      <main className="workspace" id="main">
        <section className="page-heading">
          <div>
            <div className="eyebrow">
              <span /> YOUR PRIVATE HABIT TRACKER
            </div>
            <h1>
              Keep showing up<span>.</span>
            </h1>
            <p>Free. Local. No login. One small thing today.</p>
          </div>
          <button
            disabled={!ready}
            className="button primary"
            onClick={newHabit}
          >
            <Plus size={18} /> New habit
          </button>
        </section>
        {storageError && (
          <div className="error-banner" role="alert">
            <span>{storageError}</span>
            <button
              className="text-button"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        )}
        {!ready && !storageError && (
          <output className="loading-note">
            <LoaderCircle size={16} className="spinner" /> Opening your local
            habit journal…
          </output>
        )}
        <Tabs
          value={view}
          onValueChange={(v) => setView(String(v))}
          className="app-tabs"
        >
          <div className="view-nav">
            <TabsList
              variant="line"
              className="app-tab-list"
              aria-label="Habit tracker views"
            >
              <TabsTrigger value="overview">
                <LayoutGrid size={17} /> Overview
              </TabsTrigger>
              <TabsTrigger value="templates">
                <Sparkles size={17} /> Templates
              </TabsTrigger>
              <TabsTrigger value="data">
                <LockKeyhole size={17} /> Your data
              </TabsTrigger>
            </TabsList>
            <span className="nav-date">
              {today
                ? parseDate(today).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Your pace. Your progress.'}
            </span>
          </div>
          <TabsContent value="overview" className="view-content">
            <section className="stats-grid" aria-label="Your progress">
              <div className="stat">
                <span className="stat-label">
                  <Target size={17} /> Today’s progress
                </span>
                <div className="stat-value">
                  {doneToday}
                  <span>/ {dueToday.length} habits</span>
                </div>
                <div className="stat-caption">
                  {doneToday && doneToday === dueToday.length
                    ? 'All done. Look at you go!'
                    : doneToday
                      ? 'You’re making room for yourself.'
                      : 'A fresh start. Make it count.'}
                </div>
              </div>
              <div className="stat">
                <span className="stat-label">
                  <Flame size={17} /> Current streak
                </span>
                <div className="stat-value">
                  {allStreaks.current}
                  <span>{allStreaks.current === 1 ? 'day' : 'days'}</span>
                </div>
                <div className="stat-caption">
                  {allStreaks.current
                    ? 'Days with at least one goal met'
                    : 'Your next chapter starts today'}
                </div>
              </div>
              <div className="stat">
                <span className="stat-label">
                  <TrendingUp size={17} /> Best streak
                </span>
                <div className="stat-value">
                  {allStreaks.best}
                  <span>{allStreaks.best === 1 ? 'day' : 'days'}</span>
                </div>
                <div className="stat-caption">
                  {allStreaks.best
                    ? 'Your longest run of little wins'
                    : 'A personal best waiting to happen'}
                </div>
              </div>
              <div className="stat stat-accent">
                <span className="stat-label">
                  <Sprout size={17} /> A little reminder
                </span>
                <p>
                  Consistency is built
                  <br />
                  one <em>ordinary day</em> at a time.
                </p>
                <span className="stat-caption">
                  You don’t have to be perfect. Just here.
                </span>
              </div>
            </section>
            <section
              className="panel heatmap-panel"
              aria-label="Annual habit calendar"
            >
              <div className="section-heading">
                <div>
                  <h2>
                    Your year in little wins{' '}
                    <span className="small-tag">{year}</span>
                  </h2>
                  <p>Every square is a day you made time for yourself.</p>
                </div>
                <div className="heatmap-controls">
                  <Choice
                    value={
                      snapshot.habits.some((h) => h.id === filter)
                        ? filter
                        : 'all'
                    }
                    onChange={setFilter}
                    label="Filter calendar by habit"
                    options={[
                      { value: 'all', label: 'All habits' },
                      ...snapshot.habits.map((h) => ({
                        value: h.id,
                        label: h.name,
                      })),
                    ]}
                  />
                  <button
                    className="icon-button"
                    disabled={year <= 2000}
                    aria-label="Previous year"
                    onClick={() => setYear((y) => y - 1)}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={year >= Number(today.slice(0, 4))}
                    aria-label="Next year"
                    onClick={() => setYear((y) => y + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <div className="heatmap-scroll">
                <div
                  className="heatmap-months"
                  style={{
                    gridTemplateColumns: `repeat(${days.length / 7}, 1fr)`,
                  }}
                >
                  {days.map((d, i) =>
                    d && d.endsWith('-01') ? (
                      <span
                        style={{
                          gridColumn: Math.floor(i / 7) + 1,
                          gridRow: 1,
                        }}
                        key={d}
                      >
                        {monthFormatter.format(parseDate(d))}
                      </span>
                    ) : null,
                  )}
                </div>
                <div className="heatmap-with-days">
                  <div className="heatmap-days" aria-hidden="true">
                    <span>Mon</span>
                    <span>Wed</span>
                    <span>Fri</span>
                  </div>
                  <div
                    className="heatmap-grid"
                    style={{
                      gridTemplateColumns: `repeat(${days.length / 7},1fr)`,
                    }}
                    aria-label="Use arrow keys to move between days"
                  >
                    {days.map((d, i) => {
                      if (!d)
                        return (
                          <span
                            key={`blank-${i}`}
                            className="heat-cell blank"
                          />
                        );
                      const {
                        done,
                        due,
                        level,
                        label: dateLabel,
                      } = calendarCells[i]!;
                      const future = d > today;
                      const label = `${dateLabel}: ${done} of ${due} goals completed${d === today ? ', today' : ''}`;
                      return (
                        <button
                          key={d}
                          className={`heat-cell level-${level}${future ? ' future' : ''}${d === today ? ' is-today' : ''}${d === date ? ' is-selected' : ''}`}
                          data-index={i}
                          tabIndex={
                            d ===
                            (year === Number(today.slice(0, 4))
                              ? today
                              : `${year}-01-01`)
                              ? 0
                              : -1
                          }
                          disabled={future || !ready}
                          aria-label={label}
                          aria-pressed={d === date}
                          title={label}
                          onKeyDown={(event) => heatmapKeyboard(event, i)}
                          onClick={() => chooseDate(d)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="heatmap-footer">
                <span>
                  <b>{yearWins.toLocaleString()}</b> goals completed this year{' '}
                  <span className="muted">· Little things add up</span>
                </span>
                <div
                  className="heatmap-legend"
                  aria-label="Darker orange means more goals completed"
                >
                  Less
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={`heat-cell level-${i}`} />
                  ))}
                  More
                </div>
              </div>
            </section>
            <section className="daily-section" ref={dailySection}>
              <div className="section-heading">
                <div>
                  <h2>
                    {date === today
                      ? 'Make today a good day'
                      : 'A little look back'}{' '}
                    <span className="count-tag">{activeHabits.length}</span>
                  </h2>
                  <p>
                    {date === today
                      ? 'Your habits, ready when you are.'
                      : 'Missed a check-in? There’s room to fill it in.'}
                  </p>
                </div>
                <div className="day-picker">
                  <button
                    className="icon-button"
                    disabled={!date || date <= '2000-01-01'}
                    aria-label="Previous day"
                    onClick={() => setDate((d) => shiftDate(d, -1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <label className="date-input-label">
                    <CalendarDays size={14} />
                    <span>
                      {date === today
                        ? 'Today'
                        : date
                          ? parseDate(date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Today'}
                    </span>
                    <input
                      aria-label="Check-in date"
                      type="date"
                      min="2000-01-01"
                      max={today}
                      value={date}
                      onChange={(e) => {
                        if (
                          e.target.value &&
                          e.target.value <= today &&
                          e.target.value >= '2000-01-01'
                        )
                          setDate(e.target.value);
                      }}
                    />
                  </label>
                  <button
                    className="icon-button"
                    disabled={date >= today}
                    aria-label="Next day"
                    onClick={() => setDate((d) => shiftDate(d, 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                  {date !== today && (
                    <button
                      className="text-button today-link"
                      onClick={() => setDate(today)}
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>
              <div className="habit-grid">
                {activeHabits.map((h) => {
                  const entry = map.get(entryKey(h.id, date));
                  const done = complete(entry);
                  const target = entry?.target ?? h.target;
                  const direction = entry?.direction ?? h.direction;
                  const run = habitRuns.get(h.id)!;
                  const progress = entry
                    ? direction === 'atMost'
                      ? done
                        ? 100
                        : 0
                      : Math.min(100, (entry.value / target) * 100)
                    : 0;
                  return (
                    <article
                      className={`habit-card ${h.color} ${done ? 'is-complete' : ''}`}
                      key={h.id}
                    >
                      <div className="habit-top">
                        <div className="habit-icon">
                          <HabitSymbol icon={h.icon} />
                        </div>
                        <span
                          className={`streak-badge ${run.current ? 'has-streak' : ''}`}
                        >
                          <Flame size={14} />
                          {run.current
                            ? `${run.current} day${run.current === 1 ? '' : 's'}`
                            : 'Fresh start'}
                        </span>
                        <button
                          className="edit-habit"
                          aria-label={`Edit ${h.name}`}
                          title="Edit habit"
                          onClick={() => setForm({ initial: h, editing: true })}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                      <h3>{h.name}</h3>
                      <p className="habit-description">
                        {h.description || 'A little progress, every day.'}
                      </p>
                      <div className="habit-value">
                        {entry ? formatAmount(entry.value) : '—'}
                        <span>
                          {direction === 'atMost' ? 'of' : '/'}{' '}
                          {formatAmount(target)} {h.unit}
                        </span>
                        {done && (
                          <Check
                            size={18}
                            className="completed-check"
                            aria-label="Goal complete"
                          />
                        )}
                      </div>
                      <Progress
                        className="habit-progress"
                        value={progress}
                        aria-label={`${h.name}: ${Math.round(progress)}% of goal`}
                      />
                      <div className="habit-bottom">
                        <span>
                          {done
                            ? 'Goal complete'
                            : direction === 'atMost'
                              ? 'Daily limit'
                              : 'Daily goal'}
                        </span>
                        <button
                          disabled={busy || !ready}
                          className="checkin-button"
                          onClick={() => setLogging({ habit: h, date })}
                        >
                          {done ? (
                            <Check size={15} />
                          ) : entry ? (
                            <Pencil size={14} />
                          ) : (
                            <Plus size={16} />
                          )}{' '}
                          {entry ? 'Update' : 'Check in'}
                        </button>
                      </div>
                      {entry && (
                        <button
                          type="button"
                          className={`habit-reflection ${entry.note ? 'has-note' : ''}`}
                          disabled={busy}
                          aria-label={`${entry.note ? 'Read or edit' : 'Add'} reflection for ${h.name}`}
                          onClick={() =>
                            setLogging({
                              habit: h,
                              date,
                              focusReflection: true,
                            })
                          }
                        >
                          <MessageSquareText size={15} />
                          <span>
                            {entry.note ||
                              (done
                                ? 'Add a closing note'
                                : 'Add a reflection')}
                          </span>
                          {entry.note && <Pencil size={13} />}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              {ready && activeHabits.length === 0 && (
                <Empty className="empty-state">
                  <EmptyHeader>
                    <Sprout size={30} />
                    <EmptyTitle>
                      {snapshot.habits.length
                        ? 'No habits scheduled for this day'
                        : 'Every streak starts with one small thing.'}
                    </EmptyTitle>
                    <EmptyDescription>
                      {snapshot.habits.length
                        ? 'Choose a later day, or adjust a habit’s start date in Your data.'
                        : 'Add a habit of your own or borrow an idea from our templates.'}
                    </EmptyDescription>
                  </EmptyHeader>
                  <button
                    className="button primary"
                    onClick={
                      snapshot.habits.length ? () => setDate(today) : newHabit
                    }
                  >
                    {snapshot.habits.length
                      ? 'Back to today'
                      : 'Create your first habit'}
                  </button>
                </Empty>
              )}
            </section>
            <section className="starter-strip">
              <span className="starter-icon">
                <Sparkles size={23} />
              </span>
              <div>
                <h3>Less setup. More showing up.</h3>
                <p>Find your next good habit in our ready-to-go templates.</p>
              </div>
              <button
                className="text-button"
                onClick={() => setView('templates')}
              >
                Explore templates <ArrowUpRight size={18} />
              </button>
            </section>
          </TabsContent>
          <TabsContent value="templates" className="view-content">
            <div className="templates-heading">
              <span className="eyebrow">A LITTLE INSPIRATION</span>
              <h2>Good habits, no blank page.</h2>
              <p>Pick a starting point. Make the goal your own.</p>
            </div>
            <div className="template-grid">
              {PRESETS.map((p) => (
                <article className={`template-card ${p.color}`} key={p.icon}>
                  <div className="habit-icon">
                    <HabitSymbol icon={p.icon} />
                  </div>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <span className="template-goal">
                    {p.direction === 'atMost' ? 'Up to' : ''}{' '}
                    {formatAmount(p.target)} {p.unit} / day
                  </span>
                  <button
                    className="button secondary"
                    disabled={!ready}
                    onClick={() => setForm({ initial: p, editing: false })}
                  >
                    <Plus size={15} /> Use template
                  </button>
                </article>
              ))}
            </div>
            <section className="starter-strip">
              <span className="starter-icon">
                <Pencil size={22} />
              </span>
              <div>
                <h3>Your habit doesn’t need a template.</h3>
                <p>Track anything that matters to you, in your own units.</p>
              </div>
              <button
                className="text-button"
                disabled={!ready}
                onClick={newHabit}
              >
                Create a custom habit <ArrowUpRight size={18} />
              </button>
            </section>
            <p className="template-footnote">
              These are editable starting points. Choose amounts that suit your
              needs.
            </p>
          </TabsContent>
          <TabsContent value="data" className="view-content">
            <div className="templates-heading">
              <span className="eyebrow">ALWAYS YOURS</span>
              <h2>Your progress belongs to you.</h2>
              <p>
                No account. No tracking pixels. No habit data sent to a server.
              </p>
            </div>
            <div className="data-grid">
              <section className="panel data-panel">
                <span className="data-icon">
                  <Database size={24} />
                </span>
                <h3>Right here, on this device.</h3>
                <p>
                  Your {snapshot.habits.length} habits and{' '}
                  {snapshot.entries.length.toLocaleString()} check-ins are saved
                  in this browser on this site. Export a backup before clearing
                  browser data or moving to a new device.
                </p>
                <div className="data-facts">
                  <span>
                    <Check size={16} /> Works without an account
                  </span>
                  <span>
                    <Check size={16} /> No analytics or cloud sync
                  </span>
                  <span>
                    {pwa.offlineReady ? (
                      <Check size={16} />
                    ) : (
                      <WifiOff size={16} />
                    )}{' '}
                    {pwa.offlineReady
                      ? 'Ready to use offline'
                      : 'Offline caching becomes available in the installed production app'}
                  </span>
                </div>
                <button
                  disabled={!ready || persistent === true}
                  className="button secondary"
                  onClick={async () => {
                    try {
                      const granted = await navigator.storage?.persist?.();
                      setPersistent(!!granted);
                      setNotice(
                        granted
                          ? 'Persistent storage enabled. Keep exporting backups too.'
                          : 'Your browser manages storage automatically. Regular backups keep your progress portable.',
                      );
                    } catch {
                      setNotice(
                        'This browser manages storage automatically. Export a backup regularly.',
                      );
                    }
                  }}
                >
                  <ShieldCheck size={16} />{' '}
                  {persistent
                    ? 'Persistent storage enabled'
                    : 'Ask browser to keep my data'}
                </button>
              </section>
              <section className="panel data-panel">
                <span className="data-icon">
                  <ArrowDownToLine size={24} />
                </span>
                <h3>Take your progress with you.</h3>
                <p>
                  JSON is a full backup you can restore in Streakfreak. CSV
                  includes daily amounts, goals, and reflections for your
                  reports.
                </p>
                <div className="export-options">
                  <button
                    disabled={!ready}
                    className="export-choice"
                    onClick={() => void exportData('json')}
                  >
                    <span className="file-type">{`{ }`}</span>
                    <span>
                      <b>JSON backup</b>
                      <small>Habits, check-ins, and reflections</small>
                    </span>
                    <Download size={18} />
                  </button>
                  <button
                    disabled={!ready}
                    className="export-choice"
                    onClick={() => void exportData('csv')}
                  >
                    <span className="file-type">CSV</span>
                    <span>
                      <b>CSV spreadsheet</b>
                      <small>Daily progress and reflection notes</small>
                    </span>
                    <Download size={18} />
                  </button>
                </div>
                <button
                  disabled={!ready || busy}
                  className="text-button"
                  onClick={() => fileInput.current?.click()}
                >
                  <ArrowUpFromLine size={16} /> Import a JSON backup
                </button>
                <p className="form-note">
                  Imports merge with your data. You’ll review the details first.
                </p>
              </section>
            </div>
            <section className="panel manage-panel">
              <div className="section-heading">
                <div>
                  <h2>
                    Your habits{' '}
                    <span className="count-tag">{snapshot.habits.length}</span>
                  </h2>
                  <p>
                    Change a goal, move a start date, or make room for something
                    new.
                  </p>
                </div>
                <button
                  className="button secondary"
                  disabled={!ready}
                  onClick={newHabit}
                >
                  <Plus size={16} /> New habit
                </button>
              </div>
              {snapshot.habits.map((h) => (
                <div key={h.id} className={`manage-row ${h.color}`}>
                  <span className="habit-icon">
                    <HabitSymbol icon={h.icon} size={20} />
                  </span>
                  <div>
                    <b>{h.name}</b>
                    <small>
                      {h.direction === 'atMost' ? 'At most' : 'At least'}{' '}
                      {formatAmount(h.target)} {h.unit} · Since{' '}
                      {parseDate(h.startDate).toLocaleDateString('en-US', {
                        dateStyle: 'medium',
                      })}
                    </small>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setForm({ initial: h, editing: true })}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                </div>
              ))}
              {!snapshot.habits.length && (
                <p className="form-note">
                  No habits yet. Add your first one whenever you’re ready.
                </p>
              )}
            </section>
            <section className="starter-strip">
              <span className="starter-icon">
                <Download size={23} />
              </span>
              <div>
                <h3>
                  {pwa.installed
                    ? 'Your little daily companion.'
                    : 'A little home on your home screen.'}
                </h3>
                <p>
                  {pwa.installed
                    ? 'Streakfreak is installed on this device.'
                    : 'Install Streakfreak for quick access and offline check-ins.'}
                </p>
              </div>
              {!pwa.installed && (
                <button
                  className="text-button"
                  onClick={() => void pwa.install()}
                >
                  Install app <ArrowUpRight size={18} />
                </button>
              )}
            </section>
          </TabsContent>
        </Tabs>
        {children}
      </main>
      <footer className="workspace site-footer">
        <span>
          <LockKeyhole size={14} /> Just you and your progress. Stored on this
          device.
        </span>
        <div className="maker-credit">
          <p>
            Built by{' '}
            <a
              href="https://shrinath.me"
              target="_blank"
              rel="author noopener noreferrer"
            >
              Shrinath
            </a>
            . From the makers of{' '}
            <a
              href="https://owleye.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              OwlEye Analytics
            </a>
            .
          </p>
          <a
            className="more-tools"
            href="https://lowkey.tools"
            target="_blank"
            rel="noopener noreferrer"
          >
            More little tools at <b>lowkey.tools</b> <ArrowUpRight size={13} />
          </a>
        </div>
      </footer>
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="application/json,.json"
        aria-label="Import JSON backup"
        onChange={(e) => void readImport(e.target.files?.[0])}
      />
      {form && (
        <HabitForm
          initial={form.initial}
          editing={form.editing}
          busy={busy}
          onClose={() => setForm(null)}
          onSave={(h) =>
            mutate(
              () => db.saveHabit(h),
              form.editing
                ? 'Habit updated. Keep making it yours.'
                : 'Your new habit is ready.',
            )
          }
          onDelete={() => {
            setDeleting(form.initial as Habit);
            setForm(null);
          }}
        />
      )}
      {logging && (
        <CheckIn
          habit={logging.habit}
          date={logging.date}
          entry={map.get(entryKey(logging.habit.id, logging.date))}
          busy={busy}
          focusReflection={logging.focusReflection}
          onClose={() => setLogging(null)}
          onSave={(value, note) =>
            mutate(
              () => db.saveEntry(logging.habit.id, logging.date, value, note),
              'Check-in saved. A little progress, all yours.',
            )
          }
          onRemove={() =>
            mutate(
              () => db.removeEntry(logging.habit.id, logging.date),
              'Check-in cleared.',
            )
          }
        />
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent className="app-dialog">
          <AlertDialogTitle className="dialog-title">
            Let this habit go?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Deleting “{deleting?.name}” also removes its{' '}
            {snapshot.entries.filter((e) => e.habitId === deleting?.id).length}{' '}
            check-ins. This cannot be undone. Export a backup first if you want
            to keep them.
          </AlertDialogDescription>
          <div className="dialog-actions">
            <AlertDialogCancel disabled={busy} className="button secondary">
              Keep habit
            </AlertDialogCancel>
            <button
              disabled={busy}
              className="button danger-solid"
              onClick={async () => {
                if (
                  deleting &&
                  (await mutate(
                    () => db.deleteHabit(deleting.id),
                    'Habit and its check-ins deleted.',
                  ))
                ) {
                  if (filter === deleting.id) setFilter('all');
                  setDeleting(null);
                }
              }}
            >
              {busy ? 'Deleting…' : 'Delete habit'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={exporting} onOpenChange={setExporting}>
        <DialogContent className="app-dialog">
          <DialogTitle className="dialog-title">
            Your progress, to go.
          </DialogTitle>
          <DialogDescription>
            Download a copy straight from this device.
          </DialogDescription>
          <div className="export-options">
            <button
              className="export-choice"
              onClick={() => void exportData('json')}
            >
              <span className="file-type">{`{ }`}</span>
              <span>
                <b>JSON backup</b>
                <small>Check-ins and reflections. Ready to restore.</small>
              </span>
              <Download size={19} />
            </button>
            <button
              className="export-choice"
              onClick={() => void exportData('csv')}
            >
              <span className="file-type">CSV</span>
              <span>
                <b>CSV spreadsheet</b>
                <small>For your own charts and little discoveries.</small>
              </span>
              <Download size={19} />
            </button>
          </div>
          <p className="form-note">
            <LockKeyhole size={14} /> Your export never passes through a server.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!importing}
        onOpenChange={(open) => {
          if (!open && !busy) setImporting(null);
        }}
      >
        <DialogContent className="app-dialog">
          <DialogTitle className="dialog-title">
            Bring your progress home.
          </DialogTitle>
          <DialogDescription>
            This backup contains {importing?.habits.length} habits and{' '}
            {importing?.entries.length.toLocaleString()} check-ins.
          </DialogDescription>
          <p className="import-note">
            We’ll merge these with your current data. Habits and check-ins with
            matching IDs will use the imported values. Everything else stays.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setImporting(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  importing &&
                  (await mutate(
                    () => db.mergeBackup(importing),
                    'Backup imported. Welcome back to your progress.',
                  ))
                )
                  setImporting(null);
              }}
            >
              {busy ? 'Importing…' : 'Import & merge'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={pwa.installHelp} onOpenChange={pwa.setInstallHelp}>
        <DialogContent className="app-dialog">
          <span className="data-icon">
            <Download size={24} />
          </span>
          <DialogTitle className="dialog-title">
            Make a little space for Streakfreak.
          </DialogTitle>
          <DialogDescription>
            Install from your browser on the device where you track your habits.
          </DialogDescription>
          <div className="install-instructions">
            <p>
              <b>iPhone or iPad</b>Open in Safari, tap Share, then Add to Home
              Screen.
            </p>
            <p>
              <b>Android</b>Open the browser menu and choose Install app or Add
              to Home screen.
            </p>
            <p>
              <b>Desktop</b>Look for the install icon in the address bar or your
              browser’s app menu.
            </p>
          </div>
          <p className="form-note">
            If install isn’t offered, keep using Streakfreak in this browser.
            Your habits still save locally.
          </p>
        </DialogContent>
      </Dialog>
      {storageError && (form || logging || deleting || importing) && (
        <div className="toast error-toast" role="alert">
          <span>{storageError}</span>
          <button
            onClick={() => setStorageError('')}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <output className="toast" aria-live="polite">
          <Check size={17} />
          <span>{notice}</span>
          <button
            onClick={() => setNotice('')}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </output>
      )}
    </div>
  );
}
