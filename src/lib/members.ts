import type { Task } from "@/lib/tasks";
import { type BoardItem, getPinAncestry } from "@/lib/workspaces";

export const previewMember = {
  id: "ayesha",
  name: "Ayesha Rahman",
  role: "Project Manager",
  initials: "AR",
  color: "violet",
} as const;

export const demoMembers = [
  previewMember,
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

export function getWorkspaceMembers(workspace: BoardItem | undefined) {
  const memberIds = workspace ? getPinMemberIds(workspace) : [];
  return demoMembers.filter((member) => memberIds.includes(member.id));
}

export function getAssignableMembers(
  item: BoardItem,
  findItem: (id: string) => BoardItem | undefined,
) {
  if (item.parentId === null) return demoMembers;
  const [workspace] = getPinAncestry(item, findItem);
  return getWorkspaceMembers(workspace);
}

export function pinMatchesMember(item: { memberIds?: string[] }, memberId: string | null) {
  return memberId === null || getPinMemberIds(item).includes(memberId);
}

export function memberNameKey(name: string) {
  return name.trim().toLowerCase();
}

export function findMemberTasks(tasks: Task[], memberName: string) {
  const name = memberNameKey(memberName);
  return tasks.filter((task) => memberNameKey(task.assignedTo) === name);
}
