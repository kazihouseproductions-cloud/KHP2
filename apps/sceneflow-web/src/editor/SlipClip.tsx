import { Check, X } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { openVideo, releaseVideo, seekVideo } from "./mediaDom";
import { mediaUrl } from "./storage";
import { fps, maxSlipFrames } from "./timelineEdits";
import { type Clip, timecode, type Version } from "./types";

export type SlipPreview = { id: string; version: string; offset: number };

function useFilmstrip(version: Version) {
  const [image, setImage] = useState("");
  const { mediaId, duration } = version;
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function sample() {
      const url = await mediaUrl(mediaId);
      signal.throwIfAborted();
      const video = await openVideo(url, signal);
      try {
        const count = Math.min(24, Math.max(4, Math.ceil(duration * 2)));
        const canvas = document.createElement("canvas");
        const tileWidth = 96;
        canvas.width = count * tileWidth;
        canvas.height = Math.max(
          1,
          Math.min(
            160,
            Math.round((tileWidth * video.videoHeight) / video.videoWidth),
          ),
        );
        const context = canvas.getContext("2d");
        if (!context) return;
        if (!Number.isFinite(video.duration))
          await seekVideo(video, 1e8, signal);
        for (let i = 0; i < count; i++) {
          await seekVideo(
            video,
            ((i + 0.5) * Math.min(video.duration, duration)) / count,
            signal,
          );
          signal.throwIfAborted();
          context.drawImage(video, i * tileWidth, 0, tileWidth, canvas.height);
        }
        setImage(canvas.toDataURL("image/jpeg", 0.75));
      } finally {
        releaseVideo(video);
      }
    }
    // The imported thumbnail remains available while sampling or if decoding fails.
    void sample().catch(() => {});
    return () => controller.abort();
  }, [mediaId, duration]);
  return image;
}

export default function SlipClip({
  clip,
  version,
  scale,
  gutter,
  dock,
  cellStyle,
  label,
  onCommit,
  onClose,
  onPreview,
  onModifiedClick,
}: {
  clip: Clip;
  version: Version;
  scale: number;
  gutter: number;
  dock: HTMLDivElement | null;
  cellStyle: CSSProperties;
  label: string;
  onCommit: (seconds: number) => void;
  onClose: () => void;
  onPreview: (preview: SlipPreview | null) => void;
  onModifiedClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    initial: number;
    pixelsPerSecond: number;
  } | null>(null);
  const committed = Math.round(clip.offset * fps);
  const max = maxSlipFrames(clip);
  const start = Math.min(max, Math.max(0, draft ?? committed));
  const offset = start / fps;
  const end = offset + clip.length;
  const film = useFilmstrip(version);
  const rangeId = useId();
  const filmStyle: CSSProperties = {
    backgroundImage:
      film || version.thumbnail
        ? `url("${film || version.thumbnail}")`
        : undefined,
    backgroundSize: film ? `${version.duration * scale}px 100%` : "auto 100%",
    backgroundPositionX: -offset * scale,
  };
  useEffect(() => {
    onPreview(
      draft === null ? null : { id: clip.id, version: version.id, offset },
    );
    return () => onPreview(null);
  }, [clip.id, version.id, offset, draft, onPreview]);
  function dragFrame(e: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== e.pointerId) return null;
    const delta = Math.round(
      ((e.clientX - drag.x) * fps) / drag.pixelsPerSecond,
    );
    return Math.max(0, Math.min(max, drag.initial - delta));
  }
  function commit(value: number) {
    if (value !== committed) onCommit(value / fps);
    setDraft(null);
  }
  function cancelDrag(e: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current;
    if (drag?.id !== e.pointerId) return;
    gesture.current = null;
    setDraft(drag.initial === committed ? null : drag.initial);
  }
  return (
    <>
      <div
        className="sft-slip-guides"
        aria-hidden="true"
        style={{ left: -gutter }}
      >
        {offset > 0 && (
          <span
            className="sft-slip-before"
            style={{
              left: gutter + (clip.start - offset) * scale,
              width: offset * scale,
            }}
          >
            <i style={{ ...filmStyle, backgroundPositionX: 0 }} />
          </span>
        )}
        {version.duration > end && (
          <span
            className="sft-slip-after"
            style={{
              left: gutter + (clip.start + clip.length) * scale,
              width: (version.duration - end) * scale,
            }}
          >
            <i style={{ ...filmStyle, backgroundPositionX: -end * scale }} />
          </span>
        )}
      </div>
      <button
        type="button"
        className="sft-clip sft-selected sft-slip-clip"
        data-clip-id={clip.id}
        data-hidden={clip.hidden || undefined}
        aria-label={label}
        aria-pressed="true"
        title="Drag the footage left or right within this cell"
        style={cellStyle}
        draggable={false}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) onModifiedClick(e);
        }}
        onPointerDown={(e) => {
          if (
            e.button !== 0 ||
            !e.isPrimary ||
            e.ctrlKey ||
            e.metaKey ||
            e.shiftKey ||
            gesture.current
          )
            return;
          const el = e.currentTarget;
          gesture.current = {
            id: e.pointerId,
            x: e.clientX,
            initial: start,
            pixelsPerSecond:
              (scale * el.getBoundingClientRect().width) / el.offsetWidth,
          };
          el.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const next = dragFrame(e);
          if (next !== null) setDraft(next);
        }}
        onPointerUp={(e) => {
          const next = dragFrame(e);
          if (next === null) return;
          gesture.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
          commit(next);
        }}
        onLostPointerCapture={cancelDrag}
        onPointerCancel={cancelDrag}
      >
        <span className="sft-slip-film" style={filmStyle} />
        <span className="sft-clip-caption">
          <span className="sft-clip-name">{clip.name}</span>
          <span className="sft-version">
            v{clip.versions.indexOf(version) + 1}
          </span>
        </span>
      </button>
      {dock &&
        createPortal(
          <form
            className="sft-slip-controls"
            onSubmit={(e) => {
              e.preventDefault();
              commit(start);
              onClose();
            }}
          >
            <strong>Slip · {clip.name}</strong>
            <label htmlFor={rangeId}>
              Source start <b>{timecode(offset)}</b>
            </label>
            <input
              id={rangeId}
              aria-label="Slip source start"
              type="range"
              min={0}
              max={max}
              value={start}
              onChange={(e) => setDraft(Number(e.target.value))}
            />
            <span>
              Source end <b>{timecode(end)}</b>
            </span>
            <button className="sft-primary" type="submit">
              <Check size={13} /> Apply slip
            </button>
            <button
              className="sft-mini"
              type="button"
              aria-label="Close slip tool"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </form>,
          dock,
        )}
    </>
  );
}
