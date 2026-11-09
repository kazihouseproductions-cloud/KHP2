import type { DragEvent } from "react";
import type { Task } from "@/lib/tasks";

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function displayDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? dateFormat.format(date) : "—";
}

export function TaskCard({
  task,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  onEdit: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      className="task-card"
      aria-label={`Edit task: ${task.title}`}
      onClick={onEdit}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 break-words text-[clamp(16px,1.05vw,20px)] font-semibold leading-tight">
          {task.title}
        </span>
        <span className="grid shrink-0 gap-1 text-xs leading-tight text-neutral-500">
          <span title="Date">
            {task.date ? <time dateTime={task.date}>{displayDate(task.date)}</time> : "Date"}
          </span>
          <span className="font-medium" title="Deadline">
            {task.deadline ? (
              <time dateTime={task.deadline}>Due {displayDate(task.deadline)}</time>
            ) : (
              "Deadline"
            )}
          </span>
        </span>
      </span>
      <span className="mt-auto grid grid-cols-2 gap-2 pt-5 text-xs leading-snug">
        <span className="break-words">
          <strong>Assigned to:</strong> {task.assignedTo || "—"}
        </span>
        <span className="justify-self-end break-words">
          <strong>Assigned by:</strong> {task.assignedBy || "—"}
        </span>
      </span>
      <span className="mt-3 text-xs">
        <strong>Priority:</strong> {task.priority || "—"}
      </span>
    </button>
  );
}
