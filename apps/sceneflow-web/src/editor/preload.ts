import { mediaUrl } from "./storage";
import { currentVersion, type Project } from "./types";

const prepared = new Set<string>();
async function prepare(id: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if (prepared.has(id)) return;
  const url = await mediaUrl(id);
  // Stream cached bytes without retaining another copy of a full project in JS memory.
  const response = await fetch(url, { signal });
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Video bytes are unavailable.");
  try {
    while (!(await reader.read()).done) {
      signal.throwIfAborted();
    }
  } finally {
    reader.releaseLock();
  }
  signal.throwIfAborted();
  const element = document.createElement("video");
  element.preload = "auto";
  element.muted = true;
  await new Promise<void>((resolve, reject) => {
    function finish(error?: Error) {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      element.onloadeddata = null;
      element.onerror = null;
      element.removeAttribute("src");
      element.load();
      if (error) reject(error);
      else resolve();
    }
    function abort() {
      finish(new DOMException("Preload cancelled", "AbortError"));
    }
    const timeout = window.setTimeout(
      () => finish(new Error("Timed out while preparing video.")),
      15000,
    );
    element.onloadeddata = () => finish();
    element.onerror = () =>
      finish(new Error("This browser could not prepare a video."));
    signal.addEventListener("abort", abort, { once: true });
    element.src = url;
  });
  prepared.add(id);
}
export async function preloadProject(
  project: Project,
  layer: string,
  progress: (s: string) => void,
  signal: AbortSignal,
) {
  const priority = [
    ...new Set(
      project.clips
        .filter((c) => c.layerId === layer)
        .map((c) => currentVersion(c).mediaId),
    ),
  ];
  const rest = [
    ...new Set(project.clips.flatMap((c) => c.versions.map((v) => v.mediaId))),
  ].filter((id) => !priority.includes(id));
  for (const [index, id] of priority.entries()) {
    progress(`Preparing current layer · ${index + 1} of ${priority.length}`);
    await prepare(id, signal);
  }
  for (const [index, id] of rest.entries()) {
    progress(`Loading remaining videos · ${index + 1} of ${rest.length}`);
    await prepare(id, signal);
  }
}
