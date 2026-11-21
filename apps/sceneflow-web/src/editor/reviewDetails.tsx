import { Check, Clapperboard, FileVideo, History } from "lucide-react";
import { activateVersion } from "./activateVersion";
import { DesignIcon, editTools } from "./DesignIcon";
import { commandReason } from "./timelineEdits";
import {
  type Clip,
  type Command,
  currentVersion,
  type DropTarget,
  type Edit,
  type Project,
  type Stage,
  stages,
  timecode,
} from "./types";

const shotFields = ["Camera", "Description", "Dialogue", "Action", "Location"];
const formatDate = (date: number) =>
  new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const seconds = (time: number) => `${Number(time.toFixed(3))} s`;

interface InfoProps {
  project: Project;
  clip: Clip | undefined;
  multiple: boolean;
  edit: Edit;
  author: string;
  pick: (target: DropTarget) => void;
  onVersionSelected?: () => void;
}

export function InfoPanel({
  project,
  clip,
  multiple,
  edit,
  author,
  pick,
  onVersionSelected,
}: InfoProps) {
  if (!clip || multiple)
    return (
      <div className="rv-empty">
        <Clapperboard />
        <strong>
          {multiple ? "Multiple clips selected" : "No clip selected"}
        </strong>
        <p>Select one timeline clip to see its details.</p>
      </div>
    );
  const selected = clip;
  const version = currentVersion(clip);
  const first = clip.versions[0];
  const shot = project.shots[clip.name] || {};
  const numbers = clip.name.match(/^(\d+)_(\d+)/);
  const locked = project.layers.some(
    (layer) => layer.id === clip.layerId && layer.locked,
  );
  function changeVersion(id: string) {
    if (locked) return;
    onVersionSelected?.();
    activateVersion(selected, id, author, edit);
  }
  function setStage(next: Stage) {
    if (!version || locked) return;
    edit(
      "Stage changed",
      `Set ${selected.name} V${selected.versions.indexOf(version) + 1} to ${next}`,
      (draft) => {
        const target = draft.clips.find((c) => c.id === selected.id);
        const entry = target?.versions.find((v) => v.id === version.id);
        if (target && entry) {
          entry.stage = next;
          Object.assign(target, { editor: author, edited: Date.now() });
        }
      },
      false,
      selected.id,
    );
  }
  return (
    <div className="rv-scroll rv-info">
      <section>
        <h3>Clip details</h3>
        <h4>
          <Clapperboard size={15} />
          {clip.name}
        </h4>
        <dl className="rv-facts">
          <dt>Scene</dt>
          <dd>{numbers ? Number(numbers[1]) : "—"}</dd>
          <dt>Shot</dt>
          <dd>{numbers ? Number(numbers[2]) : "—"}</dd>
          <dt>Clip Duration</dt>
          <dd title={timecode(clip.length)}>{seconds(clip.length)}</dd>
          <dt>Timeline Start</dt>
          <dd title={timecode(clip.start)}>{seconds(clip.start)}</dd>
          <dt>Timeline End</dt>
          <dd title={timecode(clip.start + clip.length)}>
            {seconds(clip.start + clip.length)}
          </dd>
          <dt>Added By</dt>
          <dd>
            {first?.author || "—"}
            {first && <small>{formatDate(first.created)}</small>}
          </dd>
          <dt>Last Edited By</dt>
          <dd>
            {clip.editor || "—"}
            <small>{formatDate(clip.edited)}</small>
          </dd>
        </dl>
      </section>
      <section>
        <h3>Shot Information</h3>
        {shotFields.map((field) => (
          <label
            className="rv-shot-field"
            key={`${clip.name}-${field}-${shot[field] || ""}`}
          >
            {field}
            <textarea
              aria-label={field}
              rows={field === "Description" || field === "Dialogue" ? 2 : 1}
              defaultValue={shot[field] || ""}
              disabled={locked}
              onBlur={(event) => {
                const value = event.currentTarget.value;
                if (value === (shot[field] || "")) return;
                edit(
                  "Shot information edited",
                  `Updated ${field.toLowerCase()} for ${clip.name}`,
                  (draft) => {
                    draft.shots[clip.name] ||= {};
                    draft.shots[clip.name][field] = value;
                    const target = draft.clips.find((c) => c.id === clip.id);
                    if (target)
                      Object.assign(target, {
                        editor: author,
                        edited: Date.now(),
                      });
                  },
                  false,
                  clip.id,
                );
              }}
            />
          </label>
        ))}
      </section>
      <section>
        <h3>Versions</h3>
        <div className="rv-versions">
          {clip.versions.map((v, i) => (
            <button
              type="button"
              key={v.id}
              className={
                v.id === clip.active ? "rv-version is-active" : "rv-version"
              }
              aria-pressed={v.id === clip.active}
              disabled={locked}
              onClick={() => changeVersion(v.id)}
            >
              <FileVideo size={15} />
              <b>V{i + 1}</b>
              <span title={v.filename}>{v.filename}</span>
              {v.id === clip.active && <Check size={14} />}
            </button>
          ))}
        </div>
        {version && (
          <label className="rv-shot-field">
            Stage
            <span className="rv-select">
              <select
                value={version.stage}
                disabled={locked}
                onChange={(e) => setStage(e.target.value as Stage)}
              >
                {stages.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
              <DesignIcon name="imgFiRrAngleSmallDown" size={13} />
            </span>
          </label>
        )}
        <button
          type="button"
          className="rv-upload"
          disabled={locked}
          onClick={() =>
            pick({
              kind: "version",
              layerId: clip.layerId,
              clipId: clip.id,
              time: clip.start,
            })
          }
        >
          <DesignIcon name="imgFiRsUpload" size={14} />
          Upload new version
        </button>
      </section>
    </div>
  );
}

const actions = [
  {
    name: "Timeline",
    items: ["undo", "redo", "delete"],
  },
  {
    name: "Clip editing",
    items: [
      "split",
      "trim-left",
      "trim-right",
      "add-left",
      "add-right",
      "slip",
    ],
  },
  {
    name: "Placement",
    items: ["snap", "magnet", "rearrange"],
  },
] as const;

export function EditPanel({
  project,
  selected,
  activeLayerId,
  time,
  command,
  canUndo,
  canRedo,
  snap,
}: {
  project: Project;
  selected: string[];
  activeLayerId?: string;
  time: number;
  command: (cmd: Command) => void;
  canUndo: boolean;
  canRedo: boolean;
  snap: boolean;
}) {
  return (
    <div className="rv-scroll rv-edit">
      <div className="rv-edit-summary">
        <History size={15} />
        {selected.length
          ? `${selected.length} clip${selected.length === 1 ? "" : "s"} selected`
          : "No clips selected"}
        <time>{timecode(time)}</time>
      </div>
      {actions.map((group) => (
        <section key={group.name}>
          <h3>{group.name}</h3>
          {group.items.map((id) => {
            const [icon, name] = editTools[id];
            const reason = commandReason(
              id,
              project,
              selected,
              time,
              canUndo,
              canRedo,
              activeLayerId,
            );
            return (
              <button
                type="button"
                className="rv-command"
                key={id}
                disabled={!!reason}
                title={reason || name}
                aria-pressed={id === "snap" ? snap : undefined}
                onClick={() => command(id)}
              >
                <DesignIcon name={icon} size={18} />
                <span>{name}</span>
                {id === "snap" && <small>{snap ? "On" : "Off"}</small>}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
