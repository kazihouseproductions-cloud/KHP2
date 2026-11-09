import type { InterfaceIcon } from "@/components/ui/icon";

export const sections = [
  { id: "workspace", label: "Workspace" },
  { id: "tasks", label: "My Tasks" },
  { id: "calendar", label: "Calendar" },
  { id: "gantt", label: "Gantt Chart" },
  { id: "dashboard", label: "Dashboard" },
  { id: "analytics", label: "Analytics" },
  { id: "assistant", label: "Assistant" },
  { id: "attendance", label: "Attendance" },
  { id: "hours", label: "Work Hours" },
  { id: "activity", label: "Activity log" },
  { id: "members", label: "Members" },
] as const satisfies ReadonlyArray<{ id: InterfaceIcon; label: string }>;
