import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Checkpoint,
  loadWorkspace,
  type Saved,
  saveWorkspace,
} from "./storage";
import { normalizeShotBlocks } from "./timelineEdits";
import { type Edit, emptyProject, type Project } from "./types";

const initial = (): Saved => ({
  revision: 0,
  project: emptyProject(),
  checkpoints: [],
});
export function useWorkspace(
  author: string,
  notify: (message: string) => void,
) {
  const [state, setState] = useState(initial);
  const latest = useRef(state);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Opening project");
  const diskRevision = useRef(0);
  const queue = useRef(Promise.resolve());
  const failure = useRef("");
  const undoList = useRef<Project[]>([]),
    redoList = useRef<Project[]>([]);
  useEffect(() => {
    let alive = true;
    loadWorkspace()
      .then((saved) => {
        if (!alive) return;
        const value = saved ?? initial();
        normalizeShotBlocks(value.project);
        latest.current = value;
        diskRevision.current = value.revision;
        setState(value);
        setStatus("Saved locally");
        setReady(true);
      })
      .catch((e) => {
        if (alive)
          setStatus(`Could not open local storage. ${String(e.message)}`);
      });
    return () => {
      alive = false;
    };
  }, []);
  const publish = useCallback(
    (value: Saved) => {
      latest.current = value;
      setState(value);
      setStatus("Saving locally");
      queue.current = queue.current.then(async () => {
        if (latest.current !== value) return;
        try {
          const revision = diskRevision.current + 1;
          await saveWorkspace({ ...value, revision }, diskRevision.current);
          diskRevision.current = revision;
          failure.current = "";
          if (latest.current === value) setStatus("Saved locally");
        } catch (e) {
          failure.current =
            e instanceof Error ? e.message : "Local storage is unavailable.";
          setStatus("Save failed");
          notify(failure.current);
        }
      });
    },
    [notify],
  );
  useEffect(() => {
    function guard(e: BeforeUnloadEvent) {
      if (status === "Saving locally" || status === "Save failed") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [status]);
  const edit = useCallback<Edit>(
    (action, message, change, checkpoint = false, clipId, feedbackId) => {
      const old = latest.current;
      const project = structuredClone(old.project);
      change(project);
      let checkpoints = old.checkpoints;
      if (action) {
        project.activity.unshift({
          id: crypto.randomUUID(),
          action,
          message,
          author,
          created: Date.now(),
          clipId:
            clipId ??
            (action === "Uploaded"
              ? project.clips.find(
                  (c) =>
                    !old.project.clips.some((before) => before.id === c.id),
                )?.id
              : undefined),
          feedbackId,
        });
        undoList.current = [...undoList.current.slice(-59), old.project];
        redoList.current = [];
      }
      if (checkpoint)
        checkpoints = [
          {
            id: crypto.randomUUID(),
            created: Date.now(),
            reason: message,
            project: old.project,
          },
          ...checkpoints,
        ];
      publish({ ...old, revision: old.revision + 1, project, checkpoints });
    },
    [author, publish],
  );
  function history(direction: "undo" | "redo") {
    const back = direction === "undo" ? undoList : redoList,
      forward = direction === "undo" ? redoList : undoList;
    const project = back.current.pop();
    if (!project) return;
    const old = latest.current;
    forward.current.push(old.project);
    publish({ ...old, revision: old.revision + 1, project });
  }
  function restore(point: Checkpoint) {
    const old = latest.current,
      project = structuredClone(point.project);
    normalizeShotBlocks(project);
    project.activity = [
      {
        id: crypto.randomUUID(),
        action: "Edited",
        author,
        created: Date.now(),
        message: "restored a checkpoint",
      },
      ...old.project.activity,
    ];
    const checkpoints = [
      {
        id: crypto.randomUUID(),
        created: Date.now(),
        reason: "Before restoring a checkpoint",
        project: old.project,
      },
      ...old.checkpoints,
    ];
    undoList.current.push(old.project);
    redoList.current = [];
    publish({ ...old, revision: old.revision + 1, checkpoints, project });
  }
  async function flush() {
    await queue.current;
    if (failure.current) throw new Error(failure.current);
  }
  return {
    state,
    latest,
    ready,
    status,
    edit,
    restore,
    flush,
    retry: () => publish(latest.current),
    undo: () => history("undo"),
    redo: () => history("redo"),
    canUndo: !!undoList.current.length,
    canRedo: !!redoList.current.length,
  };
}
