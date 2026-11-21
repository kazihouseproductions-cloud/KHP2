import {
  Check,
  Circle,
  Ellipsis,
  ImagePlus,
  Mic,
  Paperclip,
  Pencil,
  Send,
  Star,
  Trash2,
  Undo2,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DesignIcon } from "./DesignIcon";
import { feedbackPinColor, useMediaUrl } from "./reviewCommon";
import type { useVoiceCapture } from "./reviewVoice";
import { saveMedia } from "./storage";
import { type Clip, type Edit, type Feedback, timecode } from "./types";

export const feedbackColors = [
  { name: "Blue", hex: "#43618e" },
  { name: "Red", hex: "#eb3333" },
  { name: "Gold", hex: "#dfad40" },
  { name: "Green", hex: "#35875c" },
  { name: "Purple", hex: "#9265a8" },
] as const;

export const kindIcons = {
  text: "imgFiRrText",
  voice: "imgFiRsMicrophone",
  drawing: "imgFiRrPencil",
} as const;

export const labelsFor = (item: Feedback) => item.colorLabels ?? [];

interface CardProps {
  item: Feedback;
  ordinal: number;
  clip?: Clip;
  author: string;
  selected: boolean;
  autoFocusComposer: boolean;
  edit: Edit;
  notify: (message: string) => void;
  open: () => void;
  viewImage: (id: string) => void;
  voice: ReturnType<typeof useVoiceCapture>;
}

export function FeedbackCard({
  item,
  ordinal,
  clip,
  author,
  selected,
  autoFocusComposer,
  edit,
  open,
  notify,
  viewImage,
  voice,
}: CardProps) {
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [replies, setReplies] = useState(false);
  const [reply, setReply] = useState("");
  const [attaching, setAttaching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const image = useMediaUrl(item.image);
  const audio = useMediaUrl(item.audio);
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const draft = item.status === "draft";
  const composer = draft && selected;
  const textComposer = composer && item.kind === "text";
  useLayoutEffect(() => {
    if (textComposer && autoFocusComposer)
      textInput.current?.focus({ preventScroll: true });
  }, [textComposer, autoFocusComposer]);
  const session = voice.capture?.id === item.id ? voice.capture.state : null;
  const number = clip?.versions.findIndex((v) => v.id === item.versionId) ?? -1;
  const localTime = clip ? item.sourceTime - clip.offset : -1;
  const inTimeline = !!clip && localTime >= 0 && localTime < clip.length;
  const stamp = timecode(inTimeline ? clip.start + localTime : item.sourceTime);
  const posted = new Date(item.created);
  const labels = labelsFor(item);
  const pinLabel = `${item.author} · ${draft ? "draft pin" : "pin color"} (fixed)`;
  const [scene, shot] = clip?.name.split("_") ?? [];
  const context = shot
    ? `Scene: ${scene} Shot: ${shot}`
    : (clip?.name ?? "Removed clip");
  const dateCaption =
    posted.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    ", " +
    posted.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

  useEffect(() => {
    if (!menu && !palette) return;
    const pointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
      if (!paletteRef.current?.contains(e.target as Node)) setPalette(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setPalette(false);
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [menu, palette]);

  function change(
    action: string,
    message: string,
    transform: (item: Feedback) => void,
  ) {
    edit(
      action,
      message,
      (project) => {
        const target = project.feedback.find((f) => f.id === item.id);
        if (target) transform(target);
      },
      false,
      item.clipId,
      item.id,
    );
  }
  function status(next: "pending" | "done" | "approved") {
    setMenu(false);
    change(
      "Feedback status changed",
      `Marked feedback on ${clip?.name || "clip"} as ${next}`,
      (entry) => {
        entry.revertCount ??= entry.reverted ? 1 : 0;
        if (next === "pending" && entry.status !== "pending")
          entry.revertCount++;
        entry.status = next;
        entry.reverted = next === "pending";
      },
    );
  }
  function toggleLabel(name: string) {
    change(
      "Feedback labels changed",
      `Updated feedback labels on ${clip?.name ?? "clip"}`,
      (entry) => {
        const current = labelsFor(entry);
        entry.colorLabels = current.includes(name)
          ? current.filter((label) => label !== name)
          : [...current, name];
      },
    );
  }
  function remove() {
    if (session) voice.cancel();
    edit(
      draft ? "" : "Feedback deleted",
      `Deleted feedback on ${clip?.name || "clip"}`,
      (project) => {
        project.feedback = project.feedback.filter((f) => f.id !== item.id);
      },
      false,
      item.clipId,
      item.id,
    );
  }
  async function attach(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Choose an image file.");
      return;
    }
    setAttaching(true);
    try {
      const id = await saveMedia(file);
      change("", "", (entry) => {
        entry.image = id;
      });
    } catch {
      notify("The image could not be saved. Choose the file again to retry.");
    } finally {
      setAttaching(false);
    }
  }
  function submit() {
    if (attaching) return;
    if (item.kind === "voice") {
      if (session) voice.finish();
      else if (!voice.currentId()) void voice.start(item.id);
      return;
    }
    if (!item.text.trim() && !item.image) return;
    change(
      "Feedback posted",
      `Posted feedback on ${clip?.name || "clip"}`,
      (entry) => {
        entry.status = "pending";
        entry.text = entry.text.trim();
      },
    );
  }
  function sendReply() {
    if (!reply.trim()) return;
    change(
      "Feedback reply",
      `Replied to feedback on ${clip?.name || "clip"}`,
      (entry) => {
        entry.replies ||= [];
        entry.replies.push({ author, text: reply.trim() });
      },
    );
    setReply("");
  }
  const stateName = draft
    ? "Draft"
    : item.status === "approved"
      ? "Approved"
      : item.status === "done"
        ? "Done"
        : "Pending";
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: The card's timestamp button exposes the same jump to keyboard and screen reader users.
    <article
      id={`review-item-${item.id}`}
      className={`rv-card${selected ? " is-focused" : ""}`}
      aria-label={`${stateName} ${item.kind} feedback by ${item.author}`}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          !event.target.closest(
            "button, input, textarea, select, label, audio, a, form, .rv-menu, [contenteditable=true]",
          )
        )
          open();
      }}
    >
      <div className="rv-card-head">
        <span className="rv-number">#{String(ordinal).padStart(2, "0")}</span>
        <strong className="rv-author" title={`${item.author} · ${dateCaption}`}>
          {item.author}
        </strong>
        <div className="rv-card-menu" ref={menuRef}>
          <button
            type="button"
            className="rv-icon"
            aria-label="Feedback options"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Ellipsis size={16} />
          </button>
          {menu && (
            <div className="rv-menu">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  if (draft) open();
                  else {
                    setEditing(true);
                    setReplacement(item.text);
                  }
                }}
              >
                <Pencil />
                Edit feedback
              </button>
              {(item.status === "done" || item.status === "approved") && (
                <button type="button" onClick={() => status("pending")}>
                  <Undo2 />
                  Revert
                </button>
              )}
              <button type="button" className="rv-danger" onClick={remove}>
                <Trash2 />
                Delete feedback
              </button>
            </div>
          )}
        </div>
        {draft ? (
          <span className="rv-draft-status" title="Draft">
            Draft
          </span>
        ) : item.status === "approved" ? (
          <span className="rv-status is-approved" title="Approved">
            <Star size={15} fill="currentColor" />
          </span>
        ) : (
          <button
            type="button"
            className={`rv-status is-${item.reverted ? "returned" : item.status}`}
            aria-label={
              item.status === "done" ? "Return to Pending" : "Mark Done"
            }
            title={item.status === "done" ? "Return to Pending" : "Mark Done"}
            onClick={() => status(item.status === "done" ? "pending" : "done")}
          >
            {item.status === "done" ? (
              <Check size={15} />
            ) : item.reverted ? (
              <Circle size={13} />
            ) : null}
          </button>
        )}
      </div>
      <div className="rv-card-body">
        {composer ? (
          <div className="rv-composer">
            {item.kind === "voice" && (
              <div
                className={`rv-record-indicator${session === "recording" ? " is-recording" : ""}`}
              >
                <Mic size={13} />
                {session === "recording"
                  ? "Recording"
                  : session === "requesting"
                    ? "Waiting for microphone…"
                    : session === "saving"
                      ? "Saving recording…"
                      : session === "retry"
                        ? "Ready to retry"
                        : "Voice draft"}
              </div>
            )}
            <textarea
              ref={textInput}
              aria-label={
                item.kind === "voice" ? "Voice feedback note" : "Feedback text"
              }
              placeholder={
                item.kind === "voice" ? "Add a note…" : "Write your feedback…"
              }
              value={item.text}
              onKeyDown={(event) => {
                if (
                  !textComposer ||
                  event.key !== "Enter" ||
                  event.shiftKey ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.nativeEvent.isComposing ||
                  event.nativeEvent.keyCode === 229
                )
                  return;
                event.preventDefault();
                if (!event.repeat) submit();
              }}
              onChange={(e) => {
                const value = e.currentTarget.value;
                change("", "", (entry) => {
                  entry.text = value;
                });
              }}
              rows={3}
            />
            <input
              type="file"
              ref={fileInput}
              accept="image/*"
              hidden
              onChange={(e) => {
                void attach(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="rv-compose-actions">
              <button
                type="button"
                disabled={attaching}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={13} />
                {attaching ? "Saving…" : "Attach Image"}
              </button>
              <button
                type="button"
                className="rv-primary"
                disabled={
                  attaching ||
                  (item.kind === "text" && !item.text.trim() && !item.image) ||
                  session === "saving" ||
                  (item.kind === "voice" && !!voice.currentId() && !session)
                }
                onClick={submit}
              >
                {item.kind === "voice" && !session ? "Record" : "Submit"}
              </button>
            </div>
            <button type="button" className="rv-discard" onClick={remove}>
              Discard draft
            </button>
          </div>
        ) : editing ? (
          <div className="rv-composer">
            <textarea
              aria-label="Edit feedback text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              rows={3}
            />
            <div className="rv-compose-actions">
              <button type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="rv-primary"
                disabled={!replacement.trim() && !item.image && !item.audio}
                onClick={() => {
                  change(
                    "Feedback edited",
                    `Edited feedback on ${clip?.name || "clip"}`,
                    (entry) => {
                      entry.text = replacement.trim();
                    },
                  );
                  setEditing(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : item.text ? (
          <p className="rv-feedback-text">{item.text}</p>
        ) : draft ? (
          <button type="button" className="rv-text-link" onClick={open}>
            Open {item.kind} draft
          </button>
        ) : null}
        {item.image &&
          (image ? (
            <button
              type="button"
              className="rv-thumbnail"
              onClick={() => item.image && viewImage(item.image)}
              aria-label={
                item.kind === "drawing"
                  ? "Open full annotated frame"
                  : "Open full attached image"
              }
            >
              {/* biome-ignore lint/performance/noImgElement: IndexedDB images use local object URLs. */}
              <img
                src={image}
                alt={
                  item.kind === "drawing" ? "Annotated frame" : "Attached image"
                }
              />
              <span>
                <Paperclip size={11} />
                {item.kind === "drawing" ? "Drawing" : "Attachment"}
              </span>
            </button>
          ) : (
            <small className="rv-media-pending">Loading image…</small>
          ))}
        {item.audio &&
          (audio ? (
            // biome-ignore lint/a11y/useMediaCaption: Voice messages are original reviewer recordings.
            <audio controls src={audio} aria-label="Voice feedback" />
          ) : (
            <small className="rv-media-pending">
              <Volume2 size={12} />
              Loading recording…
            </small>
          ))}
      </div>
      <div className="rv-card-foot">
        <button
          type="button"
          onClick={open}
          aria-label={`Go to ${item.author}’s feedback on ${clip?.name ?? "clip"} at ${stamp}`}
          title={`Open ${clip?.name || "clip"}, V${number + 1}, source ${timecode(item.sourceTime)}`}
          className="rv-anchor"
        >
          <span className="rv-context">
            <DesignIcon name={kindIcons[item.kind]} size={18} />
            <span>{context}</span>
          </span>
          <span className="rv-stamp">
            <time>
              {!inTimeline && "Source "}
              {stamp}
            </time>
            <span>Reverted: {item.revertCount ?? (item.reverted ? 1 : 0)}</span>
          </span>
        </button>
        {item.status === "done" && (
          <button
            type="button"
            className="rv-approve"
            onClick={() => status("approved")}
          >
            Approve
          </button>
        )}
      </div>
      <div className="rv-card-actions">
        {!draft && (
          <button
            type="button"
            className="rv-reply-toggle"
            aria-expanded={replies}
            onClick={() => setReplies(!replies)}
          >
            <DesignIcon name="imgFiRrAngleSmallRight" size={12} />
            Comments ({item.replies?.length ?? 0})
          </button>
        )}
        <div className="rv-labels" ref={paletteRef}>
          {!draft && (
            <button
              type="button"
              className="rv-add-label"
              title="Manage color labels"
              aria-label="Manage color labels"
              aria-expanded={palette}
              onClick={() => setPalette(!palette)}
            >
              <DesignIcon name="imgFiRrPlus" size={9} />
            </button>
          )}
          <span
            className="rv-color-label rv-pin-label"
            role="img"
            aria-label={pinLabel}
            title={pinLabel}
            style={{ backgroundColor: feedbackPinColor(item) }}
          >
            <UserRound size={10} aria-hidden="true" />
          </span>
          {!draft &&
            labels.map((name) => {
              const color = feedbackColors.find((c) => c.name === name);
              return (
                color && (
                  <button
                    type="button"
                    key={name}
                    className="rv-color-label"
                    style={{ backgroundColor: color.hex }}
                    aria-label={`Remove ${name.toLowerCase()} label`}
                    title={`Remove ${name.toLowerCase()} label`}
                    onClick={() => toggleLabel(name)}
                  />
                )
              );
            })}
          {palette && (
            <fieldset className="rv-menu rv-palette" aria-label="Color labels">
              {feedbackColors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  aria-pressed={labels.includes(color.name)}
                  onClick={() => toggleLabel(color.name)}
                >
                  <span style={{ backgroundColor: color.hex }} />
                  {color.name}
                  {labels.includes(color.name) && <Check size={12} />}
                </button>
              ))}
            </fieldset>
          )}
        </div>
      </div>
      {replies && !draft && (
        <div className="rv-replies">
          {item.replies?.map((r, i) => (
            <p key={`${i}-${r.author}`}>
              <strong>{r.author}</strong>
              {r.text}
            </p>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendReply();
            }}
          >
            <input
              aria-label="Reply"
              value={reply}
              placeholder="Write a reply…"
              onChange={(e) => setReply(e.target.value)}
            />
            <button
              type="submit"
              className="rv-icon"
              disabled={!reply.trim()}
              aria-label="Send reply"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export function ImageViewer({ id, close }: { id: string; close: () => void }) {
  const image = useMediaUrl(id);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    return () => current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="rv-image-dialog"
      aria-label="Full feedback image"
      onCancel={close}
    >
      <button type="button" onClick={close} aria-label="Close image">
        <X size={18} />
      </button>
      {image ? (
        // biome-ignore lint/performance/noImgElement: Feedback attachments are browser-local object URLs.
        <img src={image} alt="Full feedback attachment" />
      ) : (
        <p>Loading image…</p>
      )}
    </dialog>
  );
}
