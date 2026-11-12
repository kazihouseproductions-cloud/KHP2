import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WorkspaceBranch } from "@/components/pages/workspace/workspace-branch";
import { getWorkspaceMembers } from "@/lib/members";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { BoardStep } from "@/lib/workspaces";
import { listenToTaskStorage, useTaskStore } from "@/stores/task-store";
import { TaskColumns } from "./task-columns";
import { TaskForm } from "./task-form";

export function TaskBoard({ path, sectionId }: { path: BoardStep[]; sectionId: string }) {
  const tasks = useTaskStore((state) => state.tasks).filter((task) => task.sectionId === sectionId);
  const [form, setForm] = useState<{ status: TaskStatus; task?: Task } | null>(null);
  useEffect(listenToTaskStorage, []);

  return (
    <div className="task-board">
      <h1 className="sr-only">{path.at(-1)?.item.title} task board</h1>
      <WorkspaceBranch path={path} endpoint="tasks" />
      <TaskColumns
        tasks={tasks}
        onAdd={(status) => setForm({ status })}
        onEdit={(task) => setForm({ status: task.status, task })}
      />
      {form &&
        createPortal(
          <TaskForm
            sectionId={sectionId}
            members={getWorkspaceMembers(path[0]?.item)}
            task={form.task}
            status={form.status}
            onClose={() => setForm(null)}
          />,
          document.body,
        )}
    </div>
  );
}
