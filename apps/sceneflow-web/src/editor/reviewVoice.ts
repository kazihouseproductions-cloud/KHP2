import { useEffect, useRef, useState } from "react";
import { saveMedia } from "./storage";

type CaptureState = "requesting" | "recording" | "saving" | "retry";
type Session = {
  id: string;
  recorder?: MediaRecorder;
  stream?: MediaStream;
  finishRequested?: boolean;
  blob?: Blob;
};

function release(session: Session) {
  for (const track of session.stream?.getTracks() || []) track.stop();
}

export function useVoiceCapture(
  onSubmit: (id: string, audio: string) => void,
  notify: (message: string) => void,
) {
  const live = useRef<Session | null>(null);
  const handlers = useRef({ onSubmit, notify });
  useEffect(() => {
    handlers.current = { onSubmit, notify };
  }, [onSubmit, notify]);
  const [capture, setCapture] = useState<{
    id: string;
    state: CaptureState;
  } | null>(null);

  function cancel() {
    const session = live.current;
    live.current = null;
    if (session?.recorder?.state === "recording") session.recorder.stop();
    if (session) release(session);
    setCapture(null);
  }
  useEffect(() => {
    const leave = () => {
      const session = live.current;
      live.current = null;
      if (session?.recorder?.state === "recording") session.recorder.stop();
      if (session) release(session);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);
  async function save(session: Session) {
    if (!session.blob || live.current !== session) return;
    setCapture({ id: session.id, state: "saving" });
    try {
      const id = await saveMedia(session.blob);
      if (live.current !== session) return;
      handlers.current.onSubmit(session.id, id);
      live.current = null;
      setCapture(null);
    } catch {
      if (live.current !== session) return;
      handlers.current.notify(
        "The recording could not be saved. Submit again to retry.",
      );
      setCapture({ id: session.id, state: "retry" });
    }
  }
  function finish() {
    const session = live.current;
    if (!session) return;
    if (session.blob && capture?.state === "retry") {
      void save(session);
      return;
    }
    session.finishRequested = true;
    if (session.recorder?.state === "recording") session.recorder.stop();
  }
  async function start(id: string) {
    if (live.current) return;
    const session: Session = { id };
    live.current = session;
    setCapture({ id, state: "requesting" });
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error("unsupported");
      session.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (live.current !== session) {
        release(session);
        return;
      }
      const recorder = new MediaRecorder(session.stream);
      session.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (live.current !== session) return;
        cancel();
        handlers.current.notify(
          "Recording stopped unexpectedly. Start a new recording from the draft.",
        );
      };
      recorder.onstop = () => {
        release(session);
        if (live.current !== session) return;
        if (!chunks.length) {
          live.current = null;
          setCapture(null);
          handlers.current.notify(
            "No audio was captured. Record again from the draft.",
          );
          return;
        }
        session.blob = new Blob(chunks, {
          type: recorder.mimeType || chunks[0].type,
        });
        void save(session);
      };
      recorder.start();
      setCapture({ id, state: "recording" });
      if (session.finishRequested) recorder.stop();
    } catch (error) {
      if (live.current !== session) return;
      release(session);
      live.current = null;
      setCapture(null);
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      handlers.current.notify(
        denied
          ? "Microphone access was denied. Allow the microphone and record again from this draft."
          : "The microphone is unavailable. Connect a microphone and record again from this draft.",
      );
    }
  }
  return { capture, start, finish, cancel, currentId: () => live.current?.id };
}
