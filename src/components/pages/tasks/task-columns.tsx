import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { taskStatuses, type Task, type TaskStatus } from "@/lib/tasks";
import { useTaskStore } from "@/stores/task-store";
import { TaskCard } from "./task-card";
import { TaskList } from "./task-list";

export function TaskColumns({
  tasks,
  onEdit,
  onAdd,
  sourceFor,
}: {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onAdd?: (status: TaskStatus) => void;
  sourceFor?: (task: Task) => { title: string; href: string } | undefined;
}) {
  const move = useTaskStore((state) => state.move);
  const [dragged, setDragged] = useState<Task | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [feedback, setFeedback] = useState({ text: "", error: false });

  function endDrag() {
    setDragged(null);
    setOver(null);
  }

  return (
    <>
      <div className="task-columns">
        {taskStatuses.map((status) => {
          const lane = tasks.filter((task) => task.status === status);
          return (
            <section
              key={status}
              aria-label={status}
              className="task-column"
              data-over={dragged && over === status && dragged.status !== status ? true : undefined}
              onDragOver={(event) => {
                if (!dragged) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOver(status);
              }}
              onDragLeave={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setOver(null);
              }}
              onDrop={(event) => {
                if (!dragged) return;
                event.preventDefault();
                try {
                  move(dragged.id, status);
                  setFeedback({ text: `${dragged.title} moved to ${status}.`, error: false });
                } catch (cause) {
                  setFeedback({
                    text: cause instanceof Error ? cause.message : "Unable to move the task.",
                    error: true,
                  });
                }
                endDrag();
              }}
            >
              <header className="mb-2 flex items-center justify-between gap-1">
                <h2 className="text-[clamp(23px,1.7vw,32px)] font-semibold leading-tight tracking-tight">
                  {status}
                </h2>
                {onAdd && lane.length > 0 && (
                  <button
                    type="button"
                    className="task-add-button"
                    aria-label={`Add task to ${status}`}
                    onClick={() => onAdd(status)}
                  >
                    <Icon name="plus" size={18} />
                  </button>
                )}
              </header>
              <TaskList label={`${status} tasks`}>
                {lane.map((task) => {
                  const source = sourceFor?.(task);
                  const card = (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={() => onEdit(task)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDragged(task);
                        setFeedback({ text: "", error: false });
                      }}
                      onDragEnd={endDrag}
                    />
                  );
                  return source ? (
                    <div key={task.id} className="grid gap-1.5">
                      {card}
                      <a
                        href={source.href}
                        aria-label={`Open board: ${source.title}`}
                        className="w-fit max-w-full truncate px-1 text-xs text-neutral-600 hover:underline"
                      >
                        {source.title} ↗
                      </a>
                    </div>
                  ) : (
                    card
                  );
                })}
                {lane.length === 0 &&
                  (onAdd ? (
                    <button
                      type="button"
                      className="task-empty"
                      aria-label={`Add task to ${status}`}
                      onClick={() => onAdd(status)}
                    >
                      <Icon name="plus" size={18} /> Add task
                    </button>
                  ) : (
                    <p className="text-sm text-neutral-500 py-3">No tasks</p>
                  ))}
              </TaskList>
            </section>
          );
        })}
      </div>
      <p role="status" className={feedback.error ? "mt-3 text-sm text-red-700" : "sr-only"}>
        {feedback.text}
      </p>
    </>
  );
}
