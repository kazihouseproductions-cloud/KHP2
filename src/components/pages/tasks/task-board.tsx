import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { WorkspaceBranch } from "@/components/pages/workspace/workspace-branch";
import { taskStatuses, type Task, type TaskStatus } from "@/lib/tasks";
import type { BoardStep } from "@/lib/workspaces";
import { listenToTaskStorage, useTaskStore } from "@/stores/task-store";
import { TaskCard } from "./task-card";
import { TaskForm } from "./task-form";
import { TaskList } from "./task-list";

export function TaskBoard({ path, sectionId }: { path: BoardStep[]; sectionId: string }) {
  const tasks = useTaskStore((state) => state.tasks).filter((task) => task.sectionId === sectionId);
  const move = useTaskStore((state) => state.move);
  const [form, setForm] = useState<{ status: TaskStatus; task?: Task } | null>(null);
  const [dragged, setDragged] = useState<Task | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [feedback, setFeedback] = useState({ text: "", error: false });
  useEffect(listenToTaskStorage, []);

  function endDrag() {
    setDragged(null);
    setOver(null);
  }

  return (
    <div className="task-board">
      <h1 className="sr-only">{path.at(-1)?.item.title} task board</h1>
      <WorkspaceBranch path={path} endpoint="tasks" />
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
                {lane.length > 0 && (
                  <button
                    type="button"
                    className="task-add-button"
                    aria-label={`Add task to ${status}`}
                    onClick={() => setForm({ status })}
                  >
                    <Icon name="plus" size={18} />
                  </button>
                )}
              </header>
              <TaskList label={`${status} tasks`}>
                {lane.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => setForm({ status, task })}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragged(task);
                      setFeedback({ text: "", error: false });
                    }}
                    onDragEnd={endDrag}
                  />
                ))}
                {lane.length === 0 && (
                  <button
                    type="button"
                    className="task-empty"
                    aria-label={`Add task to ${status}`}
                    onClick={() => setForm({ status })}
                  >
                    <Icon name="plus" size={18} /> Add task
                  </button>
                )}
              </TaskList>
            </section>
          );
        })}
      </div>
      <p role="status" className={feedback.error ? "mt-3 text-sm text-red-700" : "sr-only"}>
        {feedback.text}
      </p>
      {form &&
        createPortal(
          <TaskForm
            sectionId={sectionId}
            task={form.task}
            status={form.status}
            onClose={() => setForm(null)}
          />,
          document.body,
        )}
    </div>
  );
}
