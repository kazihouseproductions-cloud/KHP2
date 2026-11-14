import type { InterfaceIcon } from "@/components/ui/icon";

export const sections = [
  { id: "workspace", label: "Workspace" },
  { id: "tasks", label: "My Tasks" },
  { id: "calendar", label: "Calendar" },
  { id: "gantt", label: "Gantt Chart" },
  { id: "dashboard", label: "Dashboard" },
  { id: "analytics", label: "Analytics" },
  { id: "attendance", label: "Attendance" },
  { id: "hours", label: "Work Hours" },
  { id: "activity", label: "Activity log" },
  { id: "members", label: "Members" },
] as const satisfies ReadonlyArray<{ id: InterfaceIcon; label: string }>;

export const profileSection = { id: "profile", label: "My Profile" } as const;

export function sectionIcon(id: (typeof sections)[number]["id"]) {
  return id === "workspace" ? "board" : id;
}

export function sectionHref(id: (typeof sections)[number]["id"] | typeof profileSection.id) {
  return id === "workspace" ? "#/" : `#/tool/${id}`;
}
