import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

function stopTracks(stream?: MediaStream) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

export function VoiceRecorder({
  onRecord,
  onBusy,
  disabled,
}: {
  onRecord: (file: File) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "requesting" | "recording">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const session = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const startTime = useRef(0);

  const release = useCallback(() => {
    const active = recorder.current;
    recorder.current = null;
    if (active && active.state !== "inactive") active.stop();
    stopTracks(active?.stream);
  }, []);

  useEffect(
    () => () => {
      session.current++;
      release();
    },
    [release],
  );
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)),
      250,
    );
    return () => window.clearInterval(timer);
  }, [phase]);

  function finish() {
    session.current++;
    release();
    setPhase("idle");
    onBusy(false);
  }

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording needs a supported browser on HTTPS or localhost.");
      return;
    }
    const token = ++session.current;
    setPhase("requesting");
    onBusy(true);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== session.current) {
        stopTracks(stream);
        return;
      }
      const active = new MediaRecorder(stream);
      recorder.current = active;
      const chunks: Blob[] = [];
      active.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      active.onerror = () => {
        if (token !== session.current) return;
        setError("Recording was interrupted. Try recording again.");
        finish();
      };
      active.onstop = () => {
        if (token !== session.current) return;
        const mime = active.mimeType || chunks[0]?.type || "audio/webm";
        const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        if (chunks.length) onRecord(new File(chunks, `Voice message.${extension}`, { type: mime }));
        else setError("No audio was captured. Try recording again.");
        finish();
      };
      active.start();
      startTime.current = Date.now();
      setElapsed(0);
      setPhase("recording");
    } catch (cause) {
      stopTracks(stream);
      if (token !== session.current) return;
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser to record."
          : "Could not start recording. Check your microphone and try again.",
      );
      finish();
    }
  }

  return (
    <>
      {phase === "idle" ? (
        <button
          type="button"
          className="chat-control"
          disabled={disabled}
          aria-label="Record voice message"
          title="Record voice message"
          onClick={start}
        >
          <Icon name="mic" size={19} />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="flex-1 text-xs text-neutral-600">
            {phase === "requesting"
              ? "Waiting for microphone…"
              : `Recording ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`}
          </span>
          {phase === "recording" && (
            <button
              type="button"
              className="chat-control text-red-600"
              aria-label="Stop recording"
              title="Stop recording"
              onClick={() => {
                if (recorder.current?.state === "recording") recorder.current.stop();
              }}
            >
              <Icon name="stop" size={18} />
            </button>
          )}
          <button
            type="button"
            className="chat-control"
            aria-label="Discard recording"
            title="Discard recording"
            onClick={finish}
          >
            <Icon name="trash" size={17} />
          </button>
        </div>
      )}
      {error && (
        <div className="order-first w-full text-xs text-red-700" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
