import {
  Check,
  Clapperboard,
  Layers3,
  Pipette,
  UserRound,
  X,
} from "lucide-react";
import { type PointerEvent, useId, useMemo, useRef, useState } from "react";
import { DesignIcon } from "./DesignIcon";
import { reviewAuthorColor } from "./reviewCommon";
import { sceneColor, sceneLabel } from "./sceneColors";
import { fps, shotColumns } from "./timelineEdits";
import {
  type Clip,
  currentVersion,
  type Layer,
  type Stage,
  stages,
  timecode,
} from "./types";

const modes = ["Scene", "Stage", "Uploaded by"] as const;
type Mode = (typeof modes)[number];
const modeIcons = {
  Scene: Clapperboard,
  Stage: Layers3,
  "Uploaded by": UserRound,
};
const stageColors: Record<Stage, string> = {
  "Not Set": "#b5c0c7",
  Block: "#d34ec6",
  Animatics: "#0957ff",
  Polished: "#ada0ff",
  Complete: "#65bc99",
};

function category(clip: Clip, mode: Mode) {
  if (mode === "Scene") return sceneLabel(clip.name);
  const version = currentVersion(clip);
  return mode === "Stage"
    ? (version?.stage ?? "Not Set")
    : version?.author?.trim() || "Unknown uploader";
}

type TimeRange = { first: number; last: number; start: number; end: number };

// Keep all storyboard columns when inspecting a child. Only time outside both
// the storyboard and the displayed layer can be folded out of the overview.
function overviewRanges(clips: Clip[], layerId: string | undefined) {
  const ranges: TimeRange[] = [];
  const ordered = clips
    .filter((clip) => clip.layerId === "parent" || clip.layerId === layerId)
    .sort((a, b) => a.start - b.start);
  for (const clip of ordered) {
    const first = Math.round(clip.start * fps);
    const last = first + Math.max(1, Math.round(clip.length * fps));
    const previous = ranges.at(-1);
    if (previous && first <= previous.last) {
      previous.last = Math.max(previous.last, last);
      previous.end = previous.start + previous.last - previous.first;
    } else {
      const start = previous?.end ?? 0;
      ranges.push({ first, last, start, end: start + last - first });
    }
  }
  return ranges;
}
function overviewPosition(ranges: TimeRange[], time: number) {
  const tick = Math.round(time * fps);
  const range = ranges.find((r) => tick < r.last);
  return range
    ? range.start + Math.max(0, tick - range.first)
    : (ranges.at(-1)?.end ?? 0);
}

export default function Overview({
  clips,
  layers,
  time,
  uploaderColors,
  changeUploaderColor,
  onSeek,
}: {
  clips: Clip[];
  layers: Layer[];
  time: number;
  uploaderColors: Record<string, string>;
  changeUploaderColor: (uploader: string, color: string) => void;
  onSeek: (time: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("Stage");
  const [layerId, setLayerId] = useState("parent");
  const layer = layers.find((item) => item.id === layerId) ?? layers[0];
  const [custom, setCustom] = useState<Record<string, string>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const displayClips = useMemo(
    () => [
      ...shotColumns(clips),
      ...clips.filter((c) => c.layerId !== "parent"),
    ],
    [clips],
  );
  const ranges = useMemo(
    () => overviewRanges(displayClips, layer?.id),
    [displayClips, layer?.id],
  );
  const blocks = useMemo(
    () =>
      displayClips
        .filter((clip) => clip.layerId === layer?.id)
        .sort((a, b) => a.start - b.start)
        .map((clip) => ({
          clip,
          group: category(clip, mode),
          start: overviewPosition(ranges, clip.start),
        })),
    [displayClips, layer?.id, ranges, mode],
  );
  const divisions = useMemo(
    () =>
      layer?.id === "parent"
        ? []
        : displayClips
            .filter((clip) => clip.layerId === "parent")
            .map((clip) => ({
              clip,
              start: overviewPosition(ranges, clip.start),
            })),
    [displayClips, ranges, layer?.id],
  );
  const groups = useMemo(
    () =>
      mode === "Stage"
        ? stages
        : [...new Set(blocks.map((block) => block.group))].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true }),
          ),
    [mode, blocks],
  );
  function color(group: string) {
    if (mode === "Uploaded by")
      return uploaderColors[group] ?? reviewAuthorColor(group);
    return (
      custom[`${mode}:${group}`] ??
      (mode === "Scene" ? sceneColor(group, {}) : stageColors[group as Stage])
    );
  }
  function changeColor(group: string, value: string) {
    if (mode === "Uploaded by") changeUploaderColor(group, value);
    else
      setCustom((previous) => ({ ...previous, [`${mode}:${group}`]: value }));
  }
  const last = ranges.at(-1);
  const total = last?.end ?? 0;
  const cursor = overviewPosition(ranges, time);
  function seekFrame(position: number) {
    const at = Math.min(total, Math.max(0, position));
    const range = ranges.find((segment) => at < segment.end) ?? last;
    if (range) onSeek((range.first + Math.floor(at) - range.start) / fps);
  }
  function scrub(e: PointerEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    if (bounds.width)
      seekFrame((total * (e.clientX - bounds.left)) / bounds.width);
  }
  function renderBlocks(preview = false) {
    const geometry = (start: number, clip: Clip) => ({
      left: `${(100 * start) / total}%`,
      width: `${(100 * Math.max(1, Math.round(clip.length * fps))) / total}%`,
    });
    return (
      <>
        {blocks.map(({ clip, group, start }) => (
          <span
            className="sft-overview-block"
            key={clip.id}
            data-overview-clip={preview ? undefined : clip.id}
            title={`${clip.name} · ${layer.name} · ${group}`}
            style={{
              ...geometry(start, clip),
              backgroundColor: color(group),
            }}
          />
        ))}
        {divisions.map(({ clip, start }) => (
          <i
            aria-hidden="true"
            className="sft-parent-division"
            key={clip.id}
            data-parent-division={preview ? undefined : clip.id}
            style={geometry(start, clip)}
          />
        ))}
      </>
    );
  }
  return (
    <div className="sft-overview">
      <label className="sft-overview-layer">
        <select
          aria-label="Overview layer"
          value={layer?.id ?? ""}
          onChange={(e) => setLayerId(e.target.value)}
        >
          {layers
            .slice()
            .reverse()
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <DesignIcon name="imgFiRrAngleSmallDown" />
      </label>
      <div
        className="sft-overview-bar"
        role="slider"
        tabIndex={total ? 0 : -1}
        aria-label="Timeline overview"
        aria-disabled={!total}
        aria-valuemin={0}
        aria-valuemax={total / fps}
        aria-valuenow={cursor / fps}
        aria-valuetext={timecode(time)}
        onPointerDown={(e) => {
          if (total && e.button === 0) {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrub(e);
          }
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? fps : 1;
          const next = {
            Home: 0,
            End: total,
            ArrowRight: cursor + step,
            ArrowLeft: cursor - step,
          }[e.key];
          if (next !== undefined && total) {
            e.preventDefault();
            e.stopPropagation();
            seekFrame(next);
          }
        }}
      >
        <div className="sft-overview-row">
          {renderBlocks()}
          {total > 0 && (
            <i
              className="sft-overview-playhead"
              style={{
                left: `min(${(cursor / total) * 100}%, calc(100% - 2px))`,
              }}
            />
          )}
        </div>
      </div>
      <button
        className="sft-mini"
        type="button"
        aria-label="Overview palette"
        aria-haspopup="dialog"
        title="Overview palette"
        onClick={() => dialog.current?.showModal()}
      >
        <DesignIcon name="imgFiRrPalette" />
      </button>
      <dialog
        ref={dialog}
        className="sf-dialog sft-palette"
        aria-labelledby={titleId}
      >
        <div className="sf-dialog-title">
          <h2 id={titleId}>Overview palette</h2>
          <button
            type="button"
            aria-label="Close overview palette"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <fieldset className="sft-color-modes">
          <legend>Overview by</legend>
          {modes.map((option) => {
            const Icon = modeIcons[option];
            return (
              <label key={option} data-selected={mode === option}>
                <input
                  type="radio"
                  name={titleId}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                />
                <Icon size={21} aria-hidden="true" />
                <span>{option}</span>
                {mode === option && (
                  <Check
                    className="sft-mode-check"
                    size={14}
                    aria-hidden="true"
                  />
                )}
              </label>
            );
          })}
        </fieldset>
        <section className="sft-palette-preview" aria-label="Layer preview">
          <div>
            <strong>{layer?.name}</strong>
            <span>
              {blocks.length} {blocks.length === 1 ? "clip" : "clips"}
            </span>
          </div>
          <div className="sft-overview-row" aria-hidden="true">
            {renderBlocks(true)}
          </div>
        </section>
        <h3 className="sft-color-heading">Color key</h3>
        <div className="sft-color-list">
          {groups.map((group) => (
            <label key={group}>
              <span
                className="sft-color-swatch"
                style={{ backgroundColor: color(group) }}
              >
                <input
                  type="color"
                  aria-label={`${group} color`}
                  value={color(group)}
                  onChange={(e) => changeColor(group, e.target.value)}
                />
              </span>
              <span>{group}</span>
              <Pipette size={13} aria-hidden="true" />
            </label>
          ))}
          {!groups.length && <p>Add clips to this layer to see its colors.</p>}
        </div>
        <button
          type="button"
          className="sf-primary"
          onClick={() => dialog.current?.close()}
        >
          Done
        </button>
      </dialog>
    </div>
  );
}
