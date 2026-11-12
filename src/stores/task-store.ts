import { create } from "zustand";
import { readBoardItem } from "@/lib/board-records";
import { readRecords, watchRecords } from "@/lib/local-records";
import { getWorkspaceMembers } from "@/lib/members";
import { taskChange, taskPrefix as prefix, withTaskHistory } from "@/lib/task-history";
import { isTask, type Task, type TaskFields, type TaskStatus } from "@/lib/tasks";
import { getPinAncestry, isTaskBoard } from "@/lib/workspaces";

function readTask(id: string): Task {
  const stored: unknown = JSON.parse(localStorage.getItem(prefix + id) ?? "null");
  if (!isTask(stored) || stored.id !== id) throw new Error("This task is no longer available.");
  return stored;
}

type TaskStore = {
  tasks: Task[];
  load: () => void;
  save: (sectionId: string, fields: TaskFields, original?: Task) => void;
  move: (id: string, status: TaskStatus) => void;
};

export const useTaskStore = create<TaskStore>((set) => {
  function persist(task: Task, previous?: Task) {
    try {
      const approvals = Number(task.status === "Approved" && previous?.status !== "Approved");
      withTaskHistory(taskChange(previous ? [previous] : [], [task], approvals), () =>
        localStorage.setItem(prefix + task.id, JSON.stringify(task)),
      );
    } catch {
      throw new Error("Your browser could not save the task. Allow local storage and try again.");
    }
    set((state) => ({
      tasks: state.tasks.some((entry) => entry.id === task.id)
        ? state.tasks.map((entry) => (entry.id === task.id ? task : entry))
        : [...state.tasks, task],
    }));
  }

  return {
    tasks: [],
    load: () => {
      try {
        set({ tasks: readRecords(prefix, isTask) });
      } catch {
        // The board can still be viewed when browser storage is disabled.
      }
    },
    save(sectionId, fields, original) {
      const title = fields.title.trim();
      if (!title || title.length > 120)
        throw new Error("Enter a task title between 1 and 120 characters.");
      if (fields.date && fields.deadline && fields.deadline < fields.date)
        throw new Error("The deadline must be on or after the task date.");
      if (original && JSON.stringify(readTask(original.id)) !== JSON.stringify(original))
        throw new Error(
          "This task changed in another tab. Close and reopen it to edit the latest version.",
        );
      const section = readBoardItem(sectionId);
      const path = getPinAncestry(section, readBoardItem);
      if (!path.length || !isTaskBoard(section, path.length))
        throw new Error("End this branch before creating tasks here.");
      const members = getWorkspaceMembers(path[0]);
      for (const field of ["assignedTo", "assignedBy"] as const) {
        const name = fields[field].trim();
        if (!name || (original?.sectionId === sectionId && name === original[field].trim()))
          continue;
        if (!members.some((member) => member.name === name)) {
          const label = field === "assignedTo" ? "Assigned to" : "Assigned by";
          throw new Error(`Choose a current workspace member for “${label}” or clear the field.`);
        }
      }
      persist(
        {
          ...fields,
          title,
          assignedTo: fields.assignedTo.trim(),
          assignedBy: fields.assignedBy.trim(),
          sectionId,
          id: original?.id ?? crypto.randomUUID(),
          createdAt: original?.createdAt ?? Date.now(),
        },
        original,
      );
    },
    move(id, status) {
      const task = readTask(id);
      if (task.status !== status) persist({ ...task, status }, task);
    },
  };
});

export function listenToTaskStorage() {
  return watchRecords(prefix, useTaskStore.getState().load);
}
