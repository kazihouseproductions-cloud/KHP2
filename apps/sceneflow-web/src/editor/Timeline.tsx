import {
  Eye,
  EyeOff,
  Film,
  Link2,
  LockKeyhole,
  Pause,
  Plus,
  Upload,
} from "lucide-react";
import {
  type CSSProperties,
  type DragEvent,
  Fragment,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { DesignIcon, editTools } from "./DesignIcon";
import InlineName from "./InlineName";
import LayerMenu from "./LayerMenu";
import { intakePosition } from "./mediaPlan";
import Overview from "./Overview";
import {
  feedbackPinColor,
  reviewAuthorColor,
  timelinePins,
} from "./reviewCommon";
import SlipClip, { type SlipPreview } from "./SlipClip";
import {
  checkTracks,
  clipRange,
  commandReason,
  deleteClips,
  editRange,
  end,
  fitBlocks,
  fps,
  frame,
  makeRoom,
  maxSlipFrames,
  moveClip,
  rearrange,
  shotColumns,
  slip,
  snapAll,
} from "./timelineEdits";
import {
  type Clip,
  type Command,
  currentVersion,
  type DropTarget,
  type Edit,
  type Feedback,
  type Layer,
  type Project,
  timecode,
} from "./types";
import "./timeline.css";

export type TimelineProps = {
  project: Project;
  edit: Edit;
  selected: string[];
  select: (ids: string[]) => void;
  time: number;
  seek: (t: number) => void;
  playing: boolean;
  play: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onImport: (files: File[], target: DropTarget) => void;
  pick: (target: DropTarget) => void;
  notify: (s: string) => void;
  author: string;
  onPin: (id: string) => void;
  commandRef: RefObject<((cmd: Command) => void) | null>;
  revealTimeRef: RefObject<((time: number) => void) | null>;
  snap: boolean;
  setSnap: (v: boolean) => void;
  onSlipPreview: (preview: SlipPreview | null) => void;
  onToggleClipVisibility: (clip: Clip) => void;
  onActiveLayer?: (layerId: string) => void;
};

const mainTools: Command[] = [
  "delete",
  "undo",
  "redo",
  "split",
  "trim-left",
  "trim-right",
  "add-left",
  "add-right",
  "rearrange",
];
const clipDragType = "application/x-sceneflow-placement";
const zoomSteps = [1, 1.25, 1.5, 2, 3, 4, 6, 8];
type Rect = { x: number; y: number; w: number; h: number };
type PinGroup = { x: number; pins: Feedback[] };
const styleVar = (name: string, value: string | number) =>
  ({ [name]: value }) as CSSProperties;

function pinGroups(
  clips: Clip[],
  feedback: Feedback[],
  scale: number,
): PinGroup[] {
  const groups: PinGroup[] = [];
  for (const { time, item } of timelinePins(clips, feedback)) {
    const x = time * scale;
    const last = groups.at(-1);
    if (last && Math.abs(last.x - x) < 15) last.pins.push(item);
    else groups.push({ x, pins: [item] });
  }
  return groups;
}

export default function Timeline(props: TimelineProps) {
  const {
    project,
    edit: applyEdit,
    selected,
    select,
    time,
    seek,
    playing,
    play,
    undo,
    redo,
    canUndo,
    canRedo,
    onImport,
    pick,
    notify,
    author,
    onPin,
    commandRef,
    revealTimeRef,
    snap,
    setSnap,
    onActiveLayer,
    onSlipPreview,
    onToggleClipVisibility,
  } = props;
  function edit(...args: Parameters<Edit>) {
    try {
      applyEdit(...args);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "The timeline edit could not be applied.",
      );
    }
  }
  const [layerId, chooseLayer] = useState("parent");
  const [zoom, setZoom] = useState(0);
  const [dropScale, setDropScale] = useState<{
    clips: Clip[];
    span: number;
  } | null>(null);
  const [viewport, setViewport] = useState(760);
  const [scroll, setScroll] = useState(0);
  const [uploaderColors, setUploaderColors] = useState<Record<string, string>>(
    {},
  );
  const [layerMenu, setLayerMenu] = useState<{
    id: string;
    trigger: HTMLButtonElement;
  } | null>(null);
  const [pinMenu, setPinMenu] = useState("");
  const [slipClip, setSlipClip] = useState("");
  const [slipDock, setSlipDock] = useState<HTMLDivElement | null>(null);
  const [dragTarget, setDragTarget] = useState<DropTarget | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileCount, setFileCount] = useState(1);
  const [rect, setRect] = useState<Rect | null>(null);
  const timeline = useRef<HTMLElement>(null);
  const board = useRef<HTMLElement>(null);
  const followPlayhead = useRef(true);
  const sheet = useRef<HTMLDivElement>(null);
  const anchor = useRef("");
  const dragged = useRef<{
    id: string;
    offset: number;
    ids: string[];
    shots: Set<string>;
  } | null>(null);
  const shiftDrag = useRef<{ pointer: number; x: number; y: number } | null>(
    null,
  );
  const suppressClipClick = useRef(false);
  const centerFootprint = useRef<Clip | null>(null);
  const lastHover = useRef<{
    layer: string;
    newLayer: boolean;
    time: number;
    target: DropTarget;
  } | null>(null);
  const selection = useRef<{
    pointer: number;
    x: number;
    y: number;
    ids: string[];
    moved: boolean;
    layer: string;
  } | null>(null);
  const scrub = useRef(false);
  const uid = useId();
  const current =
    project.clips.find(
      (c) => c.layerId === layerId && selected.includes(c.id),
    ) ?? project.clips.find((c) => selected.includes(c.id));
  const activeLayer =
    current?.layerId ??
    (project.layers.some((l) => l.id === layerId) ? layerId : "parent");
  useEffect(() => {
    onActiveLayer?.(activeLayer);
  }, [activeLayer, onActiveLayer]);
  const layers = [...project.layers].reverse();
  const parents = useMemo(() => shotColumns(project.clips), [project.clips]);
  const gesture = dragged.current;
  const dragId = gesture?.id;
  const groupDrag = !!gesture && gesture.ids.length > 1;
  const duration = project.clips.reduce((sum, c) => Math.max(sum, end(c)), 0);
  const trailingSpace = Math.max(0.25, Math.min(15, duration * 0.18));
  const committedSpan = project.clips.length
    ? frame(duration + trailingSpace)
    : 20;
  const labelWidth = Math.round(Math.max(82, Math.min(167, viewport * 0.146)));
  const gutter = labelWidth + Math.round(Math.min(36, viewport * 0.031));
  const usableWidth = Math.max(150, viewport - gutter - 1);
  const scaleSpan =
    dropScale?.clips === project.clips ? dropScale.span : committedSpan;
  const scale = Math.ceil(usableWidth * zoomSteps[zoom]) / scaleSpan;
  const dropPreview = useMemo(() => {
    if (!dragTarget || dragTarget.kind === "new-layer" || !project.clips.length)
      return null;
    if (!dragId && dragTarget.kind === "version") return null;
    const clips = project.clips.map((clip) => ({ ...clip }));
    const draft = { ...project, clips };
    try {
      if (gesture) {
        moveClip(draft, gesture.id, dragTarget, author, gesture.ids);
        return { clips, fileSlot: null };
      }
      // Explorer supplies the files on drop. Reserve a screen-sized slot until intake reads their durations.
      const length = Math.max(1 / fps, frame(80 / scale));
      const { start, block } = intakePosition(draft, dragTarget);
      const child = dragTarget.layerId !== "parent";
      if (child && !block) return null;
      makeRoom(
        draft,
        dragTarget.layerId,
        start,
        length,
        author,
        block?.parent.id,
      );
      const slot: Clip = {
        ...clips[0],
        id: "file-preview",
        layerId: dragTarget.layerId,
        parentId: child ? (block?.parent.id ?? null) : null,
        start,
        length,
      };
      draft.clips = [...clips, slot];
      fitBlocks(draft, author);
      checkTracks(draft);
      return {
        clips,
        fileSlot: slot,
      };
    } catch {
      return null;
    }
  }, [project, dragTarget, dragId, gesture, author, scale]);
  const layoutClips = dropPreview?.clips ?? project.clips;
  const fileSlot = dropPreview?.fileSlot;
  const layoutColumns = useMemo(
    () => shotColumns(fileSlot ? [...layoutClips, fileSlot] : layoutClips),
    [fileSlot, layoutClips],
  );
  const previewClip =
    dragId && dropPreview
      ? layoutClips.find((c) => c.id === dragId)
      : undefined;
  const sourceClip = previewClip && project.clips.find((c) => c.id === dragId);
  const swapPreview = !!previewClip && dragTarget?.kind === "version";
  const span =
    dropPreview?.clips.reduce(
      (last, clip) => Math.max(last, end(clip)),
      Math.max(committedSpan, scaleSpan, fileSlot ? end(fileSlot) : 0),
    ) ?? Math.max(committedSpan, scaleSpan);
  const width = Math.round(span * scale);
  const tick =
    [
      1 / 24,
      1 / 12,
      0.25,
      0.5,
      1,
      2,
      5,
      10,
      15,
      30,
      60,
      120,
      300,
      600,
      1800,
      3600,
    ].find((s) => s * scale >= 65) ?? Math.max(3600, Math.ceil(span / 10));
  const firstTick = Math.max(0, Math.floor(scroll / scale / tick) - 1);
  const lastTick = Math.min(
    Math.ceil(span / tick),
    Math.ceil((scroll + usableWidth) / scale / tick) + 1,
  );
  const ticks = Array.from(
    { length: Math.max(0, lastTick - firstTick + 1) },
    (_, i) => (i + firstTick) * tick,
  );
  const selectedSlip =
    current?.id === slipClip &&
    selected.length === 1 &&
    !project.layers.find((layer) => layer.id === current.layerId)?.locked &&
    maxSlipFrames(current) > 0
      ? current
      : undefined;
  useEffect(() => {
    if (slipClip && !selectedSlip) setSlipClip("");
  }, [selectedSlip, slipClip]);
  const menuLayer = project.layers.find((l) => l.id === layerMenu?.id);
  const scrollMax = Math.max(0, width - usableWidth);

  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const resize = new ResizeObserver(() => setViewport(el.clientWidth));
    resize.observe(el);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    const root = timeline.current;
    const tracks = board.current;
    if (!root || !tracks) return;
    function pan(event: WheelEvent) {
      if (
        !tracks ||
        event.defaultPrevented ||
        !event.cancelable ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof Element &&
          event.target.closest(
            "dialog, [popover], .sft-slip-controls, .sft-pin-list, select, textarea, input:focus:not([type=range])",
          )) ||
        tracks.scrollWidth <= tracks.clientWidth + 1
      )
        return;
      const mode = event.deltaMode;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      let step = 1;
      if (mode === WheelEvent.DOM_DELTA_LINE)
        step = parseFloat(getComputedStyle(tracks).lineHeight) || 16;
      else if (mode === WheelEvent.DOM_DELTA_PAGE) step = tracks.clientWidth;
      else step = tracks.offsetWidth / tracks.getBoundingClientRect().width;
      const before = tracks.scrollLeft;
      tracks.scrollLeft += delta * step;
      if (tracks.scrollLeft !== before) followPlayhead.current = false;
    }
    root.addEventListener("wheel", pan, { passive: false });
    return () => root.removeEventListener("wheel", pan);
  }, []);
  useEffect(() => {
    if (playing) followPlayhead.current = true;
  }, [playing]);
  const revealTime = useCallback(
    (at: number) => {
      const el = board.current;
      if (!el) return;
      const x = at * scale;
      if (x < el.scrollLeft || x > el.scrollLeft + usableWidth - 12)
        el.scrollLeft = Math.max(0, x - usableWidth * 0.22);
    },
    [scale, usableWidth],
  );
  useImperativeHandle(revealTimeRef, () => revealTime, [revealTime]);
  useEffect(() => {
    if (playing && followPlayhead.current) revealTime(time);
  }, [playing, time, revealTime]);

  function command(cmd: Command) {
    const reason = commandReason(
      cmd,
      project,
      selected,
      time,
      canUndo,
      canRedo,
      activeLayer,
    );
    if (reason) {
      notify(reason);
      return;
    }
    if (cmd === "undo") return undo();
    if (cmd === "redo") return redo();
    if (cmd === "snap") return setSnap(!snap);
    if (cmd === "add-left" || cmd === "add-right") {
      const side = cmd === "add-left" ? "left" : "right";
      const point = current
        ? side === "left"
          ? current.start
          : end(current)
        : frame(time);
      const parent = parents.find((c) => point >= c.start && point < end(c));
      return pick({
        kind: "insert",
        layerId: activeLayer,
        time: point,
        clipId: current?.id,
        parentId: activeLayer === "parent" ? undefined : parent?.id,
        side,
      });
    }
    if (cmd === "slip" && current) {
      setSlipClip(selectedSlip ? "" : current.id);
      return;
    }
    if (cmd === "delete") {
      const count = project.clips.filter(
        (c) =>
          selected.includes(c.id) ||
          (c.parentId && selected.includes(c.parentId)),
      ).length;
      return edit(
        "Delete",
        `Deleted ${count} clip${count === 1 ? "" : "s"}`,
        (p) => deleteClips(p, selected),
        count > 1,
      );
    }
    if (cmd === "magnet")
      return edit("Snap All", "Closed gaps between selected clips", (p) =>
        snapAll(p, selected, author),
      );
    if (cmd === "rearrange")
      return edit(
        "Rearrange",
        "Rearranged shot blocks by parent filename",
        (p) => rearrange(p, selected, author),
      );
    if (
      (cmd === "split" || cmd === "trim-left" || cmd === "trim-right") &&
      current
    )
      edit(
        editTools[cmd][1],
        `${editTools[cmd][1]} · ${current.name}`,
        (p) => editRange(p, current.id, cmd, time, author),
        false,
        current.id,
      );
  }
  useEffect(() => {
    commandRef.current = command;
    return () => {
      commandRef.current = null;
    };
  });
  function commandButton(cmd: Command) {
    const [icon, name] = editTools[cmd];
    const reason = commandReason(
      cmd,
      project,
      selected,
      time,
      canUndo,
      canRedo,
      activeLayer,
    );
    const isSnap = cmd === "snap";
    return (
      <span
        key={cmd}
        className="sft-command-wrap"
        title={reason ? `${name} · ${reason}` : name}
      >
        <button
          type="button"
          className={`sft-icon sft-cmd-${cmd} ${(isSnap && snap) || (cmd === "slip" && selectedSlip) ? "sft-toggled" : ""}`}
          aria-label={name}
          aria-pressed={
            isSnap ? snap : cmd === "slip" ? !!selectedSlip : undefined
          }
          disabled={!!reason}
          onClick={() => command(cmd)}
        >
          <DesignIcon name={icon} />
        </button>
      </span>
    );
  }
  function selectionForClip(
    c: Clip,
    mod: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
    forDrag = false,
  ) {
    if (forDrag && selected.includes(c.id)) return selected;
    const additive = mod.ctrlKey || mod.metaKey;
    const fromId = selected.includes(anchor.current)
      ? anchor.current
      : selected[0];
    const from = project.clips.find((item) => item.id === fromId);
    if (mod.shiftKey && from) {
      anchor.current = from.id;
      const ids = clipRange(project, from, c);
      return additive ? [...new Set([...selected, ...ids])] : ids;
    }
    if (
      forDrag &&
      !additive &&
      selected.length > 1 &&
      project.clips.some(
        (item) =>
          selected.includes(item.id) &&
          (item.parentId ?? item.id) === (c.parentId ?? c.id),
      )
    )
      return selected;
    if (additive && selected.includes(c.id)) {
      const ids = selected.filter((id) => id !== c.id);
      anchor.current = ids.at(-1) ?? "";
      return ids;
    }
    anchor.current = c.id;
    return additive ? [...selected, c.id] : [c.id];
  }
  function selectClip(
    c: Clip,
    mod: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  ) {
    chooseLayer(c.layerId);
    select(selectionForClip(c, mod));
    if (
      !mod.shiftKey &&
      !mod.ctrlKey &&
      !mod.metaKey &&
      (time < c.start || time >= end(c))
    )
      seek(c.start);
  }
  function addLayer() {
    const id = crypto.randomUUID();
    edit("Layer", "Added a new layer", (p) => {
      const i = p.layers.findIndex((l) => l.id === activeLayer);
      p.layers.splice(i + 1, 0, {
        id,
        name: "new layer",
        visible: true,
        locked: false,
      });
    });
    select([]);
    chooseLayer(id);
  }
  function toggleLayer(l: Layer, key: "visible" | "locked") {
    edit(
      "Layer",
      `${key === "locked" ? (l.locked ? "Unlocked" : "Locked") : l.visible ? "Hid" : "Showed"} ${l.name}`,
      (p) => {
        const layer = p.layers.find((item) => item.id === l.id);
        if (layer) layer[key] = !layer[key];
      },
    );
  }
  function point(clientX: number, clientY: number) {
    const el = sheet.current;
    if (!el) return { x: 0, y: 0 };
    const bounds = el.getBoundingClientRect();
    const toLayout = bounds.width ? el.offsetWidth / bounds.width : 1;
    return {
      x: (clientX - bounds.left) * toLayout,
      y: (clientY - bounds.top) * toLayout,
    };
  }
  function timeAt(clientX: number) {
    return Math.min(
      span,
      Math.max(0, frame((point(clientX, 0).x - gutter) / scale)),
    );
  }
  function keyboardSeek(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      seek(
        Math.max(
          0,
          Math.min(
            duration,
            frame(
              time +
                (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 1 : 1 / fps),
            ),
          ),
        ),
      );
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      e.stopPropagation();
      seek(e.key === "Home" ? 0 : duration);
    }
  }
  function destination(
    pointer: number,
    layerId: string,
    newLayer = false,
  ): DropTarget {
    if (!project.clips.length)
      return { kind: "cell", layerId: "parent", time: 0 };
    if (newLayer)
      return {
        kind: "new-layer",
        layerId,
        time: Math.max(0, frame(pointer - (dragged.current?.offset ?? 0))),
      };
    // Keep the open slot as an insertion target while the pointer travels through it.
    const containsPointer = (c: Pick<Clip, "start" | "length" | "layerId">) =>
      c.layerId === layerId && pointer >= c.start && pointer < end(c);
    const slot = previewClip ?? fileSlot;
    const inGroupPreview =
      groupDrag &&
      dropPreview &&
      layoutClips.some(
        (c) => gesture.shots.has(c.parentId ?? c.id) && containsPointer(c),
      );
    if (
      dragTarget?.kind === "insert" &&
      ((slot && containsPointer(slot)) || inGroupPreview)
    )
      return dragTarget;
    // A swap or closing an insertion gap moves cards under the pointer.
    // Keep the original center target stable until the pointer reaches an edge or another clip.
    const held =
      dragTarget?.kind === "version" ? centerFootprint.current : null;
    const hitClips = swapPreview || groupDrag ? project.clips : layoutClips;
    const visible =
      held && containsPointer(held)
        ? held
        : hitClips.find(
            (c) =>
              c.id !== dragId &&
              !(groupDrag && gesture.shots.has(c.parentId ?? c.id)) &&
              containsPointer(c),
          );
    if (visible) {
      const anchor = dropPreview
        ? (project.clips.find((c) => c.id === visible.id) ?? visible)
        : visible;
      const x = (pointer - visible.start) * scale,
        zone = Math.min(17, visible.length * scale * 0.22);
      if (x < zone || visible.length * scale - x < zone) {
        const side = x < zone ? "left" : "right";
        const at = side === "left" ? anchor.start : end(anchor);
        return {
          kind: "insert",
          layerId,
          time: at,
          clipId: visible.id,
          side,
          parentId:
            layerId === "parent"
              ? undefined
              : parents.find((c) => c.start <= at && at < end(c))?.id,
        };
      }
      centerFootprint.current = visible;
      return {
        kind: "version",
        layerId,
        time: anchor.start,
        clipId: visible.id,
      };
    }
    const parent = parents.find((c) => pointer >= c.start && pointer < end(c));
    const internal = dragged.current;
    let at = internal ? Math.max(0, frame(pointer - internal.offset)) : pointer;
    if (layerId !== "parent" && internal && snap) {
      const boundaries = parents.flatMap((c) => [c.start, end(c)]);
      const nearest = boundaries.sort(
        (a, b) => Math.abs(at - a) - Math.abs(at - b),
      )[0];
      if (nearest !== undefined && Math.abs(nearest - at) * scale <= 16)
        at = nearest;
    } else if (layerId !== "parent" && parent && !internal) at = parent.start;
    return {
      kind: "cell",
      layerId,
      time: at,
      parentId: layerId === "parent" ? undefined : parent?.id,
    };
  }
  function targetAtPointer(
    e: { clientX: number },
    layer: string,
    newLayer: boolean,
  ) {
    const time = timeAt(e.clientX);
    const last = lastHover.current;
    if (
      last &&
      last.layer === layer &&
      last.newLayer === newLayer &&
      last.time === time
    )
      return last.target;
    const target = destination(time, layer, newLayer);
    lastHover.current = { layer, newLayer, time, target };
    return target;
  }
  function dragOver(e: DragEvent, l: Layer, newLayer = false) {
    if (!dragged.current && !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    if (!dragged.current)
      setFileCount(
        Math.max(
          1,
          Array.from(e.dataTransfer.items).filter(
            (item) => item.kind === "file",
          ).length,
        ),
      );
    if (l.locked && !newLayer) {
      e.dataTransfer.dropEffect = "none";
      clearDragTarget();
      return;
    }
    e.dataTransfer.dropEffect = dragged.current ? "move" : "copy";
    setDragTarget(targetAtPointer(e, l.id, newLayer));
    scrollDrag(e);
  }
  function scrollDrag(e: { clientX: number; clientY: number }) {
    const container = board.current;
    if (container) {
      const bounds = container.getBoundingClientRect();
      const ratio = bounds.width / container.offsetWidth;
      if (e.clientX > bounds.right - 26 * ratio) container.scrollLeft += 10;
      else if (e.clientX < bounds.left + (gutter + 14) * ratio)
        container.scrollLeft -= 10;
      if (e.clientY > bounds.bottom - 22 * ratio) container.scrollTop += 10;
      else if (e.clientY < bounds.top + 34 * ratio) container.scrollTop -= 10;
    }
  }
  const clearDragTarget = useCallback(() => {
    lastHover.current = null;
    centerFootprint.current = null;
    setDragTarget(null);
  }, []);
  useEffect(() => {
    if (!dragging || dragId) return;
    // An OS drag has no dragend on this page. Ordinary pointer input resumes when it ends.
    const reset = () => {
      clearDragTarget();
      setDragging(false);
    };
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") reset();
    };
    window.addEventListener("pointermove", reset);
    window.addEventListener("pointerdown", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("pointermove", reset);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("keydown", cancel);
    };
  }, [dragging, dragId, clearDragTarget]);
  const finishDrag = useCallback(() => {
    clearDragTarget();
    shiftDrag.current = null;
    dragged.current = null;
    setDragging(false);
  }, [clearDragTarget]);
  useEffect(() => {
    if (!dragging || !shiftDrag.current) return;
    function cancelOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") finishDrag();
    }
    window.addEventListener("keydown", cancelOnEscape);
    window.addEventListener("blur", finishDrag);
    return () => {
      window.removeEventListener("keydown", cancelOnEscape);
      window.removeEventListener("blur", finishDrag);
    };
  }, [dragging, finishDrag]);
  function beginClipDrag(
    c: Clip,
    mod: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
    x: number,
  ) {
    const ids = selectionForClip(c, mod, true);
    const shots = new Set(
      project.clips
        .filter((clip) => ids.includes(clip.id))
        .map((clip) => clip.parentId ?? clip.id),
    );
    dragged.current = {
      id: c.id,
      ids,
      shots,
      offset: Math.max(0, timeAt(x) - c.start),
    };
    setDragging(true);
    if (ids !== selected) select(ids);
    chooseLayer(c.layerId);
  }
  function commitMove(target: DropTarget) {
    const internal = dragged.current;
    if (!internal || target.clipId === internal.id) return;
    const name =
      project.clips.find((c) => c.id === internal.id)?.name ?? "clip";
    const count = internal.shots.size;
    edit(
      "Move clip",
      count > 1
        ? `Moved ${count} selected shots`
        : target.kind === "version"
          ? `Swapped ${name} with another clip`
          : `Moved ${name}`,
      (p) => {
        moveClip(p, internal.id, target, author, internal.ids);
        setDropScale({ clips: p.clips, span: scaleSpan });
      },
      false,
      internal.id,
    );
  }
  function drop(e: DragEvent, l: Layer, newLayer = false) {
    e.preventDefault();
    e.stopPropagation();
    const target = targetAtPointer(e, l.id, newLayer);
    if (l.locked && !newLayer) notify(`Unlock ${l.name} to drop here.`);
    else if (dragged.current) commitMove(target);
    else if (e.dataTransfer.files.length)
      onImport(Array.from(e.dataTransfer.files), target);
    finishDrag();
  }
  function pointerDestination(e: PointerEvent) {
    const row = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-layer], [data-layer-above]");
    const layer = project.layers.find(
      (l) => l.id === (row?.dataset.layer ?? row?.dataset.layerAbove),
    );
    const newLayer = !!row?.dataset.layerAbove;
    return layer && (newLayer || !layer.locked)
      ? targetAtPointer(e, layer.id, newLayer)
      : null;
  }
  function moveWithShift(e: PointerEvent<HTMLButtonElement>, c: Clip) {
    const origin = shiftDrag.current;
    if (origin?.pointer !== e.pointerId) return;
    if (!dragged.current) {
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < 5) return;
      suppressClipClick.current = true;
      beginClipDrag(
        c,
        { shiftKey: true, ctrlKey: e.ctrlKey, metaKey: e.metaKey },
        origin.x,
      );
      return;
    }
    const target = pointerDestination(e);
    if (target) {
      setDragTarget(target);
      scrollDrag(e);
    } else clearDragTarget();
  }
  function startMarquee(e: PointerEvent<HTMLElement>) {
    if (
      e.button !== 0 ||
      !e.isPrimary ||
      !(e.target instanceof Element) ||
      e.target.closest(
        "button,input,select,textarea,.sft-head,.sft-layer,.sft-insert-gutter,.sft-pin-list",
      )
    )
      return;
    const pos = point(e.clientX, e.clientY);
    const row = e.target.closest<HTMLElement>(
      "[data-layer], [data-layer-above]",
    );
    selection.current = {
      pointer: e.pointerId,
      ...pos,
      ids: e.ctrlKey || e.metaKey || e.shiftKey ? selected : [],
      moved: false,
      layer: row?.dataset.layer ?? row?.dataset.layerAbove ?? activeLayer,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveMarquee(e: PointerEvent) {
    const origin = selection.current;
    if (!origin || origin.pointer !== e.pointerId || !sheet.current) return;
    const pos = point(e.clientX, e.clientY);
    if (
      !origin.moved &&
      Math.abs(pos.x - origin.x) + Math.abs(pos.y - origin.y) < 5
    )
      return;
    origin.moved = true;
    const r = {
      x: Math.min(origin.x, pos.x),
      y: Math.min(origin.y, pos.y),
      w: Math.abs(origin.x - pos.x),
      h: Math.abs(origin.y - pos.y),
    };
    const ids = [...origin.ids],
      base = sheet.current.getBoundingClientRect(),
      ratio = base.width / sheet.current.offsetWidth;
    for (const el of sheet.current.querySelectorAll<HTMLElement>(
      "[data-clip-id]",
    )) {
      const b = el.getBoundingClientRect(),
        x = b.left - base.left,
        y = b.top - base.top;
      if (
        x <= (r.x + r.w) * ratio &&
        x + b.width >= r.x * ratio &&
        y <= (r.y + r.h) * ratio &&
        y + b.height >= r.y * ratio &&
        el.dataset.clipId
      )
        ids.push(el.dataset.clipId);
    }
    setRect(r);
    select([...new Set(ids)]);
  }
  function finishMarquee(e: PointerEvent) {
    const origin = selection.current;
    if (!origin || origin.pointer !== e.pointerId) return;
    if (!origin.moved) {
      chooseLayer(origin.layer);
      select(origin.ids);
      seek(Math.min(duration, timeAt(e.clientX)));
    }
    selection.current = null;
    setRect(null);
  }
  function seekOverview(t: number) {
    seek(t);
    if (board.current && scrollMax)
      board.current.scrollLeft = Math.max(0, t * scale - usableWidth / 2);
  }
  function openPin(f: Feedback) {
    const c = project.clips.find((c) => c.id === f.clipId);
    if (c) {
      select([c.id]);
      seek(frame(c.start + f.sourceTime - c.offset));
    }
    onPin(f.id);
    setPinMenu("");
  }
  function renderLayer(l: Layer) {
    const items = layoutClips.filter((c) => c.layerId === l.id);
    const base = l.id === "parent";
    const target = dragTarget?.layerId === l.id ? dragTarget : null;
    const groups = pinGroups(items, project.feedback, scale);
    // Native dragend must still reach the original element after a cross-layer hover.
    if (sourceClip?.layerId === l.id && previewClip?.layerId !== l.id)
      items.push(sourceClip);
    const targetClip = items.find((c) => target?.clipId === c.id);
    const dragText =
      target?.kind === "version"
        ? dragged.current
          ? "Swap"
          : `v${(targetClip?.versions.length ?? 0) + 1}`
        : target?.kind === "insert"
          ? "Insert"
          : "";
    return (
      <Fragment key={l.id}>
        <section
          aria-label={`New layer drop area above ${l.name}`}
          data-layer-above={l.id}
          className={`sft-new-row ${target?.kind === "new-layer" ? "sft-new-active" : ""}`}
          onDragEnter={(e) => dragOver(e, l, true)}
          onDragOver={(e) => dragOver(e, l, true)}
          onDrop={(e) => drop(e, l, true)}
        >
          <span className="sft-insert-gutter" />
          <span className="sft-new-preview">
            <button
              type="button"
              aria-label={`Import videos into a new layer above ${l.name}`}
              onClick={() =>
                pick({ kind: "new-layer", layerId: l.id, time: 0 })
              }
            >
              <Plus size={10} />
              New layer
            </button>
          </span>
        </section>
        <div
          className={`sft-row ${base ? "sft-base" : ""} ${!l.visible ? "sft-hidden" : ""}`}
        >
          <div
            className={`sft-layer ${activeLayer === l.id ? "sft-layer-active" : ""}`}
          >
            <InlineName
              id={`${uid}-name-${l.id}`}
              className="sft-layer-name"
              label={`Layer name: ${l.name}`}
              maxLength={80}
              value={l.name}
              readOnly={l.locked}
              onActivate={() => {
                chooseLayer(l.id);
                select([]);
              }}
              onSave={(name) =>
                edit("Layer", `Renamed ${l.name} to ${name}`, (p) => {
                  const layer = p.layers.find((item) => item.id === l.id);
                  if (layer && !layer.locked) layer.name = name;
                })
              }
            />
            <div className="sft-layer-tools">
              <button
                type="button"
                className="sft-mini"
                aria-label={`${l.locked ? "Unlock" : "Lock"} ${l.name}`}
                title={l.locked ? "Unlock layer" : "Lock layer"}
                onClick={() => toggleLayer(l, "locked")}
              >
                {l.locked ? (
                  <LockKeyhole size={12} />
                ) : (
                  <DesignIcon name="imgFiRrUnlock" />
                )}
              </button>
              <button
                type="button"
                className="sft-mini"
                title={l.visible ? "Hide layer" : "Show layer"}
                aria-label={`${l.visible ? "Hide" : "Show"} ${l.name}`}
                onClick={() => toggleLayer(l, "visible")}
              >
                {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button
                type="button"
                className="sft-mini"
                aria-label={`Options for ${l.name}`}
                title="Layer options"
                popoverTarget={`${uid}-layer-menu`}
                onClick={(e) =>
                  setLayerMenu({ id: l.id, trigger: e.currentTarget })
                }
              >
                <DesignIcon name="imgUnion5" />
              </button>
            </div>
          </div>
          <section
            className="sft-lane"
            aria-label={`${l.name} timeline clips`}
            data-layer={l.id}
            onDragEnter={(e) => dragOver(e, l)}
            onDragOver={(e) => dragOver(e, l)}
            onDrop={(e) => drop(e, l)}
          >
            {!base &&
              layoutColumns.map((p) => (
                <div
                  key={p.id}
                  className={`sft-cell ${target?.kind === "cell" && target.parentId === p.id ? "sft-cell-target" : ""}`}
                  style={{ left: p.start * scale, width: p.length * scale }}
                />
              ))}
            {base && !items.length && (
              <button
                type="button"
                className={`sft-empty ${target?.kind === "cell" ? "sft-empty-target" : ""}`}
                onClick={() => pick({ kind: "cell", layerId: l.id, time: 0 })}
                disabled={l.locked}
              >
                <Upload size={19} />
                <span>Drop videos here</span>
                <small>or browse files</small>
              </button>
            )}
            {items.map((c) => {
              const origin = c === sourceClip;
              const preview = c === previewClip;
              const movingPreview =
                preview ||
                (!!dropPreview &&
                  groupDrag &&
                  gesture.shots.has(c.parentId ?? c.id) &&
                  !origin);
              const v = currentVersion(c),
                pos = c.versions.findIndex((v) => v.id === c.active) + 1;
              const uploader = v?.author?.trim() || "Unknown uploader";
              const label = `${l.name}, ${c.name}, version ${pos}, starts at ${timecode(c.start)}${base ? "" : `, uploaded by ${uploader}`}`;
              const cellStyle = {
                left: c.start * scale,
                width: Math.max(2, c.length * scale - 2),
                borderBottomColor: base
                  ? undefined
                  : (uploaderColors[uploader] ?? reviewAuthorColor(uploader)),
              };
              const onTarget =
                target?.kind === "version" &&
                (dragId ? swapPreview && preview : target.clipId === c.id);
              return (
                <Fragment key={c.id}>
                  {selectedSlip?.id === c.id && v ? (
                    <SlipClip
                      key={`${c.id}:${v.id}:${c.length}`}
                      clip={c}
                      version={v}
                      scale={scale}
                      gutter={gutter}
                      dock={slipDock}
                      cellStyle={cellStyle}
                      label={label}
                      onModifiedClick={(e) => selectClip(c, e)}
                      onPreview={onSlipPreview}
                      onClose={() => setSlipClip("")}
                      onCommit={(seconds) =>
                        edit(
                          "Slip",
                          `Adjusted the source interval for ${c.name}`,
                          (p) => slip(p, c.id, seconds, author),
                          false,
                          c.id,
                        )
                      }
                    />
                  ) : (
                    <button
                      type="button"
                      data-clip-id={
                        preview && sourceClip?.layerId !== l.id
                          ? undefined
                          : c.id
                      }
                      data-insert-preview={
                        (!swapPreview && movingPreview) || undefined
                      }
                      data-swap-preview={
                        (swapPreview &&
                          !origin &&
                          (movingPreview || dragTarget?.clipId === c.id)) ||
                        undefined
                      }
                      data-drag-origin={origin || undefined}
                      data-hidden={c.hidden || undefined}
                      className={`sft-clip ${selected.includes(c.id) ? "sft-selected" : ""} ${onTarget ? "sft-drop-clip" : ""}`}
                      aria-label={label}
                      aria-pressed={selected.includes(c.id)}
                      style={cellStyle}
                      title={`${c.name} · v${pos} · ${timecode(c.length)}${base ? "" : ` · Uploaded by ${uploader}`}`}
                      onClick={(e) => {
                        if (e.detail && suppressClipClick.current) return;
                        selectClip(c, e);
                      }}
                      draggable={!l.locked}
                      onPointerDown={(e) => {
                        suppressClipClick.current = false;
                        if (
                          !e.shiftKey ||
                          l.locked ||
                          e.button !== 0 ||
                          !e.isPrimary
                        )
                          return;
                        // Chromium reserves Shift-drag for text selection and skips native dragstart.
                        shiftDrag.current = {
                          pointer: e.pointerId,
                          x: e.clientX,
                          y: e.clientY,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => moveWithShift(e, c)}
                      onPointerUp={(e) => {
                        if (shiftDrag.current?.pointer !== e.pointerId) return;
                        if (dragged.current) {
                          const target = pointerDestination(e);
                          if (target) commitMove(target);
                        }
                        finishDrag();
                      }}
                      onLostPointerCapture={(e) => {
                        if (shiftDrag.current?.pointer === e.pointerId)
                          finishDrag();
                      }}
                      onDragStart={(e) => {
                        if (shiftDrag.current) {
                          e.preventDefault();
                          return;
                        }
                        beginClipDrag(c, e, e.clientX);
                        e.dataTransfer.setData(clipDragType, c.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={finishDrag}
                    >
                      {v?.thumbnail ? (
                        <span
                          className="sft-thumb"
                          style={{ backgroundImage: `url("${v.thumbnail}")` }}
                        />
                      ) : (
                        <span className="sft-no-thumb">
                          <Film size={base ? 22 : 14} />
                        </span>
                      )}
                      <span className="sft-clip-caption">
                        <span className="sft-clip-name">{c.name}</span>
                        <span className="sft-version">v{pos}</span>
                        {c.parentId && <Link2 size={10} />}
                      </span>
                      {onTarget && (
                        <span className="sft-drop-tag">{dragText}</span>
                      )}
                    </button>
                  )}
                  {!base && !origin && (
                    <button
                      type="button"
                      className="sft-clip-eye"
                      data-narrow={cellStyle.width < 58 || undefined}
                      aria-label={`${c.hidden ? "Show" : "Hide"} clip ${c.name} on ${l.name}`}
                      title={c.hidden ? "Show clip" : "Hide clip"}
                      style={{
                        left:
                          cellStyle.left + Math.max(0, cellStyle.width - 35),
                      }}
                      onClick={() => onToggleClipVisibility(c)}
                    >
                      {c.hidden ? <EyeOff size={21} /> : <Eye size={21} />}
                    </button>
                  )}
                </Fragment>
              );
            })}
            {fileSlot?.layerId === l.id && (
              <output
                className="sft-file-slot"
                style={{
                  left: fileSlot.start * scale,
                  width: fileSlot.length * scale,
                }}
                aria-label="Estimated file insertion space"
              >
                <Film size={16} />
                <span>
                  {fileCount > 1 ? `${fileCount} videos` : "Insert video"}
                </span>
              </output>
            )}
            {groups.map(({ x, pins }) => {
              const f = pins[0],
                col = feedbackPinColor(f);
              const tip =
                pins.length > 1
                  ? `${pins.length} feedback items`
                  : `${f.author} · ${timecode(f.sourceTime)} · ${f.text || f.kind}`;
              return (
                <Fragment key={f.id}>
                  <button
                    className="sft-pin"
                    type="button"
                    style={{ left: x, color: col }}
                    aria-label={tip}
                    title={tip}
                    onClick={() =>
                      pins.length === 1
                        ? openPin(f)
                        : setPinMenu(f.id === pinMenu ? "" : f.id)
                    }
                  >
                    <span className="sft-pin-symbol" />
                    {pins.length > 1 && <b>{pins.length}</b>}
                  </button>
                  {pinMenu === f.id && pins.length > 1 && (
                    <div
                      className="sft-pin-list"
                      style={{ left: Math.max(0, Math.min(x, width - 165)) }}
                    >
                      {pins.map((pin) => (
                        <button
                          type="button"
                          key={pin.id}
                          onClick={() => openPin(pin)}
                        >
                          {pin.author} · {timecode(pin.sourceTime)}
                          <small>{pin.text || pin.kind}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </Fragment>
              );
            })}
            {target &&
              !fileSlot &&
              ((target.kind === "insert" && (!dragId || dropPreview)) ||
                target.kind === "cell") && (
                <div
                  className="sft-drop-line"
                  style={{ left: target.time * scale }}
                >
                  {target.kind === "insert" && <span>Insert</span>}
                </div>
              )}
          </section>
        </div>
      </Fragment>
    );
  }
  return (
    <section
      ref={timeline}
      className="sft-timeline"
      data-dragging={dragging || undefined}
      data-previewing-drop={dropPreview ? true : undefined}
      aria-label="Timeline editor"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setSlipClip("");
          setPinMenu("");
        }
      }}
    >
      <div className="sft-toolbar">
        <fieldset className="sft-edit-tools" aria-label="Editing tools">
          {mainTools.map(commandButton)}
        </fieldset>
        <fieldset className="sft-transport" aria-label="Playback">
          <DesignIcon name="imgFrame30" />
          <button
            type="button"
            className="sft-icon"
            title="Previous clip"
            aria-label="Previous clip"
            disabled={!duration}
            onClick={() =>
              seek(
                Math.max(
                  0,
                  ...project.clips
                    .filter((c) => c.start < frame(time))
                    .map((c) => c.start),
                ),
              )
            }
          />
          <button
            type="button"
            className="sft-play"
            aria-label={playing ? "Pause timeline" : "Play timeline"}
            title={playing ? "Pause" : "Play"}
            disabled={!duration}
            onClick={play}
          >
            {playing && <Pause size={19} fill="currentColor" />}
          </button>
          <button
            type="button"
            className="sft-icon"
            title="Next clip"
            aria-label="Next clip"
            disabled={!duration}
            onClick={() =>
              seek(
                Math.min(
                  duration,
                  ...project.clips
                    .filter((c) => c.start > frame(time))
                    .map((c) => c.start),
                ),
              )
            }
          />
        </fieldset>
        <div className="sft-view-tools">
          <div className="sft-placement-tools">
            {commandButton("slip")}
            {commandButton("snap")}
            {commandButton("magnet")}
          </div>
          <div className="sft-zoom-tools">
            <button
              className="sft-mini"
              type="button"
              disabled={zoom <= 0}
              aria-label="Decrease timeline zoom"
              title="Zoom out"
              onClick={() => setZoom(Math.max(0, zoom - 1))}
            >
              <DesignIcon name="imgUnion2" />
            </button>
            <input
              type="range"
              aria-label="Timeline zoom"
              min="0"
              max={zoomSteps.length - 1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <button
              className="sft-mini"
              type="button"
              disabled={zoom >= zoomSteps.length - 1}
              aria-label="Increase timeline zoom"
              title="Zoom in"
              onClick={() => setZoom(Math.min(zoomSteps.length - 1, zoom + 1))}
            >
              <DesignIcon name="imgUnion3" />
            </button>
          </div>
        </div>
      </div>
      {selectedSlip && <div className="sft-slip-dock" ref={setSlipDock} />}
      <Overview
        clips={project.clips}
        layers={project.layers}
        time={time}
        uploaderColors={uploaderColors}
        changeUploaderColor={(group, color) =>
          setUploaderColors((previous) => ({ ...previous, [group]: color }))
        }
        onSeek={seekOverview}
      />
      <div className="sft-scroll-strip">
        <input
          type="range"
          aria-label="Scroll timeline horizontally"
          min={0}
          max={Math.max(1, scrollMax)}
          value={Math.min(scrollMax, scroll)}
          disabled={!scrollMax}
          onChange={(e) => {
            if (board.current)
              board.current.scrollLeft = Number(e.target.value);
          }}
        />
      </div>
      <section
        className="sft-board"
        aria-label="Timeline tracks"
        ref={board}
        onScroll={(e) => setScroll(e.currentTarget.scrollLeft)}
        onDragEnter={(e) => {
          if (
            e.target instanceof Element &&
            !e.target.closest(".sft-lane, .sft-new-row")
          )
            clearDragTarget();
        }}
        onDragOver={clearDragTarget}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            clearDragTarget();
            if (!dragged.current) setDragging(false);
          }
        }}
      >
        <div
          className="sft-sheet"
          ref={sheet}
          onPointerDown={startMarquee}
          onPointerMove={moveMarquee}
          onPointerUp={finishMarquee}
          onLostPointerCapture={(e) => {
            if (selection.current?.pointer === e.pointerId) {
              selection.current = null;
              setRect(null);
            }
          }}
          style={{
            width: gutter + width,
            ...styleVar("--sft-gutter", `${gutter}px`),
            ...styleVar("--sft-label-width", `${labelWidth}px`),
          }}
        >
          <div className="sft-head">
            <div className="sft-heading">
              <span>Layers</span>
              <button
                type="button"
                className="sft-mini"
                title="Add layer"
                aria-label="Add layer"
                onClick={addLayer}
              >
                <Plus size={13} />
              </button>
            </div>
            <div
              className="sft-ruler"
              style={styleVar("--sft-tick", `${(tick * scale) / 4}px`)}
              role="slider"
              aria-label="Timeline playhead"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Math.min(duration, time)}
              aria-valuetext={timecode(time)}
              onKeyDown={keyboardSeek}
              onPointerDown={(e) => {
                scrub.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                seek(Math.min(duration, timeAt(e.clientX)));
              }}
              onPointerMove={(e) => {
                if (scrub.current) seek(Math.min(duration, timeAt(e.clientX)));
              }}
              onPointerUp={() => {
                scrub.current = false;
              }}
              onPointerCancel={() => {
                scrub.current = false;
              }}
            >
              {ticks.map((t) => (
                <span key={t} style={{ left: t * scale }}>
                  {tick < 1
                    ? timecode(t)
                    : `${Math.floor(t / 60)}:${String(Math.floor(t) % 60).padStart(2, "0")}`}
                </span>
              ))}
              <i
                className="sft-head-marker"
                style={{ left: Math.min(width - 1, time * scale) }}
              />
            </div>
          </div>
          {layers.map(renderLayer)}
          <div
            className="sft-playhead"
            style={{
              left: Math.min(gutter + width - 1, gutter + time * scale),
            }}
          />
          {rect && (
            <div
              className="sft-marquee"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
              }}
            />
          )}
        </div>
      </section>
      <LayerMenu
        id={`${uid}-layer-menu`}
        layer={menuLayer}
        trigger={layerMenu?.trigger}
        clipCount={
          menuLayer
            ? project.clips.filter((c) => c.layerId === menuLayer.id).length
            : 0
        }
        onRename={(layer) => {
          const field = document.getElementById(`${uid}-name-${layer.id}`);
          if (field instanceof HTMLInputElement) {
            field.focus();
            field.select();
          }
        }}
        onDelete={(layer) => {
          edit(
            "Delete layer",
            `Deleted ${layer.name}`,
            (p) => {
              const current = p.layers.find((l) => l.id === layer.id);
              if (!current || current.id === "parent" || current.locked)
                throw Error("This layer cannot be deleted.");
              const ids = p.clips
                .filter((c) => c.layerId === layer.id)
                .map((c) => c.id);
              if (ids.length) deleteClips(p, ids);
              p.layers = p.layers.filter((l) => l.id !== layer.id);
            },
            true,
          );
        }}
      />
    </section>
  );
}
