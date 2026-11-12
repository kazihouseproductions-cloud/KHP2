import { type CalendarView, type ScheduledTask, dayKey, weekDays } from "./calendar";

const monthName = new Intl.DateTimeFormat("en-US", { month: "short" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });

// Use UTC only to measure the distance between date-only keys, including across DST.
function dayNumber(key: string) {
  return Date.parse(`${key}T00:00:00Z`) / 86_400_000;
}

export function ganttPeriod(anchor: Date, view: CalendarView) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const annual = view === "Yearly";
  const dates =
    view === "Weekly"
      ? weekDays(anchor)
      : Array.from({ length: annual ? 12 : new Date(year, month + 1, 0).getDate() }, (_, i) =>
          annual ? new Date(year, i, 1, 12) : new Date(year, month, i + 1, 12),
        );
  const ticks = dates.map((date) => ({
    key: dayKey(date),
    days: annual ? new Date(year, date.getMonth() + 1, 0).getDate() : 1,
    label: annual ? monthName.format(date) : String(date.getDate()),
    weekday: annual ? "" : weekday.format(date),
  }));
  const first = dayNumber(ticks[0].key);
  const days = ticks.reduce((sum, tick) => sum + tick.days, 0);
  return { ticks, first, days };
}

type Period = ReturnType<typeof ganttPeriod>;

// Fractions refer to the visible period; the deadline occupies a whole day.
export function placeRange(start: string, end: string, period: Period) {
  const from = dayNumber(start) - period.first;
  const until = dayNumber(end) + 1 - period.first;
  if (until <= 0 || from >= period.days) return null;
  const left = Math.max(0, from);
  const right = Math.min(period.days, until);
  return {
    left: left / period.days,
    width: (right - left) / period.days,
    before: from < 0,
    after: until > period.days,
  };
}

export function ganttRows(ranges: readonly ScheduledTask[], period: Period) {
  return ranges
    .flatMap((range) => {
      const bar = placeRange(range.start, range.end, period);
      return bar ? [{ ...range, bar }] : [];
    })
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.end.localeCompare(b.end) ||
        a.task.title.localeCompare(b.task.title),
    );
}
