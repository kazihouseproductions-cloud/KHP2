import type { Task } from "@/lib/tasks";
import { type BoardItem, getPinAncestry, indexBoardItems } from "@/lib/workspaces";

export const memberRoles = ["Member", "Admin", "Executive"] as const;
export type MemberRole = (typeof memberRoles)[number];

export const previewMember = {
  id: "ayesha",
  name: "Ayesha Rahman",
  role: "Member",
  jobTitle: "Project Manager",
  initials: "AR",
  color: "violet",
} as const;

export const demoMembers = [
  previewMember,
  {
    id: "tanvir",
    name: "Tanvir Hasan",
    role: "Member",
    jobTitle: "Animator",
    initials: "TH",
    color: "blue",
  },
  {
    id: "nadia",
    name: "Nadia Ahmed",
    role: "Member",
    jobTitle: "Designer",
    initials: "NA",
    color: "rose",
  },
  {
    id: "rafi",
    name: "Rafi Islam",
    role: "Member",
    jobTitle: "Developer",
    initials: "RI",
    color: "amber",
  },
  {
    id: "samira",
    name: "Samira Khan",
    role: "Member",
    jobTitle: "Content Writer",
    initials: "SK",
    color: "green",
  },
] as const;

export type Member = {
  id: string;
  name: string;
  role: MemberRole;
  jobTitle?: string;
  email?: string;
  photo?: string;
  formerNames?: string[];
  initials: string;
  color: (typeof demoMembers)[number]["color"];
};
export const defaultMemberIds = ["ayesha", "tanvir"];

export function currentMember(directory: readonly Member[]): Member {
  return directory.find((member) => member.id === previewMember.id) ?? previewMember;
}

export function getPinMemberIds(item: { memberIds?: string[] }) {
  return item.memberIds ?? defaultMemberIds;
}

export function getWorkspaceMembers(
  workspace: BoardItem | undefined,
  directory: readonly Member[] = demoMembers,
) {
  const memberIds = workspace ? getPinMemberIds(workspace) : [];
  return directory.filter((member) => memberIds.includes(member.id));
}

export function memberTaskDestinations(member: Member, byId: ReadonlyMap<string, BoardItem>) {
  const sections = [];
  for (const item of byId.values()) {
    const path = getPinAncestry(item, (id) => byId.get(id));
    const workspace = path[0];
    if (!workspace || !getPinMemberIds(workspace).includes(member.id)) continue;
    sections.push({ id: item.id, label: path.map((node) => node.title).join(" / "), workspace });
  }
  return sections.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}

// Store explicit assignments once. Build each parent's roster from its children,
// including assignments written by older versions of the board.
export function withInheritedMembers(items: BoardItem[]): BoardItem[] {
  const { children } = indexBoardItems(items);
  const ordered = [...(children.get(null) ?? [])];
  for (let i = 0; i < ordered.length; i++) {
    for (const child of children.get(ordered[i].id) ?? []) ordered.push(child);
  }
  const rosters = new Map<string, Set<string>>();
  for (let i = ordered.length - 1; i >= 0; i--) {
    const item = ordered[i];
    const roster = new Set(getPinMemberIds(item));
    for (const child of children.get(item.id) ?? []) {
      for (const id of rosters.get(child.id) ?? []) roster.add(id);
    }
    rosters.set(item.id, roster);
  }
  return items.map((item) => {
    const roster = rosters.get(item.id);
    return roster && roster.size > new Set(getPinMemberIds(item)).size
      ? { ...item, memberIds: [...roster] }
      : item;
  });
}

export function pinMatchesMember(item: { memberIds?: string[] }, memberId: string | null) {
  return memberId === null || getPinMemberIds(item).includes(memberId);
}

export function memberNameKey(name: string) {
  return name.trim().toLowerCase();
}

// Earlier tasks, analytics events and shared links identify members by display name.
export function indexMemberNames(directory: readonly Member[]) {
  const names = new Map<string, Member>();
  for (const member of directory) {
    for (const name of [member.name, ...(member.formerNames ?? [])]) {
      names.set(memberNameKey(name), member);
    }
  }
  return names;
}

export function findMemberTasks(tasks: Task[], memberName: string) {
  const name = memberNameKey(memberName);
  return tasks.filter((task) => memberNameKey(task.assignedTo) === name);
}
