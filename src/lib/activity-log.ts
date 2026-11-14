import { readBoardItems } from "./board-records";
import { readRecords, watchRecords } from "./local-records";
import { readMemberDirectory } from "./member-records";
import { getPinMemberIds, previewMember } from "./members";
import type { BoardItem } from "./workspaces";

const prefix = "khp.activity.v1.";
const changedEvent = "khp:activity-saved";
const areas = ["Board", "Tasks", "Attendance", "Work Hours", "Members"] as const;
type WorkspaceRef = Pick<BoardItem, "id" | "title">;
type Activity = {
  area: (typeof areas)[number];
  description: string;
  workspaces: WorkspaceRef[];
  detail?: string;
};
export type ActivityEntry = Activity & {
  id: string;
  createdAt: number;
  actorId: string;
  actorName: string;
};

// Snapshot names and memberships so renaming or deleting a board preserves its history.
export function workspaceRefs(items: readonly BoardItem[]): WorkspaceRef[] {
  return items.map(({ id, title }) => ({ id, title }));
}

export function memberWorkspaceRefs(memberId: string) {
  return workspaceRefs(
    readBoardItems().filter(
      (item) => item.parentId === null && getPinMemberIds(item).includes(memberId),
    ),
  );
}

let sequence = 0;
export function withActivity(activity: Activity, write: () => void) {
  // The sequence keeps actions from this tab ordered even within one millisecond.
  const id = `${(sequence++).toString(36).padStart(8, "0")}-${crypto.randomUUID()}`;
  const entry: ActivityEntry = {
    ...activity,
    id,
    createdAt: Date.now(),
    actorId: previewMember.id,
    actorName:
      readMemberDirectory().find((member) => member.id === previewMember.id)?.name ??
      previewMember.name,
  };
  const key = prefix + id;
  localStorage.setItem(key, JSON.stringify(entry));
  try {
    write();
  } catch (error) {
    localStorage.removeItem(key);
    throw error;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(changedEvent));
}

function isEntry(value: unknown): value is ActivityEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<ActivityEntry>;
  return (
    typeof e.id === "string" &&
    typeof e.createdAt === "number" &&
    Number.isFinite(new Date(e.createdAt).getTime()) &&
    typeof e.actorId === "string" &&
    typeof e.actorName === "string" &&
    typeof e.description === "string" &&
    areas.some((area) => area === e.area) &&
    (e.detail === undefined || typeof e.detail === "string") &&
    Array.isArray(e.workspaces) &&
    e.workspaces.every((w) => w && typeof w.id === "string" && typeof w.title === "string")
  );
}

export function readActivity() {
  return readRecords(prefix, isEntry).reverse();
}

export function listenToActivity(receive: (entries: ActivityEntry[] | null) => void) {
  function reload() {
    try {
      receive(readActivity());
    } catch {
      receive(null);
    }
  }
  window.addEventListener(changedEvent, reload);
  const stop = watchRecords(prefix, reload);
  return () => {
    stop();
    window.removeEventListener(changedEvent, reload);
  };
}

export function filterActivity(entries: ActivityEntry[], workspaceId?: string, actorId?: string) {
  return entries.filter(
    (entry) =>
      (!actorId || entry.actorId === actorId) &&
      (!workspaceId || entry.workspaces.some((workspace) => workspace.id === workspaceId)),
  );
}
