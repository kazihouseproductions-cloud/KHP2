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
    typeof item.createdAt === "number"
  );
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
