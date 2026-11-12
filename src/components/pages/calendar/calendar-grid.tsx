import { MemberAvatar } from "@/components/ui/member-avatar";
import {
  type CalendarEntry,
  type EntriesByDay,
  dayKey,
  fullDay,
  monthDays,
  weekDays,
  weekdays,
} from "@/lib/calendar";
import { demoMembers } from "@/lib/members";
import type { Task } from "@/lib/tasks";

export function CalendarTask({
  entry: { task, due },
  onEdit,
}: {
  entry: CalendarEntry;
  onEdit: (task: Task) => void;
}) {
  const member = demoMembers.find(
    (person) => person.name.toLowerCase() === task.assignedTo.trim().toLowerCase(),
  );
  const label = `${due ? "Due: " : ""}${task.title} · ${task.assignedTo || "Unassigned"}`;
  return (
    <button
      type="button"
      className="calendar-task"
      title={label}
      aria-label={label}
      onClick={() => onEdit(task)}
    >
      <span className="truncate">
        {due && <b className="font-semibold">Due: </b>}
        {task.title}
      </span>
      {member ? (
        <MemberAvatar member={member} />
      ) : (
        <span aria-hidden="true" className="calendar-dot" />
      )}
    </button>
  );
}

type CalendarGridProps = {
  anchor: Date;
  today: string;
  entries: EntriesByDay;
  onDay: (day: Date) => void;
};

export function CalendarGrid({
  anchor,
  today,
  entries,
  weekly,
  onDay,
  onEdit,
}: CalendarGridProps & {
  weekly: boolean;
  onEdit: (task: Task) => void;
}) {
  const days = weekly ? weekDays(anchor) : monthDays(anchor);
  return (
    <div className={`calendar-grid ${weekly ? "calendar-week" : ""}`}>
      {weekdays.map((name) => (
        <span key={name} className="calendar-weekday">
          {name}
        </span>
      ))}
      {days.map((day, index) => {
        const key = dayKey(day);
        if (!weekly && day.getMonth() !== anchor.getMonth())
          return <div key={key} aria-hidden="true" className="calendar-cell" />;
        const items = entries.get(key) ?? [];
        const dateLabel = fullDay.format(day);
        return (
          <section key={key} className="calendar-cell" aria-label={dateLabel}>
            <div className="grid content-start gap-1">
              {(weekly ? items : items.slice(0, 1)).map((entry) => (
                <CalendarTask key={entry.task.id} entry={entry} onEdit={onEdit} />
              ))}
            </div>
            <div className="calendar-cell-footer">
              {!weekly && items.length > 1 && (
                <button
                  type="button"
                  className="calendar-more"
                  aria-label={`Show all ${items.length} tasks for ${dateLabel}`}
                  onClick={() => onDay(day)}
                >
                  +{items.length - 1}
                  <span className="max-sm:hidden"> more</span>
                </button>
              )}
              <button
                type="button"
                className="calendar-date"
                aria-current={key === today ? "date" : undefined}
                aria-label={`View ${dateLabel}, ${items.length} tasks`}
                onClick={() => onDay(day)}
              >
                <span className="calendar-mobile-weekday">{weekdays[index % 7]}</span>
                {day.getDate()}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

const monthName = new Intl.DateTimeFormat("en-US", { month: "long" });

export function CalendarYear({
  anchor,
  today,
  entries,
  onDay,
  onMonth,
}: CalendarGridProps & {
  onMonth: (month: Date) => void;
}) {
  return (
    <div className="calendar-year">
      {Array.from({ length: 12 }, (_, i) => {
        const month = new Date(anchor.getFullYear(), i, 1, 12);
        const name = monthName.format(month);
        return (
          <section key={name} aria-label={name} className="min-w-0">
            <h2>
              <button
                type="button"
                onClick={() => onMonth(month)}
                className="mb-2 font-medium hover:underline"
              >
                {name}
              </button>
            </h2>
            <div className="grid grid-cols-7 text-center text-xs">
              {weekdays.map((day) => (
                <span key={day} className="mb-1 text-neutral-500">
                  {day[0]}
                </span>
              ))}
              {monthDays(month).map((day) => {
                const key = dayKey(day);
                if (day.getMonth() !== i) return <span key={key} />;
                const count = entries.get(key)?.length ?? 0;
                return count ? (
                  <button
                    key={key}
                    type="button"
                    aria-label={`View ${fullDay.format(day)}, ${count} tasks`}
                    aria-current={key === today ? "date" : undefined}
                    onClick={() => onDay(day)}
                    className="calendar-mini-date has-tasks"
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <span
                    key={key}
                    aria-current={key === today ? "date" : undefined}
                    className="calendar-mini-date"
                  >
                    {day.getDate()}
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
