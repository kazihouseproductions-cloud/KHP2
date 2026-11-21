import { openVideo, releaseVideo, seekVideo } from "./mediaDom";
import { type RenderSpan, renderSpans } from "./mediaPlan";
import { mediaUrl } from "./storage";
import { fps } from "./timelineEdits";
import { currentVersion, type Project } from "./types";

const formats = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/webm",
  "video/mp4",
];

function untilCanceled<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () =>
      reject(new DOMException("Export canceled.", "AbortError"));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", cancel));
  });
}

function paint(context: CanvasRenderingContext2D, video?: HTMLVideoElement) {
  const { width, height } = context.canvas;
  context.fillStyle = "black";
  context.fillRect(0, 0, width, height);
  if (!video) return;
  const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
  const w = video.videoWidth * scale,
    h = video.videoHeight * scale;
  context.drawImage(video, (width - w) / 2, (height - h) / 2, w, h);
}

function playSpan(
  context: CanvasRenderingContext2D,
  duration: number,
  video: HTMLVideoElement | undefined,
  onTime: (time: number) => void,
  signal: AbortSignal,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let request = 0;
    const started = performance.now();
    const finish = (error?: Error) => {
      cancelAnimationFrame(request);
      document.removeEventListener("visibilitychange", visibility);
      signal.removeEventListener("abort", cancel);
      video?.removeEventListener("error", failed);
      video?.removeEventListener("waiting", stalled);
      video?.pause();
      if (error) reject(error);
      else resolve((performance.now() - started) / 1000);
    };
    const cancel = () =>
      finish(new DOMException("Export canceled.", "AbortError"));
    const failed = () =>
      finish(
        new Error(
          video?.error?.message || "Video decoding failed during export.",
        ),
      );
    const stalled = () =>
      finish(
        new Error(
          "Video playback stalled during export. Retry after preloading the project.",
        ),
      );
    const visibility = () => {
      if (document.hidden)
        finish(
          new Error("Keep the SceneFlow tab visible while rendering video."),
        );
    };
    function draw() {
      try {
        const elapsed = (performance.now() - started) / 1000;
        paint(context, video);
        onTime(Math.min(duration, elapsed));
        if (elapsed >= duration) finish();
        else request = requestAnimationFrame(draw);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    }
    document.addEventListener("visibilitychange", visibility);
    video?.addEventListener("error", failed, { once: true });
    video?.addEventListener("waiting", stalled, { once: true });
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    else if (document.hidden) visibility();
    else draw();
  });
}

async function encode(
  spans: RenderSpan[],
  audio: AudioContext,
  format: string,
  progress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const first = spans.find((span) => span.clip)?.clip;
  if (!spans.length) throw new Error("The export has no duration.");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context || !canvas.captureStream)
    throw new Error("Canvas video recording is unavailable in this browser.");
  let loaded:
    | { id: string; video: HTMLVideoElement; node: MediaElementAudioSourceNode }
    | undefined;
  const output = audio.createMediaStreamDestination();
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let rendererError: Error | undefined;
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) controller.abort();
  const rendering = controller.signal;
  function releaseSource() {
    if (!loaded) return;
    releaseVideo(loaded.video);
    loaded.node.disconnect();
    loaded = undefined;
  }
  async function source(clip: NonNullable<RenderSpan["clip"]>) {
    const version = currentVersion(clip);
    if (loaded?.id !== version.mediaId) {
      releaseSource();
      const url = await untilCanceled(mediaUrl(version.mediaId), rendering);
      const video = await openVideo(url, rendering);
      try {
        const node = audio.createMediaElementSource(video);
        node.connect(output);
        loaded = { id: version.mediaId, video, node };
      } catch (error) {
        releaseVideo(video);
        throw error;
      }
    }
    return loaded.video;
  }
  try {
    const initial = first ? await source(first) : undefined;
    canvas.width = 2 * Math.ceil((initial?.videoWidth ?? 1280) / 2);
    canvas.height = 2 * Math.ceil((initial?.videoHeight ?? 720) / 2);
    paint(context, initial);
    stream = canvas.captureStream(fps);
    for (const track of output.stream.getAudioTracks()) stream.addTrack(track);
    recorder = new MediaRecorder(stream, { mimeType: format });
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve) => {
      recorder?.addEventListener("stop", () => resolve(), { once: true });
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      rendererError = new Error(
        "The browser video encoder failed. Try a supported source resolution or a different browser.",
      );
      controller.abort();
    };
    const duration = spans[spans.length - 1].end;
    let recordedTime = 0;
    for (const span of spans) {
      rendering.throwIfAborted();
      const remaining = span.end - recordedTime;
      if (remaining <= 0) continue;
      const video = span.clip ? await source(span.clip) : undefined;
      if (video)
        await seekVideo(
          video,
          span.offset + Math.max(0, recordedTime - span.start),
          rendering,
        );
      paint(context, video);
      if (video) await untilCanceled(video.play(), rendering);
      if (recorder.state === "inactive") recorder.start(1000);
      else recorder.resume();
      recordedTime += await playSpan(
        context,
        remaining,
        video,
        (t) => progress((recordedTime + t) / duration),
        rendering,
      );
      recorder.pause();
    }
    recorder.stop();
    await untilCanceled(stopped, rendering);
    if (rendererError) throw rendererError;
    signal.throwIfAborted();
    const blob = new Blob(chunks, { type: recorder.mimeType || format });
    if (!blob.size) throw new Error("The encoder produced an empty video.");
    return blob;
  } catch (error) {
    throw rendererError ?? error;
  } finally {
    signal.removeEventListener("abort", stop);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    releaseSource();
    for (const track of stream?.getTracks() ?? []) track.stop();
    for (const track of output.stream.getTracks()) track.stop();
    output.disconnect();
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

export async function exportVideos(
  project: Project,
  selected: string[] | null,
  progress: (message: string) => void,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  if (!project.clips.length) throw new Error("Add a video before exporting.");
  if (
    typeof MediaRecorder === "undefined" ||
    typeof AudioContext === "undefined"
  )
    throw new Error("This browser cannot record timeline video and audio.");
  const format = formats.find((type) => MediaRecorder.isTypeSupported(type));
  if (!format)
    throw new Error(
      "This browser has no supported WebM or MP4 recording format.",
    );
  const clips =
    selected === null
      ? [undefined]
      : project.clips.filter((c) => selected.includes(c.id));
  if (!clips.length) throw new Error("Select at least one clip to export.");
  const audio = new AudioContext();
  try {
    await untilCanceled(audio.resume(), signal);
    for (const [index, clip] of clips.entries()) {
      signal.throwIfAborted();
      const name = (clip?.name || project.title || "SceneFlow").replace(
        /[<>:"/\\|?*]/g,
        "_",
      );
      let previous = -1;
      progress(`Preparing ${name} (${index + 1}/${clips.length})…`);
      const blob = await encode(
        renderSpans(project, clip),
        audio,
        format,
        (fraction) => {
          const percent = Math.floor(fraction * 100);
          if (percent !== previous)
            progress(
              `Rendering ${name} (${index + 1}/${clips.length}) · ${percent}%`,
            );
          previous = percent;
        },
        signal,
      );
      const label = clip
        ? `${name}-${index + 1}-v${clip.versions.findIndex((v) => v.id === clip.active) + 1}`
        : name;
      download(blob, `${label}.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
    }
  } finally {
    await audio.close();
  }
}
