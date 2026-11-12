import type { Task } from "@/lib/tasks";

export const demoMembers = [
  { id: "ayesha", name: "Ayesha Rahman", role: "Project Manager", initials: "AR", color: "violet" },
  { id: "tanvir", name: "Tanvir Hasan", role: "Animator", initials: "TH", color: "blue" },
  { id: "nadia", name: "Nadia Ahmed", role: "Designer", initials: "NA", color: "rose" },
  { id: "rafi", name: "Rafi Islam", role: "Developer", initials: "RI", color: "amber" },
  { id: "samira", name: "Samira Khan", role: "Content Writer", initials: "SK", color: "green" },
] as const;

export type DemoMember = (typeof demoMembers)[number];
export const defaultMemberIds = ["ayesha", "tanvir"];

export function getPinMemberIds(item: { memberIds?: string[] }) {
  return item.memberIds ?? defaultMemberIds;
}

export function pinMatchesMember(item: { memberIds?: string[] }, memberId: string | null) {
  return memberId === null || getPinMemberIds(item).includes(memberId);
}

export function findMemberTasks(tasks: Task[], memberName: string) {
  const name = memberName.trim().toLowerCase();
  return tasks.filter((task) => task.assignedTo.trim().toLowerCase() === name);
}
