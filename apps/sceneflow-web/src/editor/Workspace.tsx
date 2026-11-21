"use client";
import { Clapperboard, History, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./Header";
import Inspector from "./Inspector";
import { exportVideos, importClips, visibleAt } from "./media";
import { preloadProject } from "./preload";
import type { SlipPreview } from "./SlipClip";
import Timeline from "./Timeline";
import type { Activity, Clip, Command, DropTarget } from "./types";
import Updates from "./Updates";
import { useWorkspace } from "./useWorkspace";
import Viewer from "./Viewer";

type Modal = "profile" | "checkpoints" | null;
const parentTarget: DropTarget = { kind: "cell", layerId: "parent", time: 0 };
export default function Workspace() {
  const [author, setAuthor] = useState("Local reviewer"),
    [notice, setNotice] = useState(""),
    [inside, setInside] = useState(true);
  const timer = useRef(0);
  const returnUrl = useRef<string | null>(null);
  const notify = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(""), 6000);
  }, []);
  const ws = useWorkspace(author, notify),
    project = ws.state.project;
  const [selection, setSelection] = useState<string[]>([]),
    [activeLayerId, setActiveLayerId] = useState("parent"),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    clock = useRef(0);
  const playbackFrame = useRef(0);
  const revealTimeRef = useRef<((time: number) => void) | null>(null);
  const [slipPreview, setSlipPreview] = useState<SlipPreview | null>(null);
  const selected = useMemo(
    () => selection.filter((id) => project.clips.some((c) => c.id === id)),
    [selection, project.clips],
  );
  const duration = useMemo(
    () => project.clips.reduce((n, c) => Math.max(n, c.start + c.length), 0),
    [project.clips],
  );
  const [snap, setSnap] = useState(true),
    [host, setHost] = useState<HTMLElement | null>(null),
    videoRef = useRef<HTMLVideoElement>(null);
  const [focused, setFocused] = useState<string | null>(null),
    [focusSeq, setFocusSeq] = useState(0),
    [reviewId, setReviewId] = useState<string | null>(null),
    [pinIds, setPinIds] = useState<string[] | null>(null);
  const [modal, setModal] = useState<Modal>(null),
    [input, setInput] = useState(""),
    [mobile, setMobile] = useState("editor");
  const [job, setJob] = useState(""),
    jobRef = useRef<AbortController | null>(null),
    picker = useRef<HTMLInputElement>(null),
    target = useRef(parentTarget),
    commandRef = useRef<((cmd: Command) => void) | null>(null);
  const timelineProject = useMemo(
    () =>
      pinIds
        ? {
            ...project,
            feedback: project.feedback.filter((f) => pinIds.includes(f.id)),
          }
        : project,
    [project, pinIds],
  );
  useEffect(() => {
    try {
      const name = localStorage.getItem("sceneflow.author");
      if (name) setAuthor(name);
      const khp = new URL(
        process.env.NEXT_PUBLIC_KHP_URL || "http://localhost:3000",
      );
      for (const source of [
        document.referrer,
        sessionStorage.getItem("sceneflow.origin"),
      ]) {
        if (!source) continue;
        const from = new URL(source);
        if (
          from.origin === khp.origin &&
          ["https:", "http:"].includes(from.protocol)
        ) {
          returnUrl.current = from.href;
          sessionStorage.setItem("sceneflow.origin", from.href);
          break;
        }
      }
    } catch {}
    return () => {
      jobRef.current?.abort();
      clearTimeout(timer.current);
    };
  }, []);
  const position = useCallback((t: number) => {
    clock.current = Math.max(0, t);
    setTime(clock.current);
  }, []);
  const seek = useCallback(
    (t: number) => {
      setReviewId(null);
      position(Math.min(t, duration));
    },
    [duration, position],
  );
  const pause = useCallback(
    (frameTime?: number) => {
      cancelAnimationFrame(playbackFrame.current);
      setPlaying(false);
      if (frameTime !== undefined) position(frameTime);
    },
    [position],
  );
  const play = useCallback(() => {
    if (!duration) return;
    setReviewId(null);
    if (clock.current >= duration) position(0);
    setPlaying((on) => !on);
  }, [duration, position]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    function tick(now: number) {
      const t = Math.min(duration, clock.current + (now - last) / 1000);
      last = now;
      clock.current = t;
      setTime(Math.floor(t * 24 + 0.000001) / 24);
      if (t >= duration) {
        setPlaying(false);
        return;
      }
      playbackFrame.current = requestAnimationFrame(tick);
    }
    playbackFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playbackFrame.current);
  }, [playing, duration]);
  useEffect(() => {
    if (clock.current > duration) position(duration);
  }, [duration, position]);
  const baseClip = visibleAt(project, time),
    review = project.feedback.find((f) => f.id === reviewId),
    historical = review && project.clips.find((c) => c.id === review.clipId);
  const activeClip =
    review && historical
      ? {
          ...historical,
          active: review.versionId,
          start: time,
          offset: review.sourceTime,
        }
      : baseClip &&
          slipPreview?.id === baseClip.id &&
          slipPreview.version === baseClip.active
        ? { ...baseClip, offset: slipPreview.offset }
        : baseClip;
  const seekFeedback = useCallback(
    (id: string, panel?: "editor" | "inspector") => {
      const p = ws.latest.current.project,
        f = p.feedback.find((f) => f.id === id),
        c = f && p.clips.find((c) => c.id === f.clipId);
      if (!f || !c) {
        notify("This feedback is unavailable.");
        return false;
      }
      const t = c.start + f.sourceTime - c.offset,
        at = Math.min(Math.max(t, c.start), c.start + c.length);
      const timeline = visibleAt(p, at);
      setReviewId(
        t !== at || timeline?.id !== c.id || f.versionId !== c.active
          ? id
          : null,
      );
      pause();
      position(at);
      revealTimeRef.current?.(at);
      setSelection([c.id]);
      if (panel) setMobile(panel);
      return true;
    },
    [ws.latest, pause, position, notify],
  );
  function openFeedback(id: string) {
    if (seekFeedback(id, "inspector")) {
      setFocused(id);
      setFocusSeq((n) => n + 1);
    }
  }
  const command = useCallback((cmd: Command) => {
    if (cmd === "slip") setMobile("editor");
    setReviewId(null);
    commandRef.current?.(cmd);
  }, []);
  function select(ids: string[]) {
    setSelection(ids);
    setReviewId(null);
  }
  function toggleClipVisibility(clip: Clip) {
    setReviewId(null);
    ws.edit(
      "Edited",
      `${clip.hidden ? "Showed" : "Hid"} clip ${clip.name}`,
      (draft) => {
        const placement = draft.clips.find((item) => item.id === clip.id);
        if (!placement) return;
        placement.hidden = !placement.hidden;
        placement.editor = author;
        placement.edited = Date.now();
      },
      false,
      clip.id,
    );
  }
  function pick(t: DropTarget) {
    if (jobRef.current) {
      notify("Finish the current media operation first.");
      return;
    }
    target.current = t;
    picker.current?.click();
  }
  const onImport = async (files: File[], t: DropTarget) => {
    if (!files.length || jobRef.current) return;
    const controller = new AbortController();
    jobRef.current = controller;
    setJob(
      "Importing " +
        files.length +
        " " +
        (files.length === 1 ? "clip" : "clips") +
        "…",
    );
    let staged: Awaited<ReturnType<typeof importClips>> | undefined;
    try {
      const original = ws.latest.current.project;
      const apply = await importClips(
        files,
        t,
        original,
        author,
        controller.signal,
      );
      staged = apply;
      controller.signal.throwIfAborted();
      if (
        JSON.stringify(original.clips) !==
          JSON.stringify(ws.latest.current.project.clips) ||
        JSON.stringify(original.layers) !==
          JSON.stringify(ws.latest.current.project.layers)
      )
        throw new Error(
          "The timeline changed during import. Drop the clips again.",
        );
      const oldIds = new Set(original.clips.map((c) => c.id));
      let ids: string[] = [],
        start = 0;
      ws.edit(
        "Uploaded",
        `uploaded ${files.map((f) => f.name).join(", ")}`,
        (p) => {
          apply(p);
          ids =
            t.kind === "version" && t.clipId
              ? [t.clipId]
              : p.clips
                  .filter((c) => !oldIds.has(c.id))
                  .sort((a, b) => a.start - b.start)
                  .map((c) => c.id);
          start = p.clips.find((c) => c.id === ids[0])?.start ?? 0;
        },
        false,
        t.clipId,
      );
      if (ids.length) {
        pause();
        position(start);
        select(ids);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError"))
        notify(
          err instanceof Error ? err.message : "Could not import the clips.",
        );
    } finally {
      try {
        await staged?.discard();
      } catch {
        notify("Could not clean up unused import data.");
      }
      jobRef.current = null;
      setJob("");
    }
  };
  async function work(kind: "full" | "selected" | "preload") {
    if (jobRef.current) return;
    const ctrl = new AbortController();
    jobRef.current = ctrl;
    setJob("Preparing videos…");
    try {
      if (kind === "preload") {
        const layer = project.layers.some((layer) => layer.id === activeLayerId)
          ? activeLayerId
          : "parent";
        await preloadProject(project, layer, setJob, ctrl.signal);
        notify("Project videos are ready for playback.");
      } else {
        await exportVideos(
          project,
          kind === "selected" ? selected : null,
          setJob,
          ctrl.signal,
        );
        notify("Export finished.");
      }
    } catch (e) {
      notify(
        ctrl.signal.aborted
          ? "Cancelled."
          : e instanceof Error
            ? e.message
            : "Media operation failed.",
      );
    } finally {
      jobRef.current = null;
      setJob("");
    }
  }
  function showModal(m: Modal) {
    if (m === "profile" && voiceBusy) {
      notify("Submit or discard the voice recording first.");
      return;
    }
    setInput(author);
    setModal(m);
  }
  function submitName() {
    const value = input.trim();
    if (!value) return;
    setAuthor(value);
    try {
      localStorage.setItem("sceneflow.author", value);
    } catch {}
    setModal(null);
  }
  async function exit() {
    if (voiceBusy) {
      notify("Submit or discard the voice recording first.");
      return;
    }
    if (jobRef.current) {
      notify("Finish or cancel the media operation before exiting.");
      return;
    }
    try {
      await ws.flush();
      pause();
      if (returnUrl.current) window.location.assign(returnUrl.current);
      else setInside(false);
    } catch (e) {
      notify(String(e instanceof Error ? e.message : e));
    }
  }
  function openActivity(a: Activity) {
    if (a.feedbackId) {
      openFeedback(a.feedbackId);
      return;
    }
    const c = project.clips.find((c) => c.id === a.clipId);
    if (c) {
      pause();
      select([c.id]);
      seek(c.start);
      setMobile("editor");
    } else notify("This clip is no longer on the timeline.");
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (defaultPrevented(e) || modal || !inside || !ws.ready) return;
      if (e.code === "Space") {
        e.preventDefault();
        play();
        return;
      }
      let cmd: Command | undefined;
      if (e.key === "Delete" || e.key === "Backspace") cmd = "delete";
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") cmd = e.shiftKey ? "redo" : "undo";
        if (e.key.toLowerCase() === "y") cmd = "redo";
      }
      if (cmd) {
        e.preventDefault();
        command(cmd);
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [modal, inside, ws.ready, play, command]);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  if (!ws.ready)
    return (
      <main className="sf-opening">
        <Clapperboard />
        <strong>SceneFlow</strong>
        <p>{ws.status}</p>
        {ws.status.startsWith("Could") && (
          <button type="button" onClick={() => location.reload()}>
            Retry
          </button>
        )}
      </main>
    );
  if (!inside)
    return (
      <main className="sf-opening">
        <Clapperboard />
        <h1>{project.title}</h1>
        <p>{project.clips.length} clips · Saved in this browser</p>
        <button
          className="sf-primary"
          type="button"
          onClick={() => setInside(true)}
        >
          Open SceneFlow
        </button>
      </main>
    );
  return (
    <div className="sf-workspace">
      <Header
        project={project}
        author={author}
        status={ws.status}
        selected={selected.length}
        job={job}
        busy={!!job}
        rename={(name) =>
          ws.edit("Edited", "renamed the project", (p) => {
            p.title = name;
          })
        }
        profile={() => showModal("profile")}
        points={() => showModal("checkpoints")}
        render={(s) => void work(s ? "selected" : "full")}
        preload={() => void work("preload")}
        exit={() => void exit()}
        openFeedback={openFeedback}
        retry={ws.retry}
      />
      <nav className="sf-mobile-tabs" aria-label="Workspace panels">
        {["activity", "editor", "inspector"].map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={mobile === view}
            onClick={() => setMobile(view)}
          >
            {view === "inspector"
              ? "Clip panel"
              : view === "activity"
                ? "Updates"
                : "Timeline"}
          </button>
        ))}
      </nav>
      <main className="sf-layout" data-panel={mobile}>
        <Updates items={project.activity} author={author} open={openActivity} />
        <div className="sf-center">
          <Viewer
            clip={activeClip}
            time={time}
            playing={playing}
            empty={!project.clips.length}
            videoRef={videoRef}
            setHost={setHost}
            pick={() => pick(parentTarget)}
            onFiles={(fs) => void onImport(fs, parentTarget)}
            review={
              historical && review
                ? "Reviewing " +
                  historical.name +
                  " · V" +
                  (historical.versions.findIndex(
                    (v) => v.id === review.versionId,
                  ) +
                    1)
                : ""
            }
            closeReview={() => setReviewId(null)}
          />
          <Timeline
            revealTimeRef={revealTimeRef}
            onToggleClipVisibility={toggleClipVisibility}
            onSlipPreview={setSlipPreview}
            onActiveLayer={setActiveLayerId}
            project={timelineProject}
            edit={ws.edit}
            selected={selected}
            select={select}
            time={time}
            seek={seek}
            playing={playing}
            play={play}
            undo={ws.undo}
            redo={ws.redo}
            canUndo={ws.canUndo}
            canRedo={ws.canRedo}
            onImport={onImport}
            pick={pick}
            notify={notify}
            author={author}
            onPin={openFeedback}
            commandRef={commandRef}
            snap={snap}
            setSnap={setSnap}
          />
        </div>
        <div className="sf-inspector-shell">
          <Inspector
            onShowInspector={() => setMobile("inspector")}
            activeLayerId={activeLayerId}
            project={project}
            edit={ws.edit}
            selected={selected}
            time={time}
            activeClip={activeClip}
            author={author}
            command={command}
            pick={pick}
            notify={notify}
            pause={pause}
            seekFeedback={seekFeedback}
            focusedFeedback={focused}
            focusSeq={focusSeq}
            overlayHost={host}
            videoRef={videoRef}
            canUndo={ws.canUndo}
            canRedo={ws.canRedo}
            snap={snap}
            onPinFilter={setPinIds}
            onVoiceBusy={setVoiceBusy}
            onVersionSelected={() => setReviewId(null)}
          />
        </div>
      </main>
      <input
        ref={picker}
        type="file"
        className="sf-file"
        accept="video/*,.mov,.mp4,.webm,.m4v,.mkv"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void onImport(files, target.current);
        }}
      />
      {job && (
        <output className="sf-job">
          <LoaderCircle size={15} />
          {job}
          <button type="button" onClick={() => jobRef.current?.abort()}>
            Cancel
          </button>
        </output>
      )}
      {notice && (
        <output className="sf-toast">
          {notice}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </output>
      )}
      <dialog
        ref={dialog}
        className="sf-dialog"
        onCancel={() => setModal(null)}
      >
        <div className="sf-dialog-title">
          <h2>{modal === "checkpoints" ? "Checkpoints" : "Local reviewer"}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X size={17} />
          </button>
        </div>
        {modal === "checkpoints" ? (
          ws.state.checkpoints.length ? (
            <ul>
              {ws.state.checkpoints.map((point) => (
                <li key={point.id}>
                  <History size={17} />
                  <span>
                    {point.reason}
                    <small>{new Date(point.created).toLocaleString()}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      pause();
                      setReviewId(null);
                      select([]);
                      ws.restore(point);
                      setModal(null);
                      notify("Checkpoint restored.");
                    }}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Checkpoints appear here before a layer or multiple clips are
              deleted.
            </p>
          )
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitName();
            }}
          >
            <label>
              Reviewer name
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={90}
                required
              />
            </label>
            {modal === "profile" && (
              <p>
                This name is used for uploads, feedback, and notifications in
                this browser.
              </p>
            )}
            <button
              className="sf-primary"
              type="submit"
              disabled={!input.trim()}
            >
              Save
            </button>
          </form>
        )}
      </dialog>
    </div>
  );
}
function defaultPrevented(e: KeyboardEvent) {
  const el = e.target;
  return (
    e.defaultPrevented ||
    e.repeat ||
    (el instanceof HTMLElement &&
      !!el.closest(
        "input,textarea,select,[contenteditable=true],dialog[open],[popover]",
      )) ||
    (e.code === "Space" && el instanceof HTMLElement && !!el.closest("button"))
  );
}
