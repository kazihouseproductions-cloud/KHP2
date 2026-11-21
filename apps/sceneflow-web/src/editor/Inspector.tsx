import { MessageSquare, PencilLine, RotateCcw } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { DesignIcon } from "./DesignIcon";
import {
  FeedbackCard,
  feedbackColors,
  ImageViewer,
  kindIcons,
  labelsFor,
} from "./reviewCards";
import { reviewAuthorColor, sourceAt, timelinePins } from "./reviewCommon";
import { EditPanel, InfoPanel } from "./reviewDetails";
import { DrawingSurface } from "./reviewDrawing";
import { useVoiceCapture } from "./reviewVoice";
import { frame } from "./timelineEdits";
import type {
  Clip,
  Command,
  DropTarget,
  Edit,
  Feedback,
  Project,
} from "./types";
import "./review.css";

interface Props {
  project: Project;
  edit: Edit;
  selected: string[];
  activeLayerId?: string;
  time: number;
  activeClip: Clip | undefined;
  author: string;
  command: (cmd: Command) => void;
  pick: (target: DropTarget) => void;
  notify: (s: string) => void;
  pause: (at?: number) => void;
  seekFeedback: (id: string, panel?: "editor" | "inspector") => boolean;
  focusedFeedback: string | null;
  focusSeq: number;
  overlayHost: HTMLElement | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  canUndo: boolean;
  canRedo: boolean;
  snap: boolean;
  onPinFilter?: (ids: string[] | null) => void;
  onVoiceBusy?: (busy: boolean) => void;
  onShowInspector: () => void;
  onVersionSelected?: () => void;
}
type Panel = "Feedbacks" | "Info" | "Edit";
type Status = "all" | "pending" | "done" | "approved";
const statuses = [
  ["all", "All"],
  ["pending", "Pending"],
  ["done", "Done"],
  ["approved", "Approved"],
] as const;

export default function Inspector(props: Props) {
  const {
    project,
    edit,
    selected,
    time,
    activeClip,
    author,
    notify,
    seekFeedback,
    focusedFeedback,
    focusSeq,
    onPinFilter,
  } = props;
  const [panel, setPanel] = useState<Panel>("Feedbacks");
  const [shotFilter, setShotFilter] = useState<"all" | "active">("all");
  const [status, setStatus] = useState<Status>("all");
  const [colorFilter, setColorFilter] = useState("");
  const pinAuthors = useMemo(
    () => [...new Set(project.feedback.map((item) => item.author))].sort(),
    [project.feedback],
  );
  const pinAuthor = colorFilter.startsWith("author:")
    ? colorFilter.slice(7)
    : null;
  const [kindFilter, setKindFilter] = useState<Feedback["kind"] | "all">("all");
  const [focused, setFocused] = useState<{
    id: string;
    browsing: boolean;
  } | null>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const clicked = useRef(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const clipsById = useMemo(
    () => new Map(project.clips.map((clip) => [clip.id, clip])),
    [project.clips],
  );
  const currentShot = activeClip?.name || clipsById.get(selected[0])?.name;
  const resetFilters = useCallback(() => {
    setShotFilter("all");
    setStatus("all");
    setColorFilter("");
    setKindFilter("all");
  }, []);
  const focus = useCallback(
    (id: string, browsing = false) => {
      setPanel("Feedbacks");
      setFocused({ id, browsing });
      if (!browsing) resetFilters();
      requestAnimationFrame(() => {
        const card = document.getElementById(`review-item-${id}`),
          area = scroller.current;
        if (!card || !area) return;
        const cardBox = card.getBoundingClientRect(),
          areaBox = area.getBoundingClientRect();
        if (cardBox.top < areaBox.top || cardBox.bottom > areaBox.bottom)
          card.scrollIntoView({ block: "nearest" });
      });
    },
    [resetFilters],
  );
  useLayoutEffect(() => {
    if (focusedFeedback && clicked.current !== focusSeq) {
      clicked.current = focusSeq;
      focus(focusedFeedback);
    }
  }, [focusedFeedback, focusSeq, focus]);
  const filtered = useMemo(
    () =>
      project.feedback
        .filter((f) => {
          if (status !== "all" && f.status !== status) return false;
          if (
            pinAuthor !== null
              ? f.author !== pinAuthor
              : colorFilter && !labelsFor(f).includes(colorFilter)
          )
            return false;
          if (kindFilter !== "all" && f.kind !== kindFilter) return false;
          return (
            shotFilter === "all" ||
            (!!currentShot && clipsById.get(f.clipId)?.name === currentShot)
          );
        })
        .sort((a, b) => b.created - a.created),
    [
      project.feedback,
      status,
      pinAuthor,
      colorFilter,
      kindFilter,
      shotFilter,
      currentShot,
      clipsById,
    ],
  );
  const shotGroups = useMemo(() => {
    const groups = new Map<string, Feedback[]>();
    for (const item of filtered) {
      const shot = clipsById.get(item.clipId)?.name ?? "";
      const group = groups.get(shot);
      if (group) group.push(item);
      else groups.set(shot, [item]);
    }
    return [...groups].sort(([a], [b]) => {
      if (!a || !b) return Number(!a) - Number(!b);
      return a.localeCompare(b, "en", { numeric: true });
    });
  }, [clipsById, filtered]);
  const noFilters =
    shotFilter === "all" &&
    status === "all" &&
    !colorFilter &&
    kindFilter === "all";
  const signature = noFilters ? null : filtered.map((f) => f.id).join("|");
  const ordinals = new Map(
    project.feedback.map((item, index) => [item.id, index + 1]),
  );
  useEffect(() => {
    onPinFilter?.(
      signature === null ? null : signature ? signature.split("|") : [],
    );
  }, [onPinFilter, signature]);
  const posted = (id: string, audio: string) => {
    const item = project.feedback.find((f) => f.id === id);
    if (!item) return;
    const name =
      project.clips.find((c) => c.id === item.clipId)?.name || "clip";
    edit(
      "Feedback posted",
      `Posted voice feedback on ${name}`,
      (draft) => {
        const target = draft.feedback.find((f) => f.id === id);
        if (target && target.status === "draft") {
          target.audio = audio;
          target.status = "pending";
          target.text = target.text.trim();
        }
      },
      false,
      item.clipId,
      id,
    );
  };
  const voice = useVoiceCapture(posted, notify);
  const captureId = voice.capture?.id;
  const onVoiceBusy = props.onVoiceBusy;
  useEffect(() => {
    onVoiceBusy?.(!!captureId);
    if (!captureId) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      onVoiceBusy?.(false);
    };
  }, [captureId, onVoiceBusy]);
  useEffect(() => {
    if (
      captureId &&
      !project.feedback.some((f) => f.id === captureId && f.status === "draft")
    )
      voice.cancel();
  }, [captureId, project.feedback, voice.cancel]);
  function create(kind: "text" | "voice") {
    if (kind === "voice" && voice.currentId()) {
      voice.finish();
      return;
    }
    if (!activeClip) {
      notify("Move the playhead onto visible footage to leave feedback.");
      return;
    }
    const item: Feedback = {
      id: crypto.randomUUID(),
      clipId: activeClip.id,
      versionId: activeClip.active,
      sourceTime: sourceAt(activeClip, time),
      author,
      text: "",
      kind,
      status: "draft",
      created: Date.now(),
    };
    edit(
      "",
      "",
      (draft) => {
        draft.feedback.push(item);
      },
      false,
      activeClip.id,
      item.id,
    );
    props.onShowInspector();
    focus(item.id);
    if (kind === "voice") void voice.start(item.id);
  }
  function handleShortcut(key: string) {
    if (key === "t" || key === "v") {
      create(key === "t" ? "text" : "voice");
      return;
    }
    const pins = timelinePins(project.clips, filtered);
    const at = frame(time);
    const current = pins.findIndex(
      (pin) => pin.time === at && pin.item.id === focused?.id,
    );
    const forward = key === "]";
    const target =
      current >= 0
        ? pins[current + (forward ? 1 : -1)]
        : forward
          ? pins.find((pin) => pin.time >= at)
          : pins.findLast((pin) => pin.time <= at);
    if (target && seekFeedback(target.item.id)) focus(target.item.id, true);
  }
  const shortcut = useRef(handleShortcut);
  useEffect(() => {
    shortcut.current = handleShortcut;
  });
  useEffect(() => {
    function keydown(e: KeyboardEvent) {
      const target = e.target;
      if (
        e.repeat ||
        e.isComposing ||
        e.keyCode === 229 ||
        e.altKey ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.defaultPrevented ||
        document.querySelector("dialog[open], [aria-modal=true]")
      )
        return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input,textarea,select,[role=textbox],[popover]"))
      )
        return;
      const key = e.key.toLowerCase();
      if (key !== "t" && key !== "v" && key !== "[" && key !== "]") return;
      e.preventDefault();
      shortcut.current(key);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  return (
    <aside className="rv-inspector" aria-label="Clip inspector">
      <nav className="rv-tabs" aria-label="Inspector panels">
        {(["Feedbacks", "Info", "Edit"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={panel === tab ? "is-current" : ""}
            aria-pressed={panel === tab}
            onClick={() => setPanel(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      {panel === "Feedbacks" && (
        <>
          <div className="rv-feedback-controls">
            <div className="rv-tools">
              <button
                type="button"
                title="Text feedback (T)"
                aria-label="Text feedback (T)"
                onClick={() => create("text")}
                disabled={!activeClip}
              >
                <DesignIcon name="imgFiRrText1" size={24} />
                <kbd>T</kbd>
              </button>
              <button
                type="button"
                className={voice.capture ? "is-recording" : ""}
                aria-label={
                  voice.capture
                    ? "Finish voice recording (V)"
                    : "Voice feedback (V)"
                }
                title={
                  voice.capture
                    ? "Finish voice recording (V)"
                    : "Voice feedback (V)"
                }
                onClick={() => create("voice")}
                disabled={!activeClip && !voice.capture}
              >
                <DesignIcon name="imgFiRsMicrophone" size={24} />
                <kbd>V</kbd>
              </button>
            </div>
            <div
              className="rv-scope"
              role="toolbar"
              aria-label="Feedback shots"
            >
              <button
                type="button"
                aria-pressed={shotFilter === "all"}
                onClick={() => setShotFilter("all")}
              >
                All Shots
              </button>
              <button
                type="button"
                aria-pressed={shotFilter === "active"}
                onClick={() => setShotFilter("active")}
              >
                Active Shot
              </button>
              <label
                className="rv-filter-icon"
                data-active={Boolean(colorFilter)}
                title={
                  colorFilter
                    ? `Color label: ${pinAuthor ?? colorFilter}`
                    : "Filter by color label"
                }
              >
                <span
                  className="rv-filter-swatch"
                  style={{
                    backgroundColor:
                      pinAuthor !== null
                        ? reviewAuthorColor(pinAuthor)
                        : (feedbackColors.find((c) => c.name === colorFilter)
                            ?.hex ?? "#eb3333"),
                  }}
                />
                <select
                  aria-label="Filter by color label"
                  value={colorFilter}
                  onChange={(e) => setColorFilter(e.currentTarget.value)}
                >
                  <option value="">All colors</option>
                  {pinAuthors.length > 0 && (
                    <optgroup label="Reviewer pin colors">
                      {pinAuthors.map((name) => (
                        <option value={`author:${name}`} key={name}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Additional labels">
                    {feedbackColors.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label
                className="rv-filter-icon rv-kind-filter"
                data-active={kindFilter !== "all"}
                title={
                  kindFilter === "all"
                    ? "Filter by feedback type"
                    : `Type: ${kindFilter}`
                }
              >
                <DesignIcon
                  name={kindIcons[kindFilter === "all" ? "text" : kindFilter]}
                  size={14}
                />
                <select
                  aria-label="Filter by feedback type"
                  value={kindFilter}
                  onChange={(e) =>
                    setKindFilter(e.currentTarget.value as typeof kindFilter)
                  }
                >
                  <option value="all">All types</option>
                  <option value="text">Text</option>
                  <option value="voice">Voice</option>
                  <option value="drawing">Drawing</option>
                </select>
              </label>
            </div>
            <div
              className="rv-filters"
              role="toolbar"
              aria-label="Feedback status"
            >
              {statuses.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <section
            className="rv-scroll rv-cards"
            ref={scroller}
            aria-label="Feedback list"
          >
            {shotGroups.map(([shot, items]) => (
              <section key={shot} className="rv-shot-group">
                <h3 className="rv-shot-heading">
                  {shot ? `Shot ${shot}` : "Unknown shot"}
                </h3>
                {items.map((item) => (
                  <FeedbackCard
                    key={item.id}
                    item={item}
                    ordinal={ordinals.get(item.id) ?? 1}
                    clip={clipsById.get(item.clipId)}
                    author={author}
                    selected={focused?.id === item.id}
                    autoFocusComposer={!focused?.browsing}
                    edit={edit}
                    notify={notify}
                    open={() => {
                      focus(item.id);
                      seekFeedback(
                        item.id,
                        item.status === "draft" ? "inspector" : "editor",
                      );
                    }}
                    viewImage={setFullImage}
                    voice={voice}
                  />
                ))}
              </section>
            ))}
            {!filtered.length && (
              <div className="rv-empty">
                <div className="rv-empty-icon">
                  <MessageSquare />
                  <PencilLine size={11} />
                </div>
                <strong>
                  {noFilters ? "No feedback yet" : "No matching feedback"}
                </strong>
                <p>
                  {noFilters
                    ? project.clips.length
                      ? "Press T, record with V, or draw on a frame."
                      : "Add a clip to start reviewing."
                    : "Try another shot or status."}
                </p>
                {!noFilters && (
                  <button
                    type="button"
                    className="rv-text-link"
                    onClick={resetFilters}
                  >
                    <RotateCcw size={12} />
                    Reset filters
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}
      {panel === "Info" && (
        <InfoPanel
          project={project}
          clip={project.clips.find((c) => c.id === selected[0])}
          multiple={selected.length > 1}
          edit={edit}
          author={author}
          pick={props.pick}
          onVersionSelected={props.onVersionSelected}
        />
      )}
      {panel === "Edit" && (
        <EditPanel
          project={project}
          selected={selected}
          activeLayerId={props.activeLayerId}
          time={time}
          command={props.command}
          canUndo={props.canUndo}
          canRedo={props.canRedo}
          snap={props.snap}
        />
      )}
      {props.overlayHost &&
        createPortal(
          <DrawingSurface
            videoRef={props.videoRef}
            activeClip={activeClip}
            time={time}
            author={author}
            focused={project.feedback.find((f) => f.id === focused?.id)}
            project={project}
            edit={edit}
            pause={props.pause}
            focus={focus}
            notify={notify}
          />,
          props.overlayHost,
        )}
      {fullImage && (
        <ImageViewer id={fullImage} close={() => setFullImage(null)} />
      )}
    </aside>
  );
}
