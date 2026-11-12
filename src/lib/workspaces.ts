export const workspaceIcons = [
  { id: "ogopogo", label: "Ogopogo" },
  { id: "mayapur", label: "Mayapur" },
  { id: "office", label: "Office" },
  { id: "school", label: "School" },
] as const;

export const pinIcons = [...workspaceIcons, { id: "cutter", label: "Cutter" }] as const;
export type WorkspaceIconId = (typeof pinIcons)[number]["id"];

export const boardLevels = [
  { segment: "workspace", label: "Workspace" },
  { segment: "department", label: "Department" },
  { segment: "project", label: "Project" },
  { segment: "section", label: "Section" },
] as const;

export type BoardItem = {
  id: string;
  title: string;
  icon: WorkspaceIconId;
  parentId: string | null;
  createdAt: number;
  memberIds?: string[];
};

export function isBoardItem(value: unknown): value is BoardItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BoardItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    item.title.trim().length > 0 &&
    (item.parentId === null || typeof item.parentId === "string") &&
    pinIcons.some((icon) => icon.id === item.icon) &&
    typeof item.createdAt === "number" &&
    (item.memberIds === undefined ||
      (Array.isArray(item.memberIds) && item.memberIds.every((id) => typeof id === "string")))
  );
}

export function collectPinIds(items: BoardItem[], rootId: string) {
  const ids = new Set([rootId]);
  const children = new Map<string, string[]>();
  for (const item of items) {
    if (item.parentId !== null) {
      const siblings = children.get(item.parentId) ?? [];
      siblings.push(item.id);
      children.set(item.parentId, siblings);
    }
  }
  const queue = [rootId];
  for (let index = 0; index < queue.length; index++) {
    for (const child of children.get(queue[index]) ?? []) {
      if (!ids.has(child)) {
        ids.add(child);
        queue.push(child);
      }
    }
  }
  return ids;
}

export function childHref(parentHref: string, depth: number, id: string) {
  return `${parentHref.replace(/\/$/, "")}/${boardLevels[depth].segment}/${encodeURIComponent(id)}`;
}

export type BoardStep = { item: BoardItem; href: string; parentHref: string; parentTitle: string };

export function resolveBoardPath(ids: string[], items: BoardItem[]) {
  const path: BoardStep[] = [];
  for (const id of ids) {
    const parent = path.at(-1);
    const item = items.find(
      (entry) => entry.id === id && entry.parentId === (parent?.item.id ?? null),
    );
    if (!item) break;
    const parentHref = parent?.href ?? "#/";
    path.push({
      item,
      parentHref,
      parentTitle: parent?.item.title ?? "Workspace",
      href: childHref(parentHref, path.length, id),
    });
  }
  return path;
}

export function boardItemHref(items: BoardItem[], id: string): string | null {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ids: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current) {
    if (seen.has(current.id) || ids.length >= boardLevels.length) return null;
    seen.add(current.id);
    ids.unshift(current.id);
    if (current.parentId === null) return resolveBoardPath(ids, items).at(-1)?.href ?? null;
    current = byId.get(current.parentId);
  }
  return null;
}
