import { useEffect, useState } from "react";
import { mediaUrl } from "./storage";
import { frame } from "./timelineEdits";
import type { Clip, Feedback } from "./types";

const colors = [
  "#177c76",
  "#8757a8",
  "#396bb6",
  "#ac5736",
  "#ae496e",
  "#577936",
  "#7061ae",
  "#986d2e",
];

export function reviewAuthorColor(author: string) {
  let index = 0;
  for (const character of author)
    index = (index * 31 + character.charCodeAt(0)) >>> 0;
  return colors[index % colors.length];
}

export function feedbackPinColor(item: Feedback) {
  return item.status === "draft" ? "#858c94" : reviewAuthorColor(item.author);
}

export function timelinePins(clips: Clip[], feedback: Feedback[]) {
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  return feedback
    .flatMap((item) => {
      const clip = byId.get(item.clipId);
      if (
        !clip ||
        item.versionId !== clip.active ||
        item.sourceTime < clip.offset ||
        item.sourceTime >= frame(clip.offset + clip.length)
      )
        return [];
      return [
        { time: frame(clip.start + item.sourceTime - clip.offset), item },
      ];
    })
    .sort(
      (a, b) =>
        a.time - b.time ||
        a.item.created - b.item.created ||
        a.item.id.localeCompare(b.item.id),
    );
}

export function initials(author: string) {
  return (
    author
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function sourceAt(clip: Clip, time: number) {
  return clip.offset + Math.max(0, time - clip.start);
}

export function onFeedbackFrame(
  feedback: Feedback,
  clip: Clip | undefined,
  time: number,
) {
  return (
    !!clip &&
    feedback.clipId === clip.id &&
    feedback.versionId === clip.active &&
    Math.round(feedback.sourceTime * 24) ===
      Math.round(sourceAt(clip, time) * 24)
  );
}

export function useMediaUrl(id?: string) {
  const [resolved, setResolved] = useState({ id: "", url: "" });
  useEffect(() => {
    if (!id) return;
    let live = true;
    mediaUrl(id)
      .then((url) => {
        if (live) setResolved({ id, url });
      })
      .catch(() => {
        if (live) setResolved({ id, url: "" });
      });
    return () => {
      live = false;
    };
  }, [id]);
  return id === resolved.id ? resolved.url : "";
}
