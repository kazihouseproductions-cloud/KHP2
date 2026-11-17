import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { type BoardItem, type TodoEntry, todoEntries } from "@/lib/board-model";

export function TodoCard({
  item,
  disabled,
  onAdd,
  onUpdate,
}: {
  item: BoardItem;
  disabled: boolean;
  onAdd: () => void;
  onUpdate: (id: string, changes: Partial<Pick<TodoEntry, "text" | "done">>) => void;
}) {
  const rows = todoEntries(item);
  const focusNew = useRef(false);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  useEffect(() => {
    if (focusNew.current) {
      inputs.current.get(rows.at(-1)?.id || "")?.focus();
      focusNew.current = false;
    }
  }, [rows]);
  return (
    <div className="todo-card-content">
      <div className="todo-card-header">
        <h3>To-Do</h3>
        <button
          type="button"
          className="icon-button add-todo"
          aria-label="Add to-do item"
          title="Add to-do item"
          disabled={disabled}
          onClick={() => {
            focusNew.current = true;
            onAdd();
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="todo-list" data-canvas-scroll data-card-interactive>
        {rows.map((row, index) => (
          <label className={`todo-row ${row.done ? "is-done" : ""}`} key={row.id}>
            <input
              type="checkbox"
              aria-label={`Complete task ${index + 1}`}
              checked={row.done}
              disabled={disabled}
              onChange={(event) => onUpdate(row.id, { done: event.target.checked })}
            />
            <input
              ref={(element) => {
                if (element) inputs.current.set(row.id, element);
                else inputs.current.delete(row.id);
              }}
              aria-label={`To-do text ${index + 1}`}
              placeholder="Add a to-do..."
              value={row.text}
              readOnly={disabled}
              onChange={(event) => onUpdate(row.id, { text: event.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="todo-summary">
        {rows.filter((row) => row.done).length} of {rows.length} completed
      </p>
    </div>
  );
}
