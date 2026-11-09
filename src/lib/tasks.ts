export const taskStatuses = ["To Do", "Pending", "Done", "Approved"] as const;
export const priorities = ["Low", "Medium", "High"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export type TaskFields = {
  title: string;
  date: string;
  deadline: string;
  assignedTo: string;
  assignedBy: string;
  priority: (typeof priorities)[number] | "";
  status: TaskStatus;
};
export type Task = TaskFields & { id: string; sectionId: string; createdAt: number };

export function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<Task>;
  return (
    typeof task.id === "string" &&
    typeof task.sectionId === "string" &&
    typeof task.createdAt === "number" &&
    typeof task.title === "string" &&
    !!task.title.trim() &&
    typeof task.assignedTo === "string" &&
    typeof task.assignedBy === "string" &&
    typeof task.date === "string" &&
    typeof task.deadline === "string" &&
    taskStatuses.some((status) => task.status === status) &&
    (task.priority === "" || priorities.some((priority) => task.priority === priority))
  );
}

export function newTaskFields(status: TaskStatus): TaskFields {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return { title: "", date, deadline: "", assignedTo: "", assignedBy: "", priority: "", status };
}
