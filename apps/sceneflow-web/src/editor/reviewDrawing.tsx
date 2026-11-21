import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { visibleAt } from "./mediaPlan";
import { onFeedbackFrame, sourceAt } from "./reviewCommon";
import { mediaUrl, saveMedia } from "./storage";
import type { Clip, Edit, Feedback, Project } from "./types";

type Point = [number, number];
type Stroke = { id: string; points: Point[] };
type Drawing = Feedback & { strokes?: Stroke[]; frameImage?: string };
type Gesture = {
  pointer: number;
  first: Point;
  points: Point[];
  drawing?: Drawing;
  strokeId: string;
};
const ink = "#ff5751";
const widthRatio = 0.005;

function frameCapture(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot capture this frame");
  context.drawImage(video, 0, 0);
  return canvas;
}
function png(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Frame encoding failed")),
      "image/png",
    ),
  );
}
async function getImage(id: string) {
  const src = await mediaUrl(id);
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}
function svgPoints(points: Point[], width: number, height: number) {
  return points.map(([x, y]) => `${x * width},${y * height}`).join(" ");
}
function composite(base: HTMLImageElement, strokes: Stroke[]) {
  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot paint feedback");
  context.drawImage(base, 0, 0);
  context.strokeStyle = ink;
  context.lineWidth = canvas.width * widthRatio;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const { points } of strokes) {
    context.beginPath();
    points.forEach(([x, y], i) => {
      if (!i) context.moveTo(x * canvas.width, y * canvas.height);
      else context.lineTo(x * canvas.width, y * canvas.height);
    });
    context.stroke();
  }
  return canvas;
}

interface DrawingProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  activeClip?: Clip;
  time: number;
  author: string;
  focused: Feedback | undefined;
  project: Project;
  edit: Edit;
  pause: (at?: number) => void;
  focus: (id: string) => void;
  notify: (value: string) => void;
}

export function DrawingSurface({
  videoRef,
  activeClip,
  time,
  author,
  focused,
  project,
  edit,
  pause,
  focus,
  notify,
}: DrawingProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const pending = useRef<Gesture | null>(null);
  const frameCache = useRef(new Map<string, Promise<string>>());
  const [live, setLive] = useState<Point[]>([]);
  const [bounds, setBounds] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const [playing, setPlaying] = useState(false);
  const activeId = activeClip?.active;
  useEffect(() => {
    const host = wrapper.current;
    const video = videoRef.current;
    if (!host || !video || !activeId) return;
    function measure() {
      if (!host || !video) return;
      if (!video.videoWidth || !video.videoHeight) {
        setBounds({ left: 0, top: 0, width: 0, height: 0 });
        return;
      }
      const hostBox = host.getBoundingClientRect(),
        videoBox = video.getBoundingClientRect();
      if (!hostBox.width || !hostBox.height) return;
      const scale = Math.min(
        videoBox.width / video.videoWidth,
        videoBox.height / video.videoHeight,
      );
      const w = video.videoWidth * scale,
        h = video.videoHeight * scale;
      setBounds({
        left:
          (100 * (videoBox.left - hostBox.left + (videoBox.width - w) / 2)) /
          hostBox.width,
        top:
          (100 * (videoBox.top - hostBox.top + (videoBox.height - h) / 2)) /
          hostBox.height,
        width: (100 * w) / hostBox.width,
        height: (100 * h) / hostBox.height,
      });
    }
    const playback = () => setPlaying(!video.paused);
    measure();
    playback();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(video);
    const styleObserver = new MutationObserver(measure);
    styleObserver.observe(video, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    video.addEventListener("loadedmetadata", measure);
    video.addEventListener("resize", measure);
    video.addEventListener("play", playback);
    video.addEventListener("pause", playback);
    return () => {
      observer.disconnect();
      styleObserver.disconnect();
      video.removeEventListener("loadedmetadata", measure);
      video.removeEventListener("resize", measure);
      video.removeEventListener("play", playback);
      video.removeEventListener("pause", playback);
    };
  }, [videoRef, activeId]);
  const matchesFrame = (item: Feedback) =>
    item.kind === "drawing" && onFeedbackFrame(item, activeClip, time);
  const candidate = (
    focused && matchesFrame(focused)
      ? focused
      : project.feedback.findLast(
          (item) => item.author === author && matchesFrame(item),
        )
  ) as Drawing | undefined;
  const drawing = playing ? undefined : candidate;
  const point = (e: ReactPointerEvent<SVGSVGElement>): Point => {
    const box = e.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    ];
  };
  function start(e: ReactPointerEvent<SVGSVGElement>) {
    if (
      !activeClip ||
      !videoRef.current ||
      e.button !== 0 ||
      !e.isPrimary ||
      pending.current
    )
      return;
    const first = point(e);
    pending.current = {
      pointer: e.pointerId,
      first,
      points: [first],
      strokeId: crypto.randomUUID(),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    const gesture = pending.current,
      video = videoRef.current;
    if (!gesture || gesture.pointer !== e.pointerId || !activeClip || !video)
      return;
    const p = point(e);
    if (!gesture.drawing) {
      const box = e.currentTarget.getBoundingClientRect();
      if (
        Math.hypot(
          (p[0] - gesture.first[0]) * box.width,
          (p[1] - gesture.first[1]) * box.height,
        ) < 2
      )
        return;
      const existing =
        video.paused || candidate?.author === author ? candidate : undefined;
      const needsFrame =
        !existing ||
        (!existing.frameImage && !frameCache.current.has(existing.id));
      if (needsFrame && (video.readyState < 2 || video.seeking)) {
        pending.current = null;
        notify("Wait for the frame to load before drawing.");
        return;
      }
      video.pause();
      // Freeze at the displayed media time unless clock drift would cross a timeline cut.
      const mediaTime =
        activeClip.start + video.currentTime - activeClip.offset;
      const visible = visibleAt(project, mediaTime);
      const at =
        !existing &&
        visible?.id === activeClip.id &&
        visible.active === activeClip.active
          ? mediaTime
          : time;
      const capturedAt = existing?.sourceTime ?? sourceAt(activeClip, at);
      pause(at);
      const item: Drawing = existing ?? {
        id: crypto.randomUUID(),
        clipId: activeClip.id,
        versionId: activeClip.active,
        sourceTime: capturedAt,
        author,
        text: "",
        status: "pending",
        kind: "drawing",
        created: Date.now(),
        strokes: [],
      };
      if (needsFrame) {
        let frame: HTMLCanvasElement;
        try {
          frame = frameCapture(video);
        } catch {
          pending.current = null;
          notify("This frame could not be captured.");
          return;
        }
        const base = png(frame).then(saveMedia);
        frameCache.current.set(item.id, base);
        base
          .then((frameImage) => {
            edit(
              "",
              "",
              (project) => {
                const target = project.feedback.find((f) => f.id === item.id) as
                  | Drawing
                  | undefined;
                if (target) target.frameImage = frameImage;
              },
              false,
              item.clipId,
              item.id,
            );
          })
          .catch(() => {
            frameCache.current.delete(item.id);
          });
      }
      if (!existing) {
        edit(
          "Feedback posted",
          `Added a drawing on ${activeClip.name}`,
          (project) => {
            project.feedback.push(item);
          },
          false,
          activeClip.id,
          item.id,
        );
      }
      gesture.drawing = item;
      focus(item.id);
    }
    gesture.points.push(p);
    setLive([...gesture.points]);
  }
  function finish(e: ReactPointerEvent<SVGSVGElement>) {
    const gesture = pending.current;
    if (!gesture || gesture.pointer !== e.pointerId) return;
    pending.current = null;
    setLive([]);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    const item = gesture.drawing;
    if (!item) return;
    const stroke = { id: gesture.strokeId, points: gesture.points };
    let strokes: Stroke[] = [];
    edit(
      "",
      "",
      (project) => {
        const target = project.feedback.find((f) => f.id === item.id) as
          | Drawing
          | undefined;
        if (target) {
          target.strokes ||= [];
          target.strokes.push(stroke);
          strokes = target.strokes;
        }
      },
      false,
      item.clipId,
      item.id,
    );
    const base = item.frameImage
      ? Promise.resolve(item.frameImage)
      : frameCache.current.get(item.id);
    if (!base) {
      notify("The original drawing frame is unavailable.");
      return;
    }
    void (async () => {
      const frameId = await base;
      const canvas = composite(await getImage(frameId), strokes);
      const snapshot = await saveMedia(await png(canvas));
      edit(
        "",
        "",
        (project) => {
          const target = project.feedback.find((f) => f.id === item.id) as
            | Drawing
            | undefined;
          if (target && target.strokes?.at(-1)?.id === stroke.id) {
            target.frameImage = frameId;
            target.image = snapshot;
            frameCache.current.delete(item.id);
          }
        },
        false,
        item.clipId,
        item.id,
      );
    })().catch(() =>
      notify(
        "The drawing could not be saved as an image. Add another stroke to retry.",
      ),
    );
  }
  const w = videoRef.current?.videoWidth || 1,
    h = videoRef.current?.videoHeight || 1;
  return (
    <div ref={wrapper} className="rv-drawing-surface">
      {activeClip && bounds.width > 0 && (
        <svg
          className="rv-drawing-pad"
          aria-label="Draw feedback on this frame"
          role="img"
          viewBox={`0 0 ${w} ${h}`}
          style={{
            left: `${bounds.left}%`,
            top: `${bounds.top}%`,
            width: `${bounds.width}%`,
            height: `${bounds.height}%`,
          }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
        >
          <title>Draw feedback on this frame</title>
          <g
            fill="none"
            stroke={ink}
            strokeWidth={w * widthRatio}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {drawing?.strokes?.map((s) => (
              <polyline key={s.id} points={svgPoints(s.points, w, h)} />
            ))}
            {live.length > 0 && <polyline points={svgPoints(live, w, h)} />}
          </g>
        </svg>
      )}
    </div>
  );
}
