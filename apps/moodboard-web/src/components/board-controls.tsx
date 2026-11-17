import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ExternalLink,
  FolderOpen,
  Hand,
  Image as ImageIcon,
  Link2,
  ListTodo,
  MessageSquare,
  MousePointer2,
  Redo2,
  Rocket,
  RotateCcw,
  SquareDashed,
  StickyNote,
  Table2,
  Type,
  Undo2,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { type ItemKind, itemLabels, type Tool } from "@/lib/board-model";

export const itemIcons = {
  sticky: StickyNote,
  text: Type,
  image: ImageIcon,
  link: Link2,
  todo: ListTodo,
  calendar: CalendarDays,
  table: Table2,
  collection: FolderOpen,
  comment: MessageSquare,
};

const creationTools: ItemKind[] = [
  "sticky",
  "text",
  "image",
  "link",
  "todo",
  "calendar",
  "table",
  "collection",
];
const pointerTools = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "grab", label: "Grab", icon: Hand, shortcut: "H" },
  { id: "comment", label: "Comment", icon: MessageSquare, shortcut: "C" },
] as const;

export function Sidebar({
  boardTitle,
  onTitleChange,
  tool,
  onTool,
  onAdd,
  onFiles,
}: {
  boardTitle: string;
  onTitleChange: (title: string) => void;
  tool: Tool;
  onTool: (tool: Tool) => void;
  onAdd: (kind: ItemKind) => void;
  onFiles: () => void;
}) {
  return (
    <aside className="tool-panel" aria-label="Moodboard tools">
      <div className="brand-heading">
        <span className="moodboard-mark" aria-hidden="true">
          <SquareDashed size={24} />
          <Rocket size={24} />
        </span>
        <h1 className="font-semibold">Moodboard</h1>
      </div>
      <BoardTitle title={boardTitle} onChange={onTitleChange} />
      <nav className="creation-tools" aria-label="Add to board">
        {creationTools.map((kind) => {
          const Icon = itemIcons[kind];
          return (
            <button
              className="tool-button"
              type="button"
              key={kind}
              onClick={() => onAdd(kind)}
              title={`Add ${itemLabels[kind]}`}
            >
              <Icon />
              <span>{itemLabels[kind]}</span>
            </button>
          );
        })}
        <button
          className="tool-button"
          type="button"
          aria-pressed={tool === "connect"}
          onClick={() => onTool("connect")}
          title="Connect two elements"
        >
          <ArrowUpRight />
          <span>Connect</span>
        </button>
      </nav>
      <div className="navigation-tools" role="toolbar" aria-label="Canvas tools">
        {pointerTools.map(({ id, label, icon: Icon, shortcut }) => (
          <button
            className="tool-button"
            type="button"
            key={id}
            aria-pressed={tool === id}
            onClick={() => onTool(id)}
            title={`${label} (${shortcut})`}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          className="tool-button exit-button"
          onClick={onFiles}
          title="Exit to files"
        >
          <ExternalLink />
          <span>Exit to files</span>
        </button>
      </div>
      <div className="brand-footer">
        <Image
          src="/brand/kazi-house.png"
          alt="Kazi House Productions"
          width={76}
          height={68}
          priority
        />
      </div>
    </aside>
  );
}

function BoardTitle({ title, onChange }: { title: string; onChange: (title: string) => void }) {
  const [draft, setDraft] = useState(title);
  const cancelled = useRef(false);
  return (
    <label className="board-name-field">
      <span>BOARD</span>
      <input
        aria-label="Board title"
        title="Edit board title"
        value={draft}
        maxLength={120}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const value = cancelled.current ? title : draft.trim() || "Untitled board";
          cancelled.current = false;
          setDraft(value);
          onChange(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            cancelled.current = true;
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function BottomToolbar({
  tool,
  onTool,
  canUndo,
  canRedo,
  canRotate,
  onUndo,
  onRedo,
  onRotate,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  canUndo: boolean;
  canRedo: boolean;
  canRotate: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRotate: () => void;
}) {
  return (
    <div className="bottom-toolbar" role="toolbar" aria-label="Board actions">
      {pointerTools.map(({ id, label, icon: Icon, shortcut }) => (
        <button
          type="button"
          className="bottom-action"
          key={id}
          aria-pressed={tool === id}
          title={`${label} (${shortcut})`}
          onClick={() => onTool(id)}
        >
          <Icon />
          <span className="toolbar-label">{label}</span>
        </button>
      ))}
      <button
        type="button"
        className="bottom-action"
        aria-disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        onClick={onUndo}
      >
        <Undo2 />
        <span className="toolbar-label">Undo</span>
      </button>
      <button
        type="button"
        className="bottom-action"
        aria-disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        onClick={onRedo}
      >
        <Redo2 />
        <span className="toolbar-label">Redo</span>
      </button>
      <button
        type="button"
        className="bottom-action"
        aria-disabled={!canRotate}
        aria-pressed={tool === "rotate"}
        title="Rotate: drag selected objects"
        onClick={onRotate}
      >
        <RotateCcw />
        <span className="toolbar-label">Rotate</span>
      </button>
    </div>
  );
}

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <div className="app-switcher" ref={wrapper}>
      {open && (
        <section className="apps-popover" aria-label="Applications">
          <p className="mb-3 text-xs text-neutral-400">Your workspace</p>
          <a
            href={process.env.NEXT_PUBLIC_KHP_URL || "http://localhost:3000"}
            className="app-option"
          >
            <span className="app-tile khp-tile">
              <SquareDashed size={19} />
            </span>
            <span>KHP Workspace</span>
            <ExternalLink size={14} />
          </a>
          <button type="button" className="app-option current-app" onClick={() => setOpen(false)}>
            <span className="app-tile moodboard-tile">
              <Rocket size={18} />
            </span>
            <span>Moodboard</span>
            <Check size={15} />
          </button>
          {process.env.NEXT_PUBLIC_SCENEFLOW_URL ? (
            <a className="app-option" href={process.env.NEXT_PUBLIC_SCENEFLOW_URL}>
              <span className="app-tile sceneflow-tile">
                <Table2 size={18} />
              </span>
              <span>SceneFlow</span>
              <ExternalLink size={14} />
            </a>
          ) : (
            <div className="app-option unavailable-app">
              <span className="app-tile sceneflow-tile">
                <Table2 size={18} />
              </span>
              <span>
                SceneFlow<small>Coming soon</small>
              </span>
            </div>
          )}
        </section>
      )}
      <button
        ref={button}
        className="apps-button"
        type="button"
        aria-label="Apps"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Image src="/brand/apps.svg" alt="" width={28.4286} height={28.4286} />
        <span>Apps</span>
      </button>
    </div>
  );
}
