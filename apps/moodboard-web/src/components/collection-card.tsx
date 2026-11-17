import { ChevronDown, FolderOpen, GripVertical, Ungroup } from "lucide-react";
import Image from "next/image";
import type { PointerEvent } from "react";
import { boundsOf } from "@/lib/board-geometry";
import { type BoardItem, itemLabels, itemRect, type Tool } from "@/lib/board-model";

export function CollectionCard({
  item,
  members,
  selected,
  dropTarget,
  tool,
  onPointerDown,
  onUpdate,
  onUnwrap,
  layer,
  connectTarget,
}: {
  item: BoardItem;
  members: BoardItem[];
  selected: boolean;
  dropTarget: boolean;
  tool: Tool;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onUpdate: (changes: Partial<BoardItem>) => void;
  onUnwrap: () => void;
  layer: number;
  connectTarget: boolean;
}) {
  const rect = itemRect(item);
  const bounds = boundsOf(members);
  const scale = bounds
    ? Math.min((rect.width - 36) / Math.max(bounds.width, 1), 130 / Math.max(bounds.height, 1), 0.5)
    : 0.4;
  function start(event: PointerEvent<HTMLElement>) {
    if (tool === "grab" || event.button === 1) return;
    if (
      !item.collapsed &&
      !(event.target as HTMLElement).closest(".collection-heading") &&
      tool !== "connect"
    )
      return;
    event.stopPropagation();
    onPointerDown(event);
  }
  return (
    <section
      className={`${item.collapsed ? "board-card collection-card" : "collection-frame"} ${selected ? "is-selected" : ""} ${dropTarget ? "is-drop-target" : ""} ${tool === "connect" ? "pointer-tool-active" : ""} ${connectTarget ? "is-connect-target" : ""}`}
      style={{ left: item.x, top: item.y, width: rect.width, height: rect.height, zIndex: layer }}
      data-card-id={item.id}
      data-collapsed={item.collapsed}
      aria-label={`${item.title} collection`}
      onPointerDown={start}
    >
      <header className="collection-heading">
        <FolderOpen size={17} />
        <input
          aria-label="Collection title"
          value={item.title}
          readOnly={item.locked || tool !== "select"}
          onChange={(event) => onUpdate({ title: event.target.value })}
        />
        <GripVertical className="collection-grip" size={14} />
        {!item.collapsed && (
          <div className="collection-buttons">
            <button
              type="button"
              className="collection-action"
              disabled={item.locked}
              aria-label={`Collapse ${item.title}`}
              onClick={() => onUpdate({ collapsed: true })}
            >
              <ChevronDown size={14} />
              <span>Collapse</span>
            </button>
            <button
              type="button"
              className="collection-action"
              disabled={item.locked}
              aria-label={`Unwrap ${item.title}`}
              onClick={onUnwrap}
            >
              <Ungroup size={14} />
              <span>Unwrap</span>
            </button>
          </div>
        )}
      </header>
      {item.collapsed ? (
        <button
          type="button"
          className="collection-open"
          aria-label={`Open ${item.title}`}
          disabled={item.locked || tool !== "select"}
          onClick={() => onUpdate({ collapsed: false })}
        >
          <div className="collection-preview" aria-hidden="true">
            {members
              .filter((child) => !child.hidden)
              .map((child) => (
                <div
                  key={child.id}
                  className={`collection-preview-item preview-${child.kind}`}
                  style={{
                    left: bounds ? (child.x - bounds.x) * scale + 18 : 18,
                    top: bounds ? (child.y - bounds.y) * scale + 10 : 10,
                    width: child.width * scale,
                    height: child.height * scale,
                    background: child.kind === "sticky" ? child.color : "#fff",
                    transform: `rotate(${child.rotation}deg)`,
                  }}
                >
                  {child.kind === "image" && child.image && (
                    <Image
                      src={child.image.src}
                      alt=""
                      className="collection-preview-image"
                      draggable={false}
                      width={Math.round(child.width)}
                      height={Math.round(child.height)}
                      unoptimized
                    />
                  )}
                  <strong>
                    {child.kind === "link" ? "Reference Link" : itemLabels[child.kind]}
                  </strong>
                  <p>{child.kind === "link" ? child.url : child.text || "Your ideas, together"}</p>
                </div>
              ))}
          </div>
          <div className="collection-cover">
            <span className="collection-cover-title">{item.title || "Untitled collection"}</span>
            <span className="collection-count">
              {members.length} {members.length === 1 ? "item" : "items"}
            </span>
          </div>
        </button>
      ) : (
        !members.length && (
          <div className="empty-collection">
            <FolderOpen size={26} />
            <p>Drop components here</p>
          </div>
        )
      )}
      {item.collapsed && !members.length && (
        <span className="collection-empty-label">Drop components here to group them</span>
      )}
    </section>
  );
}
