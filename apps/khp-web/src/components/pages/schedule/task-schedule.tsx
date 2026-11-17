import { useEffect, useMemo, useState } from "react";
import { useMemberDirectory } from "@/stores/member-store";
import { createPortal } from "react-dom";
import { Modal } from "@/components/common/modal";
import { ScrollArea } from "@/components/common/scroll-area";
import {
  CalendarGrid,
  CalendarTask,
  CalendarYear,
} from "@/components/pages/calendar/calendar-grid";
import { GanttTimeline } from "@/components/pages/gantt/gantt-timeline";
import { TaskForm } from "@/components/pages/tasks/task-form";
import {
  type CalendarView,
  calendarViews,
  dayKey,
  fullDay,
  indexCalendarTasks,
  periodLabel,
  shiftPeriod,
} from "@/lib/calendar";
import { getWorkspaceMembers } from "@/lib/members";
import type { Task } from "@/lib/tasks";
import { type BoardItem, getPinAncestry } from "@/lib/workspaces";
import { listenToTaskStorage, useTaskStore } from "@/stores/task-store";

const periods = { Monthly: "month", Weekly: "week", Yearly: "year" } as const;

export function TaskSchedule({
  tool,
  byId,
}: {
  tool: "calendar" | "gantt";
  byId: ReadonlyMap<string, BoardItem>;
}) {
  const directory = useMemberDirectory();
  const isGantt = tool === "gantt";
  const title = isGantt ? "Gantt Chart" : "Calendar";
  const tasks = useTaskStore((state) => state.tasks);
  useEffect(listenToTaskStorage, []);
  const { byDay, unscheduled, ranges } = useMemo(() => indexCalendarTasks(tasks), [tasks]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("Monthly");
  const [agenda, setAgenda] = useState<Date | "unscheduled" | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const selected = agenda instanceof Date ? (byDay.get(dayKey(agenda)) ?? []) : unscheduled;
  const [workspace] = editing
    ? getPinAncestry(byId.get(editing.sectionId), (id) => byId.get(id))
    : [];
  const grid = { anchor, today: dayKey(new Date()), entries: byDay, onDay: setAgenda };
  const period = periodLabel(anchor, view);
  return (
    <div className="task-tool">
      <h1 className="sr-only">{title}</h1>
      <div className="calendar-toolbar">
        <fieldset aria-label={`${title} view`} className="flex gap-2">
          {calendarViews.map((mode) => (
            <button
              key={mode}
              type="button"
              className="calendar-mode"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode}
            </button>
          ))}
        </fieldset>
        <div className="calendar-navigation">
          {unscheduled.length > 0 && (
            <button
              type="button"
              className="calendar-unscheduled"
              onClick={() => setAgenda("unscheduled")}
            >
              Unscheduled ({unscheduled.length})
            </button>
          )}
          <h2 aria-live="polite" className="text-sm font-medium">
            {period}
          </h2>
          <div className="flex gap-1">
            {([-1, 1] as const).map((step) => (
              <button
                key={step}
                type="button"
                className="calendar-step"
                aria-label={`${step < 0 ? "Previous" : "Next"} ${periods[view]}`}
                onClick={() => setAnchor((date) => shiftPeriod(date, view, step))}
              >
                <span aria-hidden="true">{step < 0 ? "←" : "→"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <ScrollArea
        key={view + period}
        label={`${title} for ${period}`}
        className={`calendar-scroll ${isGantt ? "gantt-scroll" : ""}`}
      >
        {isGantt ? (
          <GanttTimeline
            anchor={anchor}
            view={view}
            ranges={ranges}
            today={grid.today}
            byId={byId}
            onEdit={setEditing}
            onJump={setAnchor}
          />
        ) : view === "Yearly" ? (
          <CalendarYear
            {...grid}
            onMonth={(month) => {
              setAnchor(month);
              setView("Monthly");
            }}
          />
        ) : (
          <CalendarGrid {...grid} weekly={view === "Weekly"} onEdit={setEditing} />
        )}
      </ScrollArea>
      {editing
        ? createPortal(
            <TaskForm
              task={editing}
              sectionId={editing.sectionId}
              status={editing.status}
              members={getWorkspaceMembers(workspace, directory)}
              onClose={() => setEditing(null)}
            />,
            document.body,
          )
        : agenda &&
          createPortal(
            <Modal
              title={agenda === "unscheduled" ? "Unscheduled tasks" : fullDay.format(agenda)}
              className="workspace-dialog"
              onClose={() => setAgenda(null)}
            >
              {selected.length ? (
                <ul className="grid gap-3">
                  {selected.map((entry) => (
                    <li key={entry.task.id} className="grid gap-1">
                      <CalendarTask entry={entry} onEdit={setEditing} />
                      <small className="text-neutral-600">
                        {[
                          byId.get(entry.task.sectionId)?.title,
                          entry.task.assignedTo || "Unassigned",
                          entry.task.status,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">
                  {agenda === "unscheduled" ? "All tasks have a date." : "No tasks on this day."}
                </p>
              )}
            </Modal>,
            document.body,
          )}
    </div>
  );
}
