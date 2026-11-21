import { Film, Minimize, Upload, X } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DesignIcon } from "./DesignIcon";
import { mediaUrl } from "./storage";
import { type Clip, currentVersion, timecode } from "./types";

type Props = {
  clip?: Clip;
  time: number;
  playing: boolean;
  empty: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  setHost: (el: HTMLDivElement | null) => void;
  onFiles: (files: File[]) => void;
  pick: () => void;
  review: string;
  closeReview: () => void;
};
export default function Viewer({
  clip,
  time,
  playing,
  empty,
  videoRef,
  setHost,
  onFiles,
  pick,
  review,
  closeReview,
}: Props) {
  const v = clip && currentVersion(clip),
    id = v?.mediaId;
  const [media, setMedia] = useState({ id: "", url: "", error: "" }),
    [failure, setFailure] = useState(""),
    [zoom, setZoom] = useState(1),
    [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null),
    [reload, setReload] = useState(0);
  const [viewportRatio, setViewportRatio] = useState(16 / 9);
  const [decoded, setDecoded] = useState({ id: "", ratio: 16 / 9 });
  const aspect =
    v?.width && v.height
      ? v.width / v.height
      : decoded.id === id
        ? decoded.ratio
        : 16 / 9;
  const fitZoom = Math.min(1, viewportRatio / aspect);
  const scale = Math.max(zoom, fitZoom);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setViewportRatio(width / height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry must reload even when the media ID is unchanged.
  useEffect(() => {
    let alive = true;
    setFailure("");
    if (id)
      mediaUrl(id)
        .then((url) => {
          if (alive) setMedia({ id, url, error: "" });
        })
        .catch((e) => {
          if (alive) setMedia({ id, url: "", error: e.message });
        });
    return () => {
      alive = false;
    };
  }, [id, reload]);
  useEffect(() => {
    const changed = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const url = media.id === id ? media.url : undefined;
  const position = clip ? Math.max(0, clip.offset + time - clip.start) : 0;
  const sync = useCallback(() => {
    const el = videoRef.current;
    if (!el || !url || !el.readyState) return;
    if (!playing) el.pause();
    const goal = Math.min(
      position,
      Math.max(
        0,
        (Number.isFinite(el.duration) ? el.duration : position + 1) - 0.001,
      ),
    );
    if (Math.abs(el.currentTime - goal) > (playing ? 0.18 : 0.012))
      el.currentTime = goal;
    if (playing && el.paused && !el.ended)
      el.play().catch((err) => {
        if (err.name !== "AbortError")
          setFailure(
            "Playback could not start. Pause and press Play to retry.",
          );
      });
  }, [videoRef, url, position, playing]);
  useEffect(sync, [sync]);
  const error = failure || (media.id === id && media.error);
  const [scene, shot] = clip?.name.split("_") ?? [];
  return (
    <section
      aria-label="Media player"
      ref={box}
      className={`sf-viewer${empty ? " is-empty" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          onFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      <div
        className="sf-picture"
        style={{
          aspectRatio: aspect,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {/* biome-ignore lint/a11y/useMediaCaption: Source videos are local review material. */}
        <video
          ref={videoRef}
          src={url || undefined}
          preload="auto"
          playsInline
          onLoadedMetadata={({ currentTarget }) => {
            if (id && currentTarget.videoHeight > 0)
              setDecoded({
                id,
                ratio: currentTarget.videoWidth / currentTarget.videoHeight,
              });
          }}
          onLoadedData={sync}
          onError={() => {
            if (url) setFailure("This browser could not decode the video.");
          }}
          style={{ visibility: url && !error ? "visible" : "hidden" }}
        />
        <div ref={setHost} className="sf-annotation" />
      </div>
      {clip && (
        <>
          <div className="sf-slate">
            <strong>Scene {scene}</strong>
            <strong>Shot {shot}</strong>
          </div>
          <div className="sf-clock">
            {timecode(time).split(":").join(" : ")}
          </div>
          <div className="sf-credit">Uploaded by: {v?.author}</div>
        </>
      )}
      {review && (
        <button
          type="button"
          onClick={closeReview}
          className="sf-version-review"
        >
          {review}
          <X size={13} />
        </button>
      )}
      {(!clip || error || !url) && (
        <div className="sf-preview-message">
          {empty ? (
            <>
              <span className="sf-film">
                <Film size={29} strokeWidth={1.4} />
              </span>
              <h1>Your timeline is empty</h1>
              <p>Drop video clips here to start your storyboard.</p>
              <button className="sf-primary" onClick={pick} type="button">
                <Upload size={14} /> Add clips
              </button>
            </>
          ) : error ? (
            <>
              <strong>Video unavailable</strong>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => {
                  videoRef.current?.load();
                  setReload((x) => x + 1);
                }}
              >
                Retry
              </button>
            </>
          ) : (
            <p>{clip ? "Loading video…" : "No video at the playhead"}</p>
          )}
        </div>
      )}
      <div className="sf-view-controls">
        <button
          type="button"
          title="Zoom in preview"
          aria-label="Zoom in preview"
          disabled={empty || scale >= 3}
          onClick={() => setZoom(Math.min(3, scale + 0.25))}
        >
          <DesignIcon name="imgFiRrZoomIn" />
        </button>
        <button
          type="button"
          title={full ? "Exit fullscreen" : "Fullscreen"}
          aria-label={full ? "Exit fullscreen" : "Fullscreen"}
          onClick={() =>
            void (
              full
                ? document.exitFullscreen()
                : box.current?.requestFullscreen()
            )?.catch(() => setFailure("Fullscreen is unavailable."))
          }
        >
          {full ? <Minimize /> : <DesignIcon name="imgFiRrExpand" />}
        </button>
        <button
          type="button"
          title="Zoom out preview"
          aria-label="Zoom out preview"
          disabled={empty || scale <= fitZoom + 0.001}
          onClick={() => setZoom(Math.max(fitZoom, scale - 0.25))}
        >
          <DesignIcon name="imgFiRrZoomOut" />
        </button>
      </div>
    </section>
  );
}
