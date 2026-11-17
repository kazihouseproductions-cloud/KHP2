import { Eye, EyeOff, GripVertical, LockKeyhole, LockKeyholeOpen, X } from "lucide-react";
import { type PointerEvent, useRef, useState } from "react";
import { type BoardItem, descendants, layerRows } from "@/lib/board-model";
import { itemIcons } from "./board-controls";
import { BoardPresence } from "./board-presence";

interface LayerDrag {
  ids: string[];
  parentId: string | null;
  startY: number;
  active: boolean;
}
interface LayerDrop {
  id: string;
  position: "above" | "below";
}

export function LayersPanel({
  items,
  selectedIds,
  onSelect,
  onUpdate,
  onReorder,
  onShare,
  open,
  onClose,
}: {
  items: BoardItem[];
  selectedIds: string[];
  onSelect: (id: string, modifiers: { ctrl: boolean; shift: boolean }, order: string[]) => void;
  onUpdate: (id: string, changes: Partial<BoardItem>) => void;
  onReorder: (ids: string[], targetId: string, position: "above" | "below") => void;
  onShare: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const rows = layerRows(items);
  const order = rows.map((row) => row.item.id);
  const drag = useRef<LayerDrag | null>(null);
  const dropRef = useRef<LayerDrop | null>(null);
  const [drop, setDrop] = useState<LayerDrop | null>(null);
  const [dragging, setDragging] = useState<string[]>([]);
  function clear() {
    drag.current = null;
    dropRef.current = null;
    setDrop(null);
    setDragging([]);
  }
  function start(event: PointerEvent<HTMLButtonElement>, item: BoardItem) {
    if (event.button !== 0 || item.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const ids = selectedIds.includes(item.id)
      ? selectedIds.filter(
          (id) => items.find((entry) => entry.id === id)?.parentId === item.parentId,
        )
      : [item.id];
    if (!selectedIds.includes(item.id)) onSelect(item.id, { ctrl: false, shift: false }, order);
    drag.current = { ids, parentId: item.parentId, startY: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current) return;
    if (Math.abs(event.clientY - current.startY) < 4 && !current.active) return;
    current.active = true;
    setDragging(current.ids);
    const panel = event.currentTarget.getBoundingClientRect();
    if (event.clientY < panel.top + 40) event.currentTarget.scrollTop -= 12;
    if (event.clientY > panel.bottom - 40) event.currentTarget.scrollTop += 12;
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-element-id]");
    const target = items.find((item) => item.id === row?.dataset.elementId);
    if (
      !row ||
      !target ||
      !event.currentTarget.contains(row) ||
      target.parentId !== current.parentId ||
      descendants(items, current.ids).includes(target.id)
    ) {
      dropRef.current = null;
      setDrop(null);
      return;
    }
    const rect = row.getBoundingClientRect();
    const next: LayerDrop = {
      id: target.id,
      position: event.clientY < rect.top + rect.height / 2 ? "above" : "below",
    };
    dropRef.current = next;
    setDrop(next);
  }
  function finish() {
    if (drag.current?.active && dropRef.current)
      onReorder(drag.current.ids, dropRef.current.id, dropRef.current.position);
    clear();
  }
  return (
    <aside
      className={`elements-panel ${open ? "is-open" : ""}`}
      aria-label="Layers"
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={clear}
    >
      <BoardPresence onShare={onShare} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-normal">Layers</h2>
        {selectedIds.length > 1 && (
          <span className="selection-count">{selectedIds.length} selected</span>
        )}
        <button
          className="icon-button panel-close"
          type="button"
          aria-label="Close layers"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <ul className="element-list" aria-label="Layers list">
        {rows.map(({ item, depth }) => {
          const Icon = itemIcons[item.kind];
          return (
            <li
              key={item.id}
              data-element-id={item.id}
              className={`element-row ${selectedIds.includes(item.id) ? "is-selected" : ""} ${dragging.includes(item.id) ? "is-layer-dragging" : ""} ${drop?.id === item.id ? `drop-${drop.position}` : ""}`}
              style={{ paddingLeft: depth * 12 + 3 }}
            >
              <button
                type="button"
                className="layer-grab"
                aria-label={`Reorder ${item.title}`}
                title="Drag to reorder · Alt+Up/Down"
                disabled={item.locked}
                onPointerDown={(event) => start(event, item)}
                onKeyDown={(event) => {
                  if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
                  event.preventDefault();
                  const siblings = rows.filter((row) => row.item.parentId === item.parentId);
                  const index = siblings.findIndex((row) => row.item.id === item.id);
                  const direction = event.key === "ArrowUp" ? -1 : 1;
                  const target = siblings[index + direction];
                  if (target)
                    onReorder([item.id], target.item.id, direction < 0 ? "above" : "below");
                }}
              >
                <GripVertical size={11} />
              </button>
              <button
                className="element-name"
                type="button"
                title={item.title}
                aria-pressed={selectedIds.includes(item.id)}
                onClick={(event) =>
                  onSelect(
                    item.id,
                    { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey },
                    order,
                  )
                }
              >
                <Icon size={13} />
                <span>{item.title}</span>
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label={`${item.hidden ? "Show" : "Hide"} ${item.title}`}
                aria-pressed={item.hidden}
                onClick={() => onUpdate(item.id, { hidden: !item.hidden })}
              >
                {item.hidden ? <EyeOff /> : <Eye />}
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label={`${item.locked ? "Unlock" : "Lock"} ${item.title}`}
                aria-pressed={item.locked}
                onClick={() => onUpdate(item.id, { locked: !item.locked })}
              >
                {item.locked ? <LockKeyhole /> : <LockKeyholeOpen />}
              </button>
            </li>
          );
        })}
      </ul>
      {!items.length && (
        <p className="mt-5 text-xs leading-5 text-neutral-400">
          Add something to your board to see its layer here.
        </p>
      )}
    </aside>
  );
}
