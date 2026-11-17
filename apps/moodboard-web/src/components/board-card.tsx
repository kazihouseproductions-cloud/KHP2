import { ChevronLeft, ChevronRight, GripVertical, Link2 } from "lucide-react";
import Image from "next/image";
import { type CSSProperties, type PointerEvent, useRef } from "react";
import type { TodoEntry } from "@/lib/board-model";
import { type BoardItem, safeLink, type Tool } from "@/lib/board-model";
import { CommentThread } from "./comment-thread";
import { TodoCard } from "./todo-card";

export function BoardCard({
  item,
  selected,
  tool,
  onFocus,
  onUpdate,
  onPointerDown,
  onInvalidLink,
  commentAuthor,
  onCommentAuthorChange,
  onPostComment,
  onAddTodo,
  onUpdateTodo,
  layer,
  connectTarget,
}: {
  item: BoardItem;
  selected: boolean;
  tool: Tool;
  onFocus: () => void;
  onUpdate: (changes: Partial<BoardItem>) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onInvalidLink: () => void;
  commentAuthor: string;
  onCommentAuthorChange: (name: string) => void;
  onPostComment: (text: string) => void;
  onAddTodo: () => void;
  onUpdateTodo: (id: string, changes: Partial<Pick<TodoEntry, "text" | "done">>) => void;
  layer: number;
  connectTarget: boolean;
}) {
  const linkInput = useRef<HTMLInputElement>(null);
  const interactiveTool =
    tool === "connect" || tool === "grab" || tool === "comment" || tool === "rotate";
  const locked = item.locked || interactiveTool;
  const styles: CSSProperties = {
    left: item.x,
    top: item.y,
    width: item.width,
    minHeight: item.height,
    height: item.kind === "todo" || item.kind === "image" ? item.height : undefined,
    zIndex: layer,
    transform: `rotate(${item.rotation}deg)`,
    ...(item.kind === "sticky" ? { backgroundColor: item.color } : {}),
  };

  function start(event: PointerEvent<HTMLElement>) {
    if (tool === "grab" || event.button === 1) return;
    event.stopPropagation();
    onPointerDown(event);
  }

  return (
    <section
      className={`board-card card-${item.kind} ${selected ? "is-selected" : ""} ${item.locked ? "is-locked" : ""} ${interactiveTool ? "pointer-tool-active" : ""} ${connectTarget ? "is-connect-target" : ""}`}
      style={styles}
      aria-label={`${item.title} card`}
      data-card-id={item.id}
      onPointerDown={start}
      onFocus={onFocus}
    >
      {item.kind === "sticky" && (
        <>
          <div className="sticky-grip" aria-hidden="true">
            <GripVertical size={13} />
          </div>
          <textarea
            aria-label="Sticky note content"
            value={item.text}
            readOnly={locked}
            onChange={(e) => onUpdate({ text: e.target.value })}
            spellCheck={false}
          />
        </>
      )}
      {item.kind === "text" && (
        <>
          <div className="text-grip" aria-hidden="true">
            <GripVertical size={13} />
          </div>
          <textarea
            className="text-content"
            aria-label="Text content"
            placeholder="Start writing..."
            value={item.text}
            readOnly={locked}
            onChange={(e) => onUpdate({ text: e.target.value })}
          />
        </>
      )}
      {item.kind === "link" && (
        <>
          <div className="link-heading">
            <Link2 size={16} />
            <span>Reference Link</span>
          </div>
          <div className="link-body">
            <input
              ref={linkInput}
              type="text"
              aria-label="Reference link URL"
              value={item.url}
              readOnly={locked}
              onChange={(e) => onUpdate({ url: e.target.value })}
              spellCheck={false}
            />
            <button
              type="button"
              className="open-link"
              disabled={locked}
              onClick={() => {
                const url = safeLink(item.url);
                if (url) window.open(url, "_blank", "noopener,noreferrer");
                else {
                  onInvalidLink();
                  linkInput.current?.focus();
                }
              }}
            >
              Open Link
            </button>
          </div>
        </>
      )}
      {item.kind === "todo" && (
        <TodoCard item={item} disabled={locked} onAdd={onAddTodo} onUpdate={onUpdateTodo} />
      )}
      {item.kind === "image" && item.image && (
        <Image
          className="board-image"
          src={item.image.src}
          alt={item.image.name}
          width={Math.round(item.width)}
          height={Math.round(item.height)}
          unoptimized
          draggable={false}
        />
      )}
      {item.kind === "calendar" && (
        <CalendarPreview item={item} disabled={locked} onUpdate={onUpdate} />
      )}
      {item.kind === "table" && <TablePreview item={item} disabled={locked} onUpdate={onUpdate} />}
      {item.kind === "comment" && (
        <CommentThread
          messages={item.messages}
          author={commentAuthor}
          disabled={locked}
          onAuthorChange={onCommentAuthorChange}
          onPost={onPostComment}
        />
      )}
    </section>
  );
}

function CalendarPreview({
  item,
  disabled,
  onUpdate,
}: {
  item: BoardItem;
  disabled: boolean;
  onUpdate: (changes: Partial<BoardItem>) => void;
}) {
  const date = new Date(`${item.date}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  function moveMonth(direction: number) {
    const next = new Date(year, month + direction, 1, 12);
    onUpdate({ date: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01` });
  }
  return (
    <>
      <div className="calendar-heading">
        <button
          className="icon-button"
          type="button"
          disabled={disabled}
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
        >
          <ChevronLeft />
        </button>
        <h3>{date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
        <button
          className="icon-button"
          type="button"
          disabled={disabled}
          aria-label="Next month"
          onClick={() => moveMonth(1)}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="calendar-grid">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span className="weekday" key={day}>
            {day}
          </span>
        ))}
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].slice(0, start).map((day) => (
          <span key={`empty-${day}`} />
        ))}
        {Array.from({ length }, (_, index) => index + 1).map((day) => (
          <button
            type="button"
            key={day}
            disabled={disabled}
            aria-label={`Select ${day} ${date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
            aria-pressed={day === date.getDate()}
            onClick={() =>
              onUpdate({
                date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
              })
            }
          >
            {day}
          </button>
        ))}
      </div>
    </>
  );
}

function TablePreview({
  item,
  disabled,
  onUpdate,
}: {
  item: BoardItem;
  disabled: boolean;
  onUpdate: (changes: Partial<BoardItem>) => void;
}) {
  let cells: string[][] = [
    ["Idea", "Notes", "Status"],
    ["", "", ""],
    ["", "", ""],
  ];
  try {
    if (item.text) cells = JSON.parse(item.text);
  } catch {
    /* Keep the empty preview. */
  }
  return (
    <>
      <h3 className="card-heading">Table</h3>
      <table className="preview-table">
        <tbody>
          {cells.map((row, rowIndex) => (
            <tr key={["heading", "first", "second"][rowIndex]}>
              {row.map((cell, columnIndex) => (
                <td key={["idea", "notes", "status"][columnIndex]}>
                  <input
                    aria-label={`Table row ${rowIndex + 1} column ${columnIndex + 1}`}
                    value={cell}
                    readOnly={disabled}
                    placeholder="—"
                    onChange={(event) => {
                      const next = cells.map((current) => [...current]);
                      next[rowIndex][columnIndex] = event.target.value;
                      onUpdate({ text: JSON.stringify(next) });
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
