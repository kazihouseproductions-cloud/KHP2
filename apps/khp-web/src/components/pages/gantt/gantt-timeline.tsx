import { type CSSProperties, useLayoutEffect, useMemo, useRef } from "react";
import type { CalendarView, ScheduledTask } from "@/lib/calendar";
import { ganttPeriod, ganttRows, placeRange } from "@/lib/gantt";
import type { Task } from "@/lib/tasks";
import type { BoardItem } from "@/lib/workspaces";

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const unit = { Weekly: "week", Monthly: "month", Yearly: "year" } as const;

function GanttRow({
  row,
  section,
  onEdit,
}: {
  row: ReturnType<typeof ganttRows>[number];
  section?: string;
  onEdit: (task: Task) => void;
}) {
  const { task, start, end, bar } = row;
  const single = start === end;
  const from = new Date(start);
  const to = new Date(end);
  const range = longDate.formatRange(from, to);
  const detail = [section, task.assignedTo || "Unassigned"].filter(Boolean).join(" · ");
  const description = `${task.title} · ${range} · ${task.status}`;
  const style: CSSProperties = single
    ? { left: `${(bar.left + bar.width / 2) * 100}%` }
    : { left: `${bar.left * 100}%`, width: `${bar.width * 100}%` };
  return (
    <li className="gantt-row">
      <button
        type="button"
        className="gantt-name"
        aria-label={`Edit task: ${task.title}`}
        title={`${description} · ${detail}`}
        onClick={() => onEdit(task)}
      >
        <span className="block truncate text-sm font-medium">{task.title}</span>
        <span className="mt-0.5 block truncate text-xs text-neutral-500">{detail}</span>
      </button>
      <div className="gantt-track">
        <button
          type="button"
          className={single ? "gantt-marker" : "gantt-bar"}
          style={style}
          data-before={bar.before || undefined}
          data-after={bar.after || undefined}
          aria-label={description}
          title={description}
          onClick={() => onEdit(task)}
        >
          {single ? (
            <span aria-hidden="true" />
          ) : (
            <span className="gantt-bar-label">{shortDate.formatRange(from, to)}</span>
          )}
        </button>
      </div>
    </li>
  );
}

export function GanttTimeline({
  anchor,
  view,
  ranges,
  today,
  byId,
  onEdit,
  onJump,
}: {
  anchor: Date;
  view: CalendarView;
  ranges: readonly ScheduledTask[];
  today: string;
  byId: ReadonlyMap<string, BoardItem>;
  onEdit: (task: Task) => void;
  onJump: (day: Date) => void;
}) {
  const period = useMemo(() => ganttPeriod(anchor, view), [anchor, view]);
  const rows = useMemo(() => ganttRows(ranges, period), [ranges, period]);
  const todayBar = placeRange(today, today, period);
  const todayPosition = todayBar && todayBar.left + todayBar.width / 2;
  const ruler = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);
  const focus = todayPosition ?? rows[0]?.bar.left;
  useLayoutEffect(() => {
    // A narrow screen should open on today (or the first task), without resetting a user's scroll on edits.
    const axis = ruler.current;
    const scroll = axis?.closest<HTMLElement>(".gantt-scroll");
    if (!axis || !scroll || positioned.current || focus == null) return;
    positioned.current = true;
    if (scroll.scrollWidth > scroll.clientWidth) {
      const pinnedWidth = axis.offsetLeft;
      scroll.scrollLeft = focus * axis.clientWidth - (scroll.clientWidth - pinnedWidth) / 2;
    }
  }, [focus]);
  const columns = period.ticks.map((tick) => `minmax(0, ${tick.days}fr)`).join(" ");
  const vars = {
    "--ticks": columns,
    "--ruler-min": `${period.ticks.length * (view === "Monthly" ? 27 : 55)}px`,
  } as CSSProperties;
  const next = !rows.length && ranges.length ? closestDate(ranges, period.ticks[0].key) : null;
  return (
    <>
      <div className="gantt-sheet" style={vars}>
        {rows.length > 0 && (
          <div aria-hidden="true" className="gantt-guides">
            {period.ticks.map((tick) => (
              <span key={tick.key} />
            ))}
            {todayPosition !== null && (
              <i className="gantt-today" style={{ left: `${todayPosition * 100}%` }} />
            )}
          </div>
        )}
        <div className="gantt-heading">
          <div className="gantt-name flex items-center gap-2 text-sm font-medium">
            Tasks{" "}
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {rows.length}
            </span>
          </div>
          <div ref={ruler} className="gantt-ruler">
            {period.ticks.map((tick) => {
              const current =
                view === "Yearly" ? today.slice(0, 7) === tick.key.slice(0, 7) : today === tick.key;
              return (
                <span key={tick.key} aria-current={current ? "date" : undefined}>
                  {tick.weekday && (
                    <small>{view === "Monthly" ? tick.weekday[0] : tick.weekday}</small>
                  )}
                  {tick.label}
                </span>
              );
            })}
          </div>
        </div>
        <ul aria-label="Scheduled tasks">
          {rows.map((row) => (
            <GanttRow
              key={row.task.id}
              row={row}
              section={byId.get(row.task.sectionId)?.title}
              onEdit={onEdit}
            />
          ))}
        </ul>
      </div>
      {rows.length ? (
        <section className="gantt-key" aria-label="Chart legend">
          <span>
            <i className="h-2 w-5 rounded-full bg-[#76bfeb]" />
            Task span
          </span>
          <span>
            <i className="size-2 rotate-45 rounded-[1px] bg-[#4696be]" />
            Single day
          </span>
          {todayPosition !== null && (
            <span>
              <i className="h-3 border-l border-brand" />
              Today
            </span>
          )}
        </section>
      ) : (
        <div className="gantt-empty">
          <p className="text-sm font-medium">No tasks scheduled this {unit[view]}.</p>
          {next ? (
            <button
              type="button"
              className="mt-2 text-xs text-brand underline underline-offset-4"
              onClick={() => onJump(new Date(`${next}T12:00:00`))}
            >
              Go to {longDate.format(new Date(next))}
            </button>
          ) : (
            <p className="mt-1 text-xs text-neutral-500">
              Add a date or deadline to a board task to see it here.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function closestDate(ranges: readonly ScheduledTask[], start: string) {
  let closest = "";
  let best = Infinity;
  for (const range of ranges) {
    const key = range.end < start ? range.end : range.start;
    const distance = Math.abs(Date.parse(key) - Date.parse(start));
    if (distance < best) {
      closest = key;
      best = distance;
    }
  }
  return closest;
}
