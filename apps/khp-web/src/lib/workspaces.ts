import { type CatalogIconId, getCatalogIcon } from "./catalog-icons";

export const workspaceIcons = [
  { id: "ogopogo", label: "Ogopogo" },
  { id: "mayapur", label: "Mayapur" },
  { id: "office", label: "Office" },
  { id: "school", label: "School" },
] as const;

export const pinIcons = [...workspaceIcons, { id: "cutter", label: "Cutter" }] as const;
export type WorkspaceIconId = (typeof pinIcons)[number]["id"] | CatalogIconId;

export const defaultPinColor = "#262626";

export function isPinColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function isWorkspaceIconId(value: unknown): value is WorkspaceIconId {
  return (
    typeof value === "string" &&
    (pinIcons.some((icon) => icon.id === value) || !!getCatalogIcon(value))
  );
}

export type BoardItem = {
  id: string;
  title: string;
  icon: WorkspaceIconId;
  color?: string;
  parentId: string | null;
  createdAt: number;
  memberIds?: string[];
  boardType?: "sections" | "tasks";
};

export function isBoardItem(value: unknown): value is BoardItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BoardItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    item.title.trim().length > 0 &&
    (item.parentId === null || typeof item.parentId === "string") &&
    isWorkspaceIconId(item.icon) &&
    (item.boardType === undefined || item.boardType === "sections" || item.boardType === "tasks") &&
    (item.color === undefined || isPinColor(item.color)) &&
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

export function nodeHref(item: BoardItem) {
  return `#/${item.parentId === null ? "workspace" : "section"}/${encodeURIComponent(item.id)}`;
}

export type BoardStep = { item: BoardItem; href: string; parentHref: string; parentTitle: string };

export function indexBoardItems(items: BoardItem[]) {
  const byId = new Map<string, BoardItem>();
  const children = new Map<string | null, BoardItem[]>();
  for (const item of items) {
    byId.set(item.id, item);
    const siblings = children.get(item.parentId);
    if (siblings) siblings.push(item);
    else children.set(item.parentId, [item]);
  }
  return { byId, children };
}

export function resolveBoardPath(id: string, byId: ReadonlyMap<string, BoardItem>): BoardStep[] {
  const nodes = getPinAncestry(byId.get(id), (key) => byId.get(key));
  return nodes.map((item, index) => ({
    item,
    href: nodeHref(item),
    parentHref: index ? nodeHref(nodes[index - 1]) : "#/",
    parentTitle: index ? nodes[index - 1].title : "Workspace",
  }));
}

export function isTaskBoard(item: BoardItem, depth: number) {
  // Before boardType was stored, fourth-level sections were always task boards.
  return item.boardType === undefined ? depth === 4 : item.boardType === "tasks";
}

export function getPinAncestry(
  item: BoardItem | undefined,
  findItem: (id: string) => BoardItem | undefined,
) {
  const path: BoardItem[] = [];
  const visited = new Set<string>();
  let current = item;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.push(current);
    if (current.parentId === null) return path.reverse();
    current = findItem(current.parentId);
  }
  return [];
}
