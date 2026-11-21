import {
  Check,
  ChevronRight,
  Download,
  Film,
  History,
  LoaderCircle,
  Pencil,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DesignIcon } from "./DesignIcon";
import InlineName from "./InlineName";
import type { Feedback, Project } from "./types";

type Props = {
  project: Project;
  author: string;
  status: string;
  selected: number;
  job: string;
  busy: boolean;
  rename: (name: string) => void;
  profile: () => void;
  points: () => void;
  render: (selection: boolean) => void;
  preload: () => void;
  exit: () => void;
  openFeedback: (id: string) => void;
  retry: () => void;
};
export default function Header(p: Props) {
  const [menu, setMenu] = useState<"menu" | "bell" | null>(null),
    [seen, setSeen] = useState<string[]>([]);
  const box = useRef<HTMLElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      setSeen(
        JSON.parse(localStorage.getItem(`sceneflow.seen.${p.author}`) || "[]"),
      );
    } catch {
      setSeen([]);
    }
  }, [p.author]);
  useEffect(() => {
    if (!menu) return;
    function away(e: PointerEvent) {
      if (!box.current?.contains(e.target as Node)) setMenu(null);
    }
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);
  const alerts = p.project.feedback
    .filter(
      (f) =>
        f.status !== "draft" &&
        f.author !== p.author &&
        p.project.clips
          .find((c) => c.id === f.clipId)
          ?.versions.find((v) => v.id === f.versionId)?.author === p.author,
    )
    .sort((a, b) => b.created - a.created);
  const unread = alerts.filter((f) => !seen.includes(f.id)).length;
  function action(fn: () => void) {
    setMenu(null);
    fn();
  }
  function read(f: Feedback) {
    const ids = [...new Set([...seen, f.id])];
    setSeen(ids);
    try {
      localStorage.setItem(`sceneflow.seen.${p.author}`, JSON.stringify(ids));
    } catch {}
    action(() => p.openFeedback(f.id));
  }
  return (
    <header className="sf-header" ref={box}>
      <div className="sf-header-left">
        <button
          className="sf-header-icon"
          type="button"
          aria-label="Project menu"
          aria-expanded={menu === "menu"}
          onClick={() => setMenu(menu === "menu" ? null : "menu")}
        >
          <DesignIcon name="imgUnion" />
        </button>
        <button
          className="sf-header-icon"
          type="button"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          aria-expanded={menu === "bell"}
          onClick={() => setMenu(menu === "bell" ? null : "bell")}
        >
          <DesignIcon name="imgGroup" />
          {!!unread && <i className="sf-bell-dot" />}
        </button>
        <InlineName
          className="sf-project-name"
          value={p.project.title}
          label="Project name"
          maxLength={90}
          inputRef={titleInput}
          onActivate={() => setMenu(null)}
          onSave={p.rename}
        />
      </div>
      <span className="sf-wordmark">SceneFlow</span>
      <div className="sf-header-right">
        <button
          type="button"
          onClick={p.preload}
          disabled={!p.project.clips.length || p.busy}
          title="Preload video"
        >
          <DesignIcon name="imgImage3" />
          <span>Preload Video</span>
        </button>
        <button type="button" onClick={p.exit}>
          <DesignIcon name="imgUnion1" />
          <span>Exit</span>
        </button>
      </div>
      {menu === "menu" && (
        <div className="sf-pop sf-menu">
          <strong>Project menu</strong>
          <button type="button" onClick={() => action(p.points)}>
            <History />
            Checkpoints
          </button>
          <button
            type="button"
            disabled={p.busy || !p.project.clips.length}
            onClick={() => action(() => p.render(false))}
          >
            <Film />
            Export Full Video
          </button>
          <button
            type="button"
            disabled={p.busy || !p.selected}
            onClick={() => action(() => p.render(true))}
          >
            <Download />
            Export Selected Clips
          </button>
          <hr />
          <button
            type="button"
            onClick={() =>
              action(() => {
                titleInput.current?.focus();
                titleInput.current?.select();
              })
            }
          >
            <Pencil />
            Rename project
          </button>
          <button type="button" onClick={() => action(p.profile)}>
            <UserRound />
            <span>
              Local reviewer<small>{p.author}</small>
            </span>
            <ChevronRight />
          </button>
          <div className="sf-save-indicator">
            {p.status === "Saving locally" ? <LoaderCircle /> : <Check />}
            {p.status}
            {p.status === "Save failed" && (
              <button type="button" onClick={p.retry}>
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      {menu === "bell" && (
        <div className="sf-pop sf-notifications">
          <strong>Notifications</strong>
          {!alerts.length ? (
            <p>No feedback notifications for {p.author}.</p>
          ) : (
            alerts.map((f) => (
              <button type="button" key={f.id} onClick={() => read(f)}>
                <span className={seen.includes(f.id) ? "" : "sf-unread"}>
                  <b>{f.author}</b> left feedback on{" "}
                  {p.project.clips.find((c) => c.id === f.clipId)?.name}.
                  <small>{new Date(f.created).toLocaleString()}</small>
                </span>
                <ChevronRight />
              </button>
            ))
          )}
        </div>
      )}
    </header>
  );
}
