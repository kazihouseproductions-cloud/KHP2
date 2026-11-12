import { type BoardItem, resolveBoardPath } from "./workspaces";

export type BoardRoute =
  | { kind: "home"; tasksFor?: string }
  | { kind: "invalid" }
  | { kind: "tool"; name: string }
  | { kind: "node"; id: string; workspace: boolean; legacyIds?: string[]; tasksFor?: string };

export function memberTasksHref(boardHref: string, memberId: string) {
  return `${boardHref}?tasksFor=${encodeURIComponent(memberId)}`;
}

export function parseBoardRoute(hash: string): BoardRoute {
  const [path, query] = hash.slice(1).split("?");
  const route = parsePath(path);
  const memberId = new URLSearchParams(query).get("tasksFor");
  if (memberId === null) return route;
  return memberId && (route.kind === "node" || route.kind === "home")
    ? { ...route, tasksFor: memberId }
    : { kind: "invalid" };
}

function parsePath(path: string): BoardRoute {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return { kind: "home" };
  if (parts[0] === "tool" && parts.length === 2) return { kind: "tool", name: parts[1] };
  try {
    if (parts.length === 2 && (parts[0] === "workspace" || parts[0] === "section")) {
      return {
        kind: "node",
        id: decodeURIComponent(parts[1]),
        workspace: parts[0] === "workspace",
      };
    }
    // Bookmarks from the original hierarchy still identify the same nodes.
    const legacySegments = ["workspace", "department", "project", "section"];
    const legacyIds: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i] !== legacySegments[i / 2] || !parts[i + 1]) return { kind: "invalid" };
      legacyIds.push(decodeURIComponent(parts[i + 1]));
    }
    return { kind: "node", id: legacyIds[legacyIds.length - 1], workspace: false, legacyIds };
  } catch {
    return { kind: "invalid" };
  }
}

export function resolveNodeRoute(route: BoardRoute, byId: ReadonlyMap<string, BoardItem>) {
  if (route.kind !== "node") return [];
  const node = byId.get(route.id);
  if (!node || route.workspace !== (node.parentId === null)) return [];
  const path = resolveBoardPath(route.id, byId);
  const expected = route.legacyIds;
  if (
    expected &&
    (expected.length !== path.length || expected.some((id, i) => id !== path[i].item.id))
  )
    return [];
  return path;
}
