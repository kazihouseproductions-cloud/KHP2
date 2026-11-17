import { create } from "zustand";
import { withActivity, workspaceRefs } from "@/lib/activity-log";
import { readBoardItems } from "@/lib/board-records";
import { readRecords, watchRecords } from "@/lib/local-records";
import { readMemberDirectory } from "@/lib/member-records";
import { getWorkspaceMembers, indexMemberNames, type Member, memberNameKey } from "@/lib/members";
import { taskChange, taskPrefix as prefix, withTaskHistory } from "@/lib/task-history";
import { isTask, type Task, type TaskFields, type TaskStatus } from "@/lib/tasks";
import { type BoardItem, getPinAncestry, indexBoardItems } from "@/lib/workspaces";

function resolveTaskNames(task: Task, names: ReadonlyMap<string, Member>): Task {
  const assignedTo = names.get(memberNameKey(task.assignedTo))?.name ?? task.assignedTo;
  const assignedBy = names.get(memberNameKey(task.assignedBy))?.name ?? task.assignedBy;
  return assignedTo === task.assignedTo && assignedBy === task.assignedBy
    ? task
    : { ...task, assignedTo, assignedBy };
}

function readTask(id: string): Task {
  const stored: unknown = JSON.parse(localStorage.getItem(prefix + id) ?? "null");
  if (!isTask(stored) || stored.id !== id) throw new Error("This task is no longer available.");
  return resolveTaskNames(stored, indexMemberNames(readMemberDirectory()));
}

type TaskStore = {
  tasks: Task[];
  load: () => void;
  save: (sectionId: string, fields: TaskFields, original?: Task) => void;
  move: (id: string, status: TaskStatus) => void;
};

export const useTaskStore = create<TaskStore>((set) => {
  function persist(task: Task, path: BoardItem[], previous?: Task) {
    const details: string[] = [];
    if (previous) {
      if (task.status !== previous.status) details.push(`${previous.status} → ${task.status}`);
      if (task.title !== previous.title) details.push(`Previously “${previous.title}”`);
      for (const [key, label] of [
        ["assignedTo", "Assignee"],
        ["assignedBy", "Assigned by"],
        ["priority", "Priority"],
        ["date", "Start date"],
        ["deadline", "Deadline"],
      ] as const) {
        if (task[key] !== previous[key])
          details.push(`${label}: ${previous[key] || "None"} → ${task[key] || "None"}`);
      }
      if (task.sectionId !== previous.sectionId) details.push(`Moved to “${path.at(-1)?.title}”`);
      if (!details.length) return;
    } else {
      details.push(task.status);
      if (task.assignedTo) details.push(`Assigned to ${task.assignedTo}`);
    }
    try {
      const approvals = Number(task.status === "Approved" && previous?.status !== "Approved");
      const action = previous ? (previous.status !== task.status ? "Moved" : "Updated") : "Created";
      withActivity(
        {
          area: "Tasks",
          description: `${action} task “${task.title}”`,
          detail: details.join(" · "),
          workspaces: workspaceRefs(path.slice(0, 1)),
        },
        () =>
          withTaskHistory(taskChange(previous ? [previous] : [], [task], approvals), () =>
            localStorage.setItem(prefix + task.id, JSON.stringify(task)),
          ),
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
        const names = indexMemberNames(readMemberDirectory());
        set({ tasks: readRecords(prefix, isTask).map((task) => resolveTaskNames(task, names)) });
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
      const { byId } = indexBoardItems(readBoardItems());
      const path = getPinAncestry(byId.get(sectionId), (id) => byId.get(id));
      if (!path.length) throw new Error("This section is no longer available.");
      const members = getWorkspaceMembers(path[0], readMemberDirectory());
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
        path,
        original,
      );
    },
    move(id, status) {
      const task = readTask(id);
      if (task.status === status) return;
      const { byId } = indexBoardItems(readBoardItems());
      const path = getPinAncestry(byId.get(task.sectionId), (id) => byId.get(id));
      persist({ ...task, status }, path, task);
    },
  };
});

export function listenToTaskStorage() {
  return watchRecords(prefix, useTaskStore.getState().load);
}
