/** Wait for a decoding operation, including failures that happen synchronously. */
export function mediaEvent(
  video: HTMLVideoElement,
  event: string,
  start: () => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      video.removeEventListener(event, ready);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", canceled);
      if (error) reject(error);
      else resolve();
    };
    const ready = () => finish();
    const failed = () =>
      finish(
        new Error(
          video.error?.message ||
            "This browser cannot decode the video format.",
        ),
      );
    const canceled = () =>
      finish(new DOMException("Media operation canceled.", "AbortError"));
    const timer = setTimeout(
      () => finish(new Error("The video decoder timed out.")),
      20000,
    );
    video.addEventListener(event, ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", canceled, { once: true });
    if (signal?.aborted) return canceled();
    try {
      start();
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function openVideo(
  url: string,
  signal?: AbortSignal,
): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  return mediaEvent(
    video,
    "loadeddata",
    () => {
      video.src = url;
    },
    signal,
  )
    .then(() => {
      if (!video.videoWidth || !video.videoHeight)
        throw new Error("The file contains no decodable video track.");
      return video;
    })
    .catch((error) => {
      releaseVideo(video);
      throw error;
    });
}

export function releaseVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

export async function seekVideo(
  video: HTMLVideoElement,
  time: number,
  signal?: AbortSignal,
) {
  if (
    !video.seeking &&
    Math.abs(video.currentTime - time) < 0.0001 &&
    video.readyState >= 2
  )
    return;
  await mediaEvent(
    video,
    "seeked",
    () => {
      video.currentTime = time;
    },
    signal,
  );
}

export async function probeVideo(file: File, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const url = URL.createObjectURL(file);
  let video: HTMLVideoElement | undefined;
  try {
    video = await openVideo(url, signal);
    // Browser-recorded WebM files can omit a precomputed duration. Seeking to
    // the end lets the decoder discover the timestamp of the final block.
    if (!Number.isFinite(video.duration)) await seekVideo(video, 1e8, signal);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error(
        "The decoder could not determine a finite video duration.",
      );
    await seekVideo(video, Math.min(duration / 4, 0.5), signal);
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(224, video.videoWidth);
    canvas.height = Math.max(
      1,
      Math.round((canvas.width * video.videoHeight) / video.videoWidth),
    );
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Thumbnail capture is unavailable.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return {
      duration,
      width: video.videoWidth,
      height: video.videoHeight,
      thumbnail: canvas.toDataURL("image/jpeg", 0.75),
    };
  } catch (error) {
    signal?.throwIfAborted();
    throw new Error(
      `${file.name}: ${error instanceof Error ? error.message : "Unable to decode video."}`,
    );
  } finally {
    if (video) releaseVideo(video);
    URL.revokeObjectURL(url);
  }
}
