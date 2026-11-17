export type ItemKind =
  | "sticky"
  | "text"
  | "image"
  | "link"
  | "todo"
  | "calendar"
  | "table"
  | "collection"
  | "comment";
export type Tool = "select" | "grab" | "connect" | "comment" | "rotate";

export interface ThreadMessage {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

export interface TodoEntry {
  id: string;
  text: string;
  done: boolean;
}
export interface BoardImage {
  src: string;
  name: string;
  width: number;
  height: number;
}

export interface BoardItem {
  id: string;
  kind: ItemKind;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  url: string;
  color: string;
  hidden: boolean;
  locked: boolean;
  rotation: number;
  checked: boolean;
  date: string;
  parentId: string | null;
  collapsed: boolean;
  messages: ThreadMessage[];
  todos: TodoEntry[];
  image?: BoardImage;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
}
export interface BoardSnapshot {
  items: BoardItem[];
  connections: Connection[];
}
export interface BoardHistory {
  past: BoardSnapshot[];
  present: BoardSnapshot;
  future: BoardSnapshot[];
}

export type BoardAction =
  | { type: "add"; item: BoardItem }
  | { type: "update"; id: string; changes: Partial<BoardItem> }
  | { type: "remove"; id: string }
  | { type: "connect"; from: string; to: string }
  | { type: "reconnect"; id: string; endpoint: "from" | "to"; itemId: string }
  | { type: "delete-selection"; itemIds: string[]; connectionIds: string[] }
  | { type: "move"; ids: string[]; dx: number; dy: number; dropInto?: string | null }
  | { type: "group"; collectionId: string; ids: string[] }
  | { type: "unwrap"; id: string }
  | { type: "duplicate"; ids: string[]; idMap: Record<string, string> }
  | { type: "rotate"; ids: string[]; center: { x: number; y: number }; delta: number }
  | { type: "reply"; id: string; message: ThreadMessage }
  | { type: "todo-add"; id: string; todoId: string }
  | {
      type: "todo-update";
      id: string;
      todoId: string;
      changes: Partial<Pick<TodoEntry, "text" | "done">>;
    }
  | { type: "reorder"; ids: string[]; targetId: string; position: "above" | "below" }
  | { type: "undo" }
  | { type: "redo" };

export const itemLabels: Record<ItemKind, string> = {
  sticky: "Sticky Note",
  text: "Text",
  image: "Image",
  link: "Link",
  todo: "To-Do",
  calendar: "Calendar",
  table: "Table",
  collection: "Collection",
  comment: "Comment",
};

export const noteColors = ["#fff5a1", "#fbd8e5", "#dcebcf", "#dce8fa", "#e8ddf7"];

export function createItem(kind: ItemKind, id: string, x: number, y: number): BoardItem {
  const dimensions: Record<ItemKind, [number, number]> = {
    sticky: [238, 194],
    text: [260, 120],
    image: [360, 240],
    link: [214, 72],
    todo: [260, 180],
    calendar: [278, 276],
    table: [330, 190],
    collection: [520, 360],
    comment: [310, 360],
  };
  const [width, height] = dimensions[kind];
  return {
    id,
    kind,
    title: itemLabels[kind],
    x,
    y,
    width,
    height,
    text: kind === "sticky" ? "Write Something..." : "",
    url: "https://www.link.com",
    color: noteColors[0],
    hidden: false,
    locked: false,
    rotation: 0,
    checked: false,
    date: "2026-11-17",
    parentId: null,
    collapsed: kind === "collection",
    messages: [],
    todos: kind === "todo" ? [{ id: `${id}:todo-1`, text: "", done: false }] : [],
  };
}

export function createImageItem(
  id: string,
  image: BoardImage,
  point: { x: number; y: number },
): BoardItem | null {
  if (
    !image.src ||
    !Number.isFinite(image.width) ||
    !Number.isFinite(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  )
    return null;
  const scale = Math.min(1, 360 / image.width, 300 / image.height);
  return {
    ...createItem("image", id, point.x, point.y),
    title: image.name || "Image",
    image,
    width: image.width * scale,
    height: image.height * scale,
  };
}

export function todoEntries(item: BoardItem): TodoEntry[] {
  return item.todos?.length
    ? item.todos
    : [{ id: `${item.id}:todo-1`, text: item.text, done: item.checked }];
}

export function layerRows(items: BoardItem[]): { item: BoardItem; depth: number }[] {
  const result: { item: BoardItem; depth: number }[] = [];
  const seen = new Set<string>();
  function append(parentId: string | null, depth: number) {
    for (const item of [...items].reverse().filter((entry) => entry.parentId === parentId)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push({ item, depth });
      if (item.kind === "collection") append(item.id, depth + 1);
    }
  }
  append(null, 0);
  return result;
}

export function layerZIndex(item: BoardItem, items: BoardItem[]): number {
  if (item.kind === "collection" && !item.collapsed) return 1;
  const rows = layerRows(items);
  return 10 + rows.length - 1 - rows.findIndex((row) => row.item.id === item.id);
}

export function connectionDisplayItem(id: string, items: BoardItem[]): BoardItem | undefined {
  let item = items.find((entry) => entry.id === id);
  const seen = new Set<string>();
  if (!item || item.hidden) return undefined;
  while (item && !isItemVisible(item, items) && !seen.has(item.id)) {
    seen.add(item.id);
    item = items.find((entry) => entry.id === item?.parentId);
    if (item?.hidden) return undefined;
  }
  return item;
}

export function createHistory(): BoardHistory {
  return {
    past: [],
    future: [],
    present: {
      items: [createItem("sticky", "sticky-1", 336, 142), createItem("link", "link-1", 666, 264)],
      connections: [],
    },
  };
}

export function placeItem(
  kind: ItemKind,
  id: string,
  viewport: { width: number; height: number },
  pan: { x: number; y: number },
  stagger = 0,
  zoom = 1,
): BoardItem {
  const item = createItem(kind, id, 0, 0);
  const mobile = viewport.width <= 700;
  const left = mobile ? 80 : 260;
  const right = viewport.width - (viewport.width > 1100 ? 260 : 30);
  item.width = Math.min(item.width, Math.max(180, (right - left) / zoom));
  const rect = itemRect(item);
  const screenX = Math.min(
    Math.max(left, (left + right - rect.width * zoom) / 2 + stagger),
    Math.max(left, right - rect.width * zoom),
  );
  const screenY = Math.min(
    Math.max(40, (viewport.height - rect.height * zoom) / 2 + stagger),
    Math.max(40, viewport.height - 100 - rect.height * zoom),
  );
  item.x = (screenX - pan.x + (mobile ? 248 : 0)) / zoom;
  item.y = (screenY - pan.y) / zoom;
  return item;
}

export const allowNestedCollections = false;

export function itemRect(item: BoardItem) {
  return {
    x: item.x,
    y: item.y,
    width: item.kind === "collection" && item.collapsed ? Math.min(310, item.width) : item.width,
    height: item.kind === "collection" && item.collapsed ? 230 : item.height,
  };
}

export function visualRect(item: BoardItem) {
  const rect = itemRect(item);
  const angle = ((item.kind === "collection" ? 0 : item.rotation) * Math.PI) / 180;
  const width = Math.abs(rect.width * Math.cos(angle)) + Math.abs(rect.height * Math.sin(angle));
  const height = Math.abs(rect.width * Math.sin(angle)) + Math.abs(rect.height * Math.cos(angle));
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

export function rotateItems(
  items: BoardItem[],
  ids: string[],
  center: { x: number; y: number },
  delta: number,
): BoardItem[] {
  const angle = (delta * Math.PI) / 180;
  return items.map((item) => {
    if (!ids.includes(item.id) || item.kind === "collection" || isItemLocked(item, items))
      return item;
    const x = item.x + item.width / 2 - center.x;
    const y = item.y + item.height / 2 - center.y;
    return {
      ...item,
      x: center.x + x * Math.cos(angle) - y * Math.sin(angle) - item.width / 2,
      y: center.y + x * Math.sin(angle) + y * Math.cos(angle) - item.height / 2,
      rotation: (((item.rotation + delta) % 360) + 360) % 360,
    };
  });
}

export function descendants(items: BoardItem[], ids: string[]): string[] {
  const result = new Set(ids);
  let size = -1;
  while (size !== result.size) {
    size = result.size;
    for (const item of items) if (item.parentId && result.has(item.parentId)) result.add(item.id);
  }
  return [...result];
}

export function isItemVisible(item: BoardItem, items: BoardItem[]): boolean {
  const seen = new Set<string>();
  let current: BoardItem | undefined = item;
  while (current) {
    if (current.hidden || seen.has(current.id)) return false;
    seen.add(current.id);
    const parent = items.find((entry) => entry.id === current?.parentId);
    if (parent?.collapsed) return false;
    current = parent;
  }
  return true;
}

export function isItemLocked(item: BoardItem, items: BoardItem[]): boolean {
  const seen = new Set<string>();
  let current: BoardItem | undefined = item;
  while (current && !seen.has(current.id)) {
    if (current.locked) return true;
    seen.add(current.id);
    current = items.find((entry) => entry.id === current?.parentId);
  }
  return false;
}

export function selectionRoots(items: BoardItem[], ids: string[]): string[] {
  const selected = new Set(ids);
  return ids.filter((id) => {
    let current = items.find((item) => item.id === id);
    const seen = new Set<string>();
    while (current?.parentId && !seen.has(current.parentId)) {
      if (selected.has(current.parentId)) return false;
      seen.add(current.parentId);
      current = items.find((item) => item.id === current?.parentId);
    }
    return true;
  });
}

function fitCollection(items: BoardItem[], id: string, preservePositions = false): BoardItem[] {
  const group = items.find((item) => item.id === id && item.kind === "collection");
  if (!group) return items;
  const children = items.filter((item) => item.parentId === id);
  if (!children.length) return items;
  const childBounds = children.map(visualRect);
  const minX = Math.min(...childBounds.map((rect) => rect.x));
  const minY = Math.min(...childBounds.map((rect) => rect.y));
  if (preservePositions) {
    const x = Math.min(group.x, minX - 24);
    const y = Math.min(group.y, minY - 66);
    const right = Math.max(
      group.x + group.width,
      ...childBounds.map((rect) => rect.x + rect.width + 24),
    );
    const bottom = Math.max(
      group.y + group.height,
      ...childBounds.map((rect) => rect.y + rect.height + 24),
    );
    return items.map((item) =>
      item.id === id
        ? { ...item, x, y, width: Math.max(520, right - x), height: Math.max(360, bottom - y) }
        : item,
    );
  }
  const dx = Math.max(0, group.x + 24 - minX);
  const dy = Math.max(0, group.y + 66 - minY);
  const allChildren = new Set(
    descendants(
      items,
      children.map((item) => item.id),
    ),
  );
  const moved = items.map((item) =>
    allChildren.has(item.id) ? { ...item, x: item.x + dx, y: item.y + dy } : item,
  );
  const bounds = moved.filter((item) => allChildren.has(item.id)).map(visualRect);
  return moved.map((item) =>
    item.id === id
      ? {
          ...item,
          width: Math.max(520, ...bounds.map((rect) => rect.x + rect.width - group.x + 24)),
          height: Math.max(360, ...bounds.map((rect) => rect.y + rect.height - group.y + 24)),
        }
      : item,
  );
}

function groupItems(items: BoardItem[], collectionId: string, ids: string[]): BoardItem[] {
  const group = items.find((item) => item.id === collectionId && item.kind === "collection");
  if (!group || isItemLocked(group, items)) return items;
  const eligible = new Set(
    selectionRoots(items, ids).filter((id) => {
      const item = items.find((entry) => entry.id === id);
      return (
        item &&
        id !== collectionId &&
        !isItemLocked(item, items) &&
        (allowNestedCollections || item.kind !== "collection") &&
        !descendants(items, [id]).includes(collectionId)
      );
    }),
  );
  if (!eligible.size) return items;
  return fitCollection(
    items.map((item) => (eligible.has(item.id) ? { ...item, parentId: collectionId } : item)),
    collectionId,
  );
}

function validConnection(board: BoardSnapshot, from: string, to: string, except?: string): boolean {
  return (
    from !== to &&
    board.items.some((item) => item.id === from) &&
    board.items.some((item) => item.id === to) &&
    !board.connections.some(
      (edge) =>
        edge.id !== except &&
        ((edge.from === from && edge.to === to) || (edge.from === to && edge.to === from)),
    )
  );
}

function record(history: BoardHistory, present: BoardSnapshot): BoardHistory {
  return { past: [...history.past.slice(-59), history.present], present, future: [] };
}

export function historyReducer(history: BoardHistory, action: BoardAction): BoardHistory {
  const board = history.present;
  switch (action.type) {
    case "undo": {
      const previous = history.past.at(-1);
      return previous
        ? { past: history.past.slice(0, -1), present: previous, future: [board, ...history.future] }
        : history;
    }
    case "redo": {
      const next = history.future[0];
      return next
        ? { past: [...history.past, board], present: next, future: history.future.slice(1) }
        : history;
    }
    case "add":
      return record(history, { ...board, items: [...board.items, action.item] });
    case "update": {
      const item = board.items.find((entry) => entry.id === action.id);
      if (
        !item ||
        (isItemLocked(item, board.items) &&
          Object.keys(action.changes).some((key) => key !== "locked" && key !== "hidden"))
      )
        return history;
      if (
        Object.entries(action.changes).every(
          ([key, value]) => item[key as keyof BoardItem] === value,
        )
      )
        return history;
      const items = board.items.map((entry) =>
        entry.id === action.id ? { ...entry, ...action.changes, id: entry.id } : entry,
      );
      return record(history, {
        ...board,
        items:
          item.kind === "collection" && action.changes.collapsed === false
            ? fitCollection(items, item.id)
            : items,
      });
    }
    case "remove": {
      return historyReducer(history, {
        type: "delete-selection",
        itemIds: [action.id],
        connectionIds: [],
      });
    }
    case "connect": {
      if (!validConnection(board, action.from, action.to)) return history;
      const baseId = `${action.from}-${action.to}`;
      let id = baseId;
      let suffix = 1;
      while (board.connections.some((edge) => edge.id === id)) id = `${baseId}:${suffix++}`;
      return record(history, {
        ...board,
        connections: [...board.connections, { id, from: action.from, to: action.to }],
      });
    }
    case "reconnect": {
      const edge = board.connections.find((entry) => entry.id === action.id);
      if (!edge || edge[action.endpoint] === action.itemId) return history;
      const next = { ...edge, [action.endpoint]: action.itemId };
      if (!validConnection(board, next.from, next.to, edge.id)) return history;
      return record(history, {
        ...board,
        connections: board.connections.map((entry) => (entry.id === edge.id ? next : entry)),
      });
    }
    case "delete-selection": {
      const roots = action.itemIds.filter((id) => {
        const item = board.items.find((entry) => entry.id === id);
        return item && !isItemLocked(item, board.items);
      });
      const removed = new Set(descendants(board.items, roots));
      const edges = new Set(action.connectionIds);
      const items = board.items.filter((item) => !removed.has(item.id));
      const connections = board.connections.filter(
        (edge) => !edges.has(edge.id) && !removed.has(edge.from) && !removed.has(edge.to),
      );
      return items.length === board.items.length && connections.length === board.connections.length
        ? history
        : record(history, { items, connections });
    }
    case "move": {
      if (!action.dx && !action.dy && action.dropInto === undefined) return history;
      const roots = selectionRoots(board.items, action.ids).filter((id) => {
        const item = board.items.find((entry) => entry.id === id);
        return item && !isItemLocked(item, board.items);
      });
      if (!roots.length) return history;
      const moving = new Set(descendants(board.items, roots));
      let items = board.items.map((item) =>
        moving.has(item.id) ? { ...item, x: item.x + action.dx, y: item.y + action.dy } : item,
      );
      if (action.dropInto) items = groupItems(items, action.dropInto, roots);
      else if (action.dropInto === null)
        items = items.map((item) => (roots.includes(item.id) ? { ...item, parentId: null } : item));
      for (const parentId of new Set(
        items.filter((item) => roots.includes(item.id)).map((item) => item.parentId),
      ))
        if (parentId) items = fitCollection(items, parentId);
      return record(history, { ...board, items });
    }
    case "group": {
      const items = groupItems(board.items, action.collectionId, action.ids);
      return items === board.items ? history : record(history, { ...board, items });
    }
    case "unwrap": {
      const group = board.items.find((item) => item.id === action.id && item.kind === "collection");
      if (!group || isItemLocked(group, board.items)) return history;
      return record(history, {
        items: board.items
          .filter((item) => item.id !== group.id)
          .map((item) =>
            item.parentId === group.id ? { ...item, parentId: group.parentId } : item,
          ),
        connections: board.connections.filter(
          (edge) => edge.from !== group.id && edge.to !== group.id,
        ),
      });
    }
    case "duplicate": {
      const ids = new Set(descendants(board.items, selectionRoots(board.items, action.ids)));
      const copies = board.items
        .filter((item) => ids.has(item.id) && action.idMap[item.id])
        .map((item) => ({
          ...item,
          id: action.idMap[item.id],
          parentId: item.parentId ? action.idMap[item.parentId] || item.parentId : null,
          x: item.x + 32,
          y: item.y + 32,
        }));
      if (!copies.length) return history;
      const connections = board.connections
        .filter((edge) => action.idMap[edge.from] && action.idMap[edge.to])
        .map((edge) => ({
          id: `${action.idMap[edge.from]}-${action.idMap[edge.to]}`,
          from: action.idMap[edge.from],
          to: action.idMap[edge.to],
        }));
      let items = [...board.items, ...copies];
      for (const parentId of new Set(copies.map((item) => item.parentId)))
        if (parentId) items = fitCollection(items, parentId);
      return record(history, {
        items,
        connections: [...board.connections, ...connections],
      });
    }
    case "rotate": {
      if (
        !Number.isFinite(action.delta) ||
        !Number.isFinite(action.center.x) ||
        !Number.isFinite(action.center.y) ||
        Math.abs(action.delta) < 0.000001
      )
        return history;
      let items = rotateItems(board.items, action.ids, action.center, action.delta);
      if (items.every((item, index) => item === board.items[index])) return history;
      for (const parentId of new Set(
        items.filter((item) => action.ids.includes(item.id)).map((item) => item.parentId),
      ))
        if (parentId) items = fitCollection(items, parentId, true);
      return record(history, { ...board, items });
    }
    case "todo-add":
    case "todo-update": {
      const item = board.items.find((entry) => entry.id === action.id);
      if (item?.kind !== "todo" || isItemLocked(item, board.items)) return history;
      const rows = todoEntries(item);
      if (
        action.type === "todo-add" &&
        (!action.todoId || rows.some((row) => row.id === action.todoId))
      )
        return history;
      if (action.type === "todo-update" && !rows.some((row) => row.id === action.todoId))
        return history;
      const todos =
        action.type === "todo-add"
          ? [...rows, { id: action.todoId, text: "", done: false }]
          : rows.map((row) =>
              row.id === action.todoId ? { ...row, ...action.changes, id: row.id } : row,
            );
      let items = board.items.map((entry) =>
        entry.id === item.id
          ? { ...entry, todos, height: Math.min(360, Math.max(180, 80 + todos.length * 36)) }
          : entry,
      );
      if (item.parentId) items = fitCollection(items, item.parentId, true);
      return record(history, { ...board, items });
    }
    case "reorder": {
      const target = board.items.find((item) => item.id === action.targetId);
      if (!target) return history;
      const movingIds = new Set(
        selectionRoots(board.items, action.ids).filter((id) => {
          const item = board.items.find((entry) => entry.id === id);
          return item && item.parentId === target.parentId && !isItemLocked(item, board.items);
        }),
      );
      if (!movingIds.size || descendants(board.items, [...movingIds]).includes(target.id))
        return history;
      const siblings = board.items.filter((item) => item.parentId === target.parentId);
      const moving = siblings.filter((item) => movingIds.has(item.id));
      const ordered = siblings.filter((item) => !movingIds.has(item.id));
      const index = ordered.findIndex((item) => item.id === target.id);
      ordered.splice(index + (action.position === "above" ? 1 : 0), 0, ...moving);
      const scopedIds = new Set(
        descendants(
          board.items,
          siblings.map((item) => item.id),
        ),
      );
      const reordered = ordered.flatMap((item) =>
        descendants(board.items, [item.id])
          .map((id) => board.items.find((entry) => entry.id === id))
          .filter((entry): entry is BoardItem => Boolean(entry)),
      );
      let cursor = 0;
      const items = board.items.map((item) =>
        scopedIds.has(item.id) ? reordered[cursor++] : item,
      );
      return items.every((item, itemIndex) => item.id === board.items[itemIndex].id)
        ? history
        : record(history, { ...board, items });
    }
    case "reply": {
      const item = board.items.find((entry) => entry.id === action.id);
      const author = action.message.author.trim();
      const text = action.message.text.trim();
      if (
        item?.kind !== "comment" ||
        isItemLocked(item, board.items) ||
        !author ||
        !text ||
        !Number.isFinite(action.message.createdAt) ||
        item.messages.some((message) => message.id === action.message.id)
      )
        return history;
      return record(history, {
        ...board,
        items: board.items.map((entry) =>
          entry.id === item.id
            ? { ...entry, messages: [...entry.messages, { ...action.message, author, text }] }
            : entry,
        ),
      });
    }
  }
}

export function safeLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[\w+.-]+:/.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
