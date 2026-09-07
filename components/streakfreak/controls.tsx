'use client';
import { useState } from 'react';
import {
  BookOpen,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Moon,
  NotebookPen,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  COLORS,
  ICONS,
  formatAmount,
  localDate,
  type Direction,
  type Entry,
  type Habit,
  type HabitIcon,
  type Preset,
} from '@/lib/habits';
export const habitIcons = {
  water: Droplets,
  steps: Footprints,
  sleep: Moon,
  screen: Smartphone,
  book: BookOpen,
  mind: Heart,
  workout: Dumbbell,
  journal: NotebookPen,
  spark: Sparkles,
};
export function HabitSymbol({
  icon,
  size = 23,
}: {
  icon: HabitIcon;
  size?: number;
}) {
  const Icon = habitIcons[icon];
  return <Icon size={size} />;
}
export function Choice({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
      items={options}
    >
      <SelectTrigger aria-label={label} className={`choice ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function HabitForm({
  initial,
  editing,
  busy,
  onSave,
  onClose,
  onDelete,
}: {
  initial: Habit | Preset;
  editing: boolean;
  busy: boolean;
  onSave: (h: Habit) => Promise<boolean>;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Habit>(() => ({
    ...initial,
    id: 'id' in initial ? initial.id : crypto.randomUUID(),
    startDate: 'startDate' in initial ? initial.startDate : localDate(),
  }));
  const [target, setTarget] = useState(String(initial.target));
  const [error, setError] = useState('');
  const field = <K extends keyof Habit>(key: K, value: Habit[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="app-dialog">
        <DialogTitle className="dialog-title">
          {editing ? 'Make it yours' : 'A small habit. A fresh start.'}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? 'Adjust your habit to fit your life.'
            : 'Set a goal that works for you. You can change it anytime.'}
        </DialogDescription>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            if (!target || Number(target) <= 0) {
              setError('Set a goal greater than zero.');
              return;
            }
            if (
              await onSave({
                ...form,
                name: form.name.trim(),
                description: form.description.trim(),
                unit: form.unit.trim(),
                target: Number(target),
              })
            )
              onClose();
          }}
          className="habit-form"
        >
          <label className="field-label">
            Habit name
            <input
              required
              maxLength={60}
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              placeholder="Something worth showing up for"
            />
          </label>
          <label className="field-label">
            A little motivation <span className="optional">optional</span>
            <input
              maxLength={160}
              value={form.description}
              onChange={(e) => field('description', e.target.value)}
              placeholder="A reminder to yourself"
            />
          </label>
          <div className="form-row">
            <label className="field-label">
              Daily goal
              <input
                required
                type="number"
                min="0.01"
                max="1000000"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label className="field-label">
              Unit
              <input
                required
                maxLength={24}
                value={form.unit}
                onChange={(e) => field('unit', e.target.value)}
                placeholder="minutes, glasses…"
              />
            </label>
          </div>
          <div className="field-label">
            Goal type
            <Choice
              label="Goal type"
              value={form.direction}
              onChange={(v) => field('direction', v as Direction)}
              options={[
                { value: 'atLeast', label: 'Reach at least this amount' },
                { value: 'atMost', label: 'Stay at or below this limit' },
              ]}
            />
          </div>
          <label className="field-label">
            Start date
            <input
              required
              type="date"
              min="2000-01-01"
              max={localDate()}
              value={form.startDate}
              onChange={(e) => field('startDate', e.target.value)}
            />
          </label>
          <div className="field-label">
            Pick an icon
            <RadioGroup
              aria-label="Habit icon"
              className="icon-choices"
              value={form.icon}
              onValueChange={(v) => field('icon', v as HabitIcon)}
            >
              {ICONS.map((icon) => (
                <label
                  htmlFor={`habit-icon-${icon}`}
                  className={`icon-option ${form.color} ${form.icon === icon ? 'selected' : ''}`}
                  key={icon}
                >
                  <RadioGroupItem
                    id={`habit-icon-${icon}`}
                    value={icon}
                    aria-label={icon}
                    className="sr-only"
                  />
                  <HabitSymbol icon={icon} size={20} />
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="field-label">
            Make it your color
            <RadioGroup
              aria-label="Habit color"
              className="color-choices"
              value={form.color}
              onValueChange={(v) => field('color', v as Habit['color'])}
            >
              {COLORS.map((color) => (
                <label
                  htmlFor={`habit-color-${color}`}
                  key={color}
                  className={`color-option ${color} ${form.color === color ? 'selected' : ''}`}
                >
                  <RadioGroupItem
                    id={`habit-color-${color}`}
                    value={color}
                    aria-label={color}
                    className="sr-only"
                  />
                  {form.color === color && <Check size={16} />}
                </label>
              ))}
            </RadioGroup>
          </div>
          {editing && (
            <p className="form-note">
              New goals apply to new check-ins. Existing entries keep the goal
              they were logged against.
            </p>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {editing && (
              <button
                type="button"
                disabled={busy}
                className="text-button danger"
                onClick={onDelete}
              >
                <Trash2 size={15} /> Delete habit
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button disabled={busy} className="button primary" type="submit">
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add habit'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function CheckIn({
  habit,
  date,
  entry,
  busy,
  onSave,
  onRemove,
  onClose,
}: {
  habit: Habit;
  date: string;
  entry?: Entry;
  busy: boolean;
  onSave: (value: number) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(entry ? String(entry.value) : '');
  const target = entry?.target ?? habit.target;
  const direction = entry?.direction ?? habit.direction;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className={`app-dialog checkin-dialog ${habit.color}`}>
        <span className="habit-icon">
          <HabitSymbol icon={habit.icon} />
        </span>
        <DialogTitle className="dialog-title">{habit.name}</DialogTitle>
        <DialogDescription>
          {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </DialogDescription>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (value !== '' && (await onSave(Number(value)))) onClose();
          }}
        >
          <label className="field-label log-field">
            How did you do?
            <div className="amount-field">
              <input
                required
                inputMode="decimal"
                type="number"
                min="0"
                max="1000000"
                step="any"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <span>{habit.unit}</span>
            </div>
          </label>
          {habit.icon === 'water' && (
            <div className="quick-values">
              {[1, 2, 4, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="button secondary"
                  onClick={() => setValue(String(Number(value || 0) + n))}
                >
                  +{n} {n === 1 ? 'glass' : 'glasses'}
                </button>
              ))}
            </div>
          )}
          {habit.target === 1 && habit.unit === 'check-in' && (
            <button
              type="button"
              className="button secondary full-width"
              onClick={() => setValue('1')}
            >
              <Check size={17} /> I did it
            </button>
          )}
          <p className="goal-note">
            <Flame size={16} />
            {direction === 'atMost' ? 'Stay at or below' : 'Reach'}{' '}
            {formatAmount(target)} {habit.unit} to complete the day.
          </p>
          {direction === 'atMost' && (
            <p className="form-note">
              Log your actual total when your day is done. Zero counts too.
            </p>
          )}
          <div className="dialog-actions">
            {entry && (
              <button
                disabled={busy}
                type="button"
                className="text-button danger"
                onClick={async () => {
                  if (await onRemove()) onClose();
                }}
              >
                Clear check-in
              </button>
            )}
            <button disabled={busy} type="submit" className="button primary">
              {busy ? 'Saving…' : 'Save check-in'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
