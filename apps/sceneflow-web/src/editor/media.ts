import "./mediaDialog.css";
import { type AskImport, askImport } from "./mediaDialog";
import { probeVideo } from "./mediaDom";
import { type Intake, placeIntake, resolveShot } from "./mediaPlan";
import { discardMediaBatch, saveMediaBatch } from "./storage";
import type { DropTarget, Project } from "./types";

export { exportVideos } from "./mediaExport";
export { visibleAt } from "./mediaPlan";

const stateKey = (project: Project) =>
  JSON.stringify([project.layers, project.clips]);

export type PreparedImport = ((draft: Project) => void) & {
  discard: () => Promise<void>;
};

export async function importClips(
  files: File[],
  target: DropTarget,
  project: Project,
  author: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<PreparedImport> {
  signal.throwIfAborted();
  if (!files.length) throw new Error("Choose at least one video file.");
  if (target.kind === "version" && files.length !== 1)
    throw new Error("Choose one video to add a clip version.");
  const before = stateKey(project);
  const prepared = structuredClone(project);
  const intake: Intake[] = [];
  const ask: AskImport = (question) => askImport(question, signal);
  for (const file of files) {
    const metadata = await probeVideo(file, signal);
    const name =
      target.kind === "version" ? "" : await resolveShot(file.name, ask);
    intake.push({
      name,
      version: {
        id: crypto.randomUUID(),
        mediaId: "",
        filename: file.name,
        ...metadata,
        stage: "Not Set",
        author,
        created: Date.now(),
      },
    });
  }
  await placeIntake(prepared, target, intake, author, ask);
  signal.throwIfAborted();
  const ids = await saveMediaBatch(files);
  if (signal.aborted) {
    await discardMediaBatch(ids);
    signal.throwIfAborted();
  }
  intake.forEach((item, index) => {
    item.version.mediaId = ids[index];
  });
  let applied = false;
  let cleanup: Promise<void> | undefined;
  function discard(): Promise<void> {
    signal.removeEventListener("abort", aborted);
    if (applied) return Promise.resolve();
    cleanup ??= discardMediaBatch(ids).catch((error) => {
      cleanup = undefined;
      throw error;
    });
    return cleanup;
  }
  function aborted() {
    // The workspace also awaits discard before dismissing the import job.
    void discard().catch(() => {});
  }
  signal.addEventListener("abort", aborted, { once: true });
  function apply(draft: Project) {
    signal.throwIfAborted();
    if (cleanup) throw new DOMException("Import canceled.", "AbortError");
    if (stateKey(draft) !== before) {
      aborted();
      throw new Error(
        "The timeline changed during import. Drop the videos again on the current timeline.",
      );
    }
    draft.layers = prepared.layers;
    draft.clips = prepared.clips;
    for (const item of intake) if (item.name) draft.shots[item.name] ??= {};
    applied = true;
    signal.removeEventListener("abort", aborted);
  }
  return Object.assign(apply, { discard });
}
