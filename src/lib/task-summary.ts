import { demoMembers, type Member, memberNameKey } from "./members";
import { taskStatuses, type Task, type TaskStatus } from "./tasks";

export type MemberCount = { name: string; member?: Member; count: number; approved: number };

export function summarizeTasks(tasks: readonly Task[], directory: readonly Member[] = demoMembers) {
  const statuses = new Map<TaskStatus, number>();
  const members = new Map<string, MemberCount>(
    directory.map((member) => [
      memberNameKey(member.name),
      { name: member.name, member, count: 0, approved: 0 },
    ]),
  );
  let unassigned = 0;
  for (const task of tasks) {
    statuses.set(task.status, (statuses.get(task.status) ?? 0) + 1);
    const key = memberNameKey(task.assignedTo);
    if (!key) {
      unassigned++;
      continue;
    }
    let row = members.get(key);
    // Older tasks can have an assignee who isn't in the current member directory.
    if (!row) {
      row = { name: task.assignedTo.trim(), count: 0, approved: 0 };
      members.set(key, row);
    }
    row.count++;
    if (task.status === "Approved") row.approved++;
  }
  return {
    total: tasks.length,
    statuses: taskStatuses.map((status) => ({ status, count: statuses.get(status) ?? 0 })),
    members: [...members.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    ),
    unassigned,
  };
}
