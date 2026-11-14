import {
  attendanceId,
  attendanceStatuses,
  type AttendanceIndex,
  type AttendanceStatus,
} from "@/lib/attendance";
import { dayKey, fullDay, monthDays, periodLabel, weekdays } from "@/lib/calendar";
import type { Member } from "@/lib/members";

const statusColors = {
  Present: "bg-emerald-100 text-emerald-800",
  Late: "bg-amber-100 text-amber-900",
  Absent: "bg-red-100 text-red-800",
  Leave: "bg-violet-100 text-violet-800",
  WFH: "bg-sky-100 text-sky-800",
  Unmarked: "bg-neutral-100 text-neutral-600",
};

export function AttendanceBadge({
  status,
  compact = false,
}: {
  status?: AttendanceStatus | null;
  compact?: boolean;
}) {
  const label = status ?? "Unmarked";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[label]}${compact ? " attendance-cell-status" : ""}`}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      <span>{label}</span>
    </span>
  );
}

export function AttendanceSteps({
  unit,
  onStep,
}: {
  unit: "day" | "month";
  onStep: (step: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[-1, 1].map((step) => (
        <button
          key={step}
          type="button"
          className="calendar-step"
          aria-label={`${step < 0 ? "Previous" : "Next"} ${unit}`}
          onClick={() => onStep(step)}
        >
          {step < 0 ? "←" : "→"}
        </button>
      ))}
    </div>
  );
}

export function AttendanceCalendar({
  date,
  member,
  entries,
  onDay,
  onMonth,
}: {
  date: Date;
  member: Member;
  entries: AttendanceIndex;
  onDay: (date: Date) => void;
  onMonth: (step: number) => void;
}) {
  const selected = dayKey(date);
  const today = dayKey(new Date());
  return (
    <section aria-label={`Attendance calendar for ${member.name}`} className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" aria-live="polite">
          {periodLabel(date, "Monthly")}
        </h2>
        <AttendanceSteps unit="month" onStep={onMonth} />
      </div>
      <div className="calendar-grid attendance-grid">
        {weekdays.map((day) => (
          <span key={day} className="calendar-weekday">
            {day}
          </span>
        ))}
        {monthDays(date).map((day) => {
          const key = dayKey(day);
          if (day.getMonth() !== date.getMonth())
            return <div key={key} aria-hidden="true" className="calendar-cell" />;
          const entry = entries.get(attendanceId(member.id, key));
          return (
            <button
              type="button"
              key={key}
              className="calendar-cell attendance-day"
              aria-label={`${fullDay.format(day)}, ${entry?.status ?? "Unmarked"}${entry?.note ? ", has note" : ""}`}
              aria-pressed={key === selected}
              aria-current={key === today ? "date" : undefined}
              onClick={() => onDay(day)}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className="attendance-number">{day.getDate()}</span>
                {entry?.note && (
                  <span aria-hidden="true" className="size-1 rounded-full bg-neutral-500" />
                )}
              </span>
              {entry?.status && <AttendanceBadge status={entry.status} compact />}
            </button>
          );
        })}
      </div>
      <ul aria-label="Attendance status colors" className="mt-4 flex flex-wrap gap-1.5">
        {attendanceStatuses.map((status) => (
          <li key={status}>
            <AttendanceBadge status={status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
