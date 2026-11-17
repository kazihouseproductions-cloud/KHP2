import {
  type BoardItem,
  connectionDisplayItem,
  isItemVisible,
  itemRect,
  layerZIndex,
  visualRect,
} from "./board-model.ts";

export interface Point {
  x: number;
  y: number;
}
export interface View extends Point {
  zoom: number;
}
export interface Rect extends Point {
  width: number;
  height: number;
}

export function toBoardPoint(point: Point, view: View, originX = 0): Point {
  return { x: (point.x - originX - view.x) / view.zoom, y: (point.y - view.y) / view.zoom };
}

export function applyWheel(
  view: View,
  wheel: {
    deltaX: number;
    deltaY: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    x: number;
    y: number;
  },
  originX = 0,
): View {
  if (wheel.ctrlKey) {
    const zoom = Math.min(2.5, Math.max(0.25, view.zoom * Math.exp(-wheel.deltaY * 0.0015)));
    const point = toBoardPoint(wheel, view, originX);
    return { zoom, x: wheel.x - originX - point.x * zoom, y: wheel.y - point.y * zoom };
  }
  return wheel.shiftKey
    ? { ...view, x: view.x - (wheel.deltaX || wheel.deltaY) }
    : { ...view, x: view.x - wheel.deltaX, y: view.y - wheel.deltaY };
}

export function rectFromPoints(first: Point, second: Point): Rect {
  return {
    x: Math.min(first.x, second.x),
    y: Math.min(first.y, second.y),
    width: Math.abs(first.x - second.x),
    height: Math.abs(first.y - second.y),
  };
}

export function boundsOf(items: BoardItem[]): Rect | null {
  if (!items.length) return null;
  const rects = items.map(visualRect);
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x,
    height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y,
  };
}

export function rotationDelta(
  start: Point,
  current: Point,
  center: Point,
  initialAngle: number,
  snap: boolean,
): number {
  const first = Math.atan2(start.y - center.y, start.x - center.x);
  const last = Math.atan2(current.y - center.y, current.x - center.x);
  const degrees = ((last - first) * 180) / Math.PI;
  const delta = ((degrees + 540) % 360) - 180;
  return snap ? Math.round((initialAngle + delta) / 15) * 15 - initialAngle : delta;
}

export function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function containsItemPoint(item: BoardItem, point: Point): boolean {
  const rect = itemRect(item);
  const angle = ((item.kind === "collection" ? 0 : item.rotation) * Math.PI) / 180;
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return containsPoint(rect, {
    x: center.x + dx * Math.cos(angle) + dy * Math.sin(angle),
    y: center.y - dx * Math.sin(angle) + dy * Math.cos(angle),
  });
}

export function hitTestItems(
  items: BoardItem[],
  point: Point,
  _selected: string[],
  except: string[] = [],
): BoardItem | undefined {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !except.includes(item.id) && isItemVisible(item, items))
    .sort(
      (first, second) =>
        layerZIndex(second.item, items) - layerZIndex(first.item, items) ||
        second.index - first.index,
    )
    .find(({ item }) => containsItemPoint(item, point))?.item;
}

export function findConnectionTarget(
  items: BoardItem[],
  point: Point,
  fromId: string,
  zoom: number,
): BoardItem | undefined {
  const source = connectionDisplayItem(fromId, items);
  return items
    .filter((item) => item.id !== fromId && item.id !== source?.id && isItemVisible(item, items))
    .map((item) => {
      const rect = itemRect(item);
      const angle = ((item.kind === "collection" ? 0 : item.rotation) * Math.PI) / 180;
      const dx = point.x - rect.x - rect.width / 2;
      const dy = point.y - rect.y - rect.height / 2;
      const x = dx * Math.cos(angle) + dy * Math.sin(angle);
      const y = -dx * Math.sin(angle) + dy * Math.cos(angle);
      const distance = Math.hypot(
        Math.max(0, Math.abs(x) - rect.width / 2),
        Math.max(0, Math.abs(y) - rect.height / 2),
      );
      return { item, distance };
    })
    .filter((entry) => entry.distance * zoom <= 16)
    .sort(
      (first, second) =>
        Number(first.item.kind === "collection" && !first.item.collapsed) -
          Number(second.item.kind === "collection" && !second.item.collapsed) ||
        first.distance - second.distance ||
        layerZIndex(second.item, items) - layerZIndex(first.item, items),
    )[0]?.item;
}

export function rectangleSelection(items: BoardItem[], first: Point, second: Point): string[] {
  const selection = rectFromPoints(first, second);
  return items
    .filter((item) => {
      if (!isItemVisible(item, items)) return false;
      const rect = itemRect(item);
      if (item.kind === "collection" && !item.collapsed)
        return (
          selection.x <= rect.x &&
          selection.y <= rect.y &&
          selection.x + selection.width >= rect.x + rect.width &&
          selection.y + selection.height >= rect.y + rect.height
        );
      const angle = (item.rotation * Math.PI) / 180;
      const width =
        Math.abs(rect.width * Math.cos(angle)) + Math.abs(rect.height * Math.sin(angle));
      const height =
        Math.abs(rect.width * Math.sin(angle)) + Math.abs(rect.height * Math.cos(angle));
      const x = rect.x + (rect.width - width) / 2;
      const y = rect.y + (rect.height - height) / 2;
      return (
        x <= selection.x + selection.width &&
        x + width >= selection.x &&
        y <= selection.y + selection.height &&
        y + height >= selection.y
      );
    })
    .map((item) => item.id);
}

export function selectRange(
  order: string[],
  selected: string[],
  anchor: string | null,
  clicked: string,
  modifiers: { ctrl: boolean; shift: boolean },
): string[] {
  if (modifiers.shift && anchor && order.includes(anchor)) {
    const first = order.indexOf(anchor);
    const last = order.indexOf(clicked);
    const range = order.slice(Math.min(first, last), Math.max(first, last) + 1);
    return modifiers.ctrl ? [...new Set([...selected, ...range])] : range;
  }
  if (modifiers.ctrl)
    return selected.includes(clicked)
      ? selected.filter((id) => id !== clicked)
      : [...selected, clicked];
  return [clicked];
}

function boundaryPoint(item: BoardItem, target: Point): Point {
  const rect = itemRect(item);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const radians = (item.rotation * Math.PI) / 180;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const localX = dx * Math.cos(radians) + dy * Math.sin(radians);
  const localY = -dx * Math.sin(radians) + dy * Math.cos(radians);
  const ratio = Math.max(Math.abs(localX) / (rect.width / 2), Math.abs(localY) / (rect.height / 2));
  if (!ratio) return { x: cx + rect.width / 2, y: cy };
  const x = localX / ratio;
  const y = localY / ratio;
  return {
    x: cx + x * Math.cos(radians) - y * Math.sin(radians),
    y: cy + x * Math.sin(radians) + y * Math.cos(radians),
  };
}

export function connectionGeometry(from: BoardItem, to: BoardItem) {
  const first = itemRect(from);
  const last = itemRect(to);
  const start = boundaryPoint(from, { x: last.x + last.width / 2, y: last.y + last.height / 2 });
  const end = boundaryPoint(to, { x: first.x + first.width / 2, y: first.y + first.height / 2 });
  return { start, end, path: connectionPath(start, end) };
}

export function connectionPath(start: Point, end: Point): string {
  const middle = (start.x + end.x) / 2;
  return `M${start.x} ${start.y} C${middle} ${start.y}, ${middle} ${end.y}, ${end.x} ${end.y}`;
}
