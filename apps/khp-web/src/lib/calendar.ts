import type { Task } from "./tasks";

export const calendarViews = ["Monthly", "Weekly", "Yearly"] as const;
export type CalendarView = (typeof calendarViews)[number];
export const weekdays = ["Sat", "Sun", "Mon", "Tues", "Wed", "Thu", "Fri"] as const;
export type CalendarEntry = { task: Task; due: boolean };
export type ScheduledTask = { task: Task; start: string; end: string };
export type EntriesByDay = ReadonlyMap<string, CalendarEntry[]>;

export const fullDay = new Intl.DateTimeFormat("en-US", { dateStyle: "full" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const weekLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Task dates are civil dates, not timestamps. Keep calendar arithmetic in local time.
export function dayKey(day: Date) {
  return [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map((part, i) => String(part).padStart(i === 0 ? 4 : 2, "0"))
    .join("-");
}

export function addDays(day: Date, count: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + count, 12);
}

export function weekDays(day: Date) {
  const offset = (day.getDay() + 1) % 7;
  return Array.from({ length: 7 }, (_, index) => addDays(day, index - offset));
}

export function monthDays(month: Date) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const start = (new Date(year, m, 1).getDay() + 1) % 7;
  const length = new Date(year, m + 1, 0).getDate();
  return Array.from({ length: Math.ceil((start + length) / 7) * 7 }, (_, i) =>
    new Date(year, m, i - start + 1, 12)
  );
}

export function shiftPeriod(date: Date, view: CalendarView, step: number) {
  if (view === "Weekly") return addDays(date, 7 * step);
  const month = date.getMonth() + (view === "Yearly" ? 12 : 1) * step;
  const last = new Date(date.getFullYear(), month + 1, 0).getDate();
  return new Date(date.getFullYear(), month, Math.min(date.getDate(), last), 12);
}

export function periodLabel(date: Date, view: CalendarView) {
  if (view === "Yearly") return String(date.getFullYear());
  if (view === "Monthly") return monthYear.format(date);
  const days = weekDays(date);
  return weekLabel.formatRange(days[0], days[6]);
}

export function usableDate(key: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && dayKey(new Date(`${key}T12:00:00`)) === key;
}

export function indexCalendarTasks(tasks: readonly Task[]) {
  const byDay = new Map<string, CalendarEntry[]>();
  const unscheduled: CalendarEntry[] = [];
  const ranges: ScheduledTask[] = [];
  function add(key: string, entry: CalendarEntry) {
    const entries = byDay.get(key);
    if (entries) entries.push(entry);
    else byDay.set(key, [entry]);
  }
  for (const task of tasks) {
    const scheduled = usableDate(task.date);
    const due = usableDate(task.deadline);
    if (scheduled && task.date !== task.deadline) add(task.date, { task, due: false });
    if (due) add(task.deadline, { task, due: true });
    if (!scheduled && !due) unscheduled.push({ task, due: false });
    else {
      const start = scheduled ? task.date : task.deadline;
      ranges.push({ task, start, end: due && task.deadline >= start ? task.deadline : start });
    }
  }
  return { byDay, unscheduled, ranges };
}
