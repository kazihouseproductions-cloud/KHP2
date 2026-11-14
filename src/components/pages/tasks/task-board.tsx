import { useEffect, useMemo, useState } from "react";
import { useMemberDirectory } from "@/stores/member-store";
import { createPortal } from "react-dom";
import { WorkspaceBranch } from "@/components/pages/workspace/workspace-branch";
import { getWorkspaceMembers } from "@/lib/members";
import type { Task, TaskStatus } from "@/lib/tasks";
import { type BoardItem, type BoardStep, collectPinIds } from "@/lib/workspaces";
import { listenToTaskStorage, useTaskStore } from "@/stores/task-store";
import { TaskColumns } from "./task-columns";
import { TaskForm } from "./task-form";

export function TaskBoard({
  path,
  items,
  sectionView = false,
}: {
  path: BoardStep[];
  items: BoardItem[];
  sectionView?: boolean;
}) {
  const directory = useMemberDirectory();
  const section = path[path.length - 1];
  const sectionId = section.item.id;
  const sectionIds = useMemo(
    () => (sectionView ? collectPinIds(items, sectionId) : new Set([sectionId])),
    [items, sectionId, sectionView],
  );
  const tasks = useTaskStore((state) => state.tasks).filter((task) =>
    sectionIds.has(task.sectionId),
  );
  const [form, setForm] = useState<{ status: TaskStatus; task?: Task } | null>(null);
  useEffect(listenToTaskStorage, []);

  return (
    <div className={sectionView ? "member-task-board" : "task-board"}>
      <header className="mb-4">
        {sectionView && (
          <a href={section.href} className="text-xs text-neutral-600 hover:underline">
            ← Back to {section.item.title}
          </a>
        )}
        <h1 className="mt-1 text-xl font-semibold" aria-label={`${section.item.title} task board`}>
          {section.item.title}
        </h1>
      </header>
      {!sectionView && <WorkspaceBranch path={path} endpoint="tasks" />}
      <TaskColumns
        tasks={tasks}
        onAdd={(status) => setForm({ status })}
        onEdit={(task) => setForm({ status: task.status, task })}
      />
      {form &&
        createPortal(
          <TaskForm
            sectionId={form.task?.sectionId ?? sectionId}
            members={getWorkspaceMembers(path[0]?.item, directory)}
            task={form.task}
            status={form.status}
            onClose={() => setForm(null)}
          />,
          document.body,
        )}
    </div>
  );
}
