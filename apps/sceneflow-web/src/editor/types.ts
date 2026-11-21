export type Stage = "Not Set" | "Block" | "Animatics" | "Polished" | "Complete";
export type Version = {
  id: string;
  mediaId: string;
  width?: number;
  height?: number;
  filename: string;
  duration: number;
  stage: Stage;
  thumbnail: string;
  author: string;
  created: number;
};
export type Clip = {
  id: string;
  name: string;
  layerId: string;
  parentId: string | null;
  hidden?: boolean;
  start: number;
  length: number;
  offset: number;
  versions: Version[];
  active: string;
  edited: number;
  editor: string;
};
export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};
export type Feedback = {
  id: string;
  clipId: string;
  versionId: string;
  sourceTime: number;
  author: string;
  text: string;
  status: "draft" | "pending" | "done" | "approved";
  reverted?: boolean;
  revertCount?: number;
  colorLabels?: string[];
  image?: string;
  audio?: string;
  kind: "text" | "voice" | "drawing";
  created: number;
  replies?: { author: string; text: string }[];
};
export type Activity = {
  id: string;
  action: string;
  message: string;
  author: string;
  created: number;
  clipId?: string;
  feedbackId?: string;
};
export type Project = {
  title: string;
  layers: Layer[];
  clips: Clip[];
  shots: Record<string, Record<string, string>>;
  feedback: Feedback[];
  activity: Activity[];
};
// Layers are ordered bottom to top. The base layer always has id "parent". Times are seconds.
export type Edit = (
  action: string,
  message: string,
  change: (draft: Project) => void,
  checkpoint?: boolean,
  clipId?: string,
  feedbackId?: string,
) => void;
export type DropTarget = {
  kind: "cell" | "new-layer" | "version" | "insert";
  layerId: string;
  time: number;
  clipId?: string;
  parentId?: string;
  side?: "left" | "right";
};
export type Command =
  | "delete"
  | "undo"
  | "redo"
  | "split"
  | "trim-left"
  | "trim-right"
  | "add-left"
  | "add-right"
  | "snap"
  | "magnet"
  | "rearrange"
  | "slip";
export const currentVersion = (clip: Clip) =>
  clip.versions.find((v) => v.id === clip.active) ?? clip.versions[0];
export const stages: Stage[] = [
  "Not Set",
  "Block",
  "Animatics",
  "Polished",
  "Complete",
];
export function timecode(seconds: number) {
  const f = Math.max(0, Math.round(seconds * 24));
  return [Math.floor(f / 1440), Math.floor(f / 24) % 60, f % 24]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
export function emptyProject(): Project {
  return {
    title: "Untitled project",
    layers: [
      { id: "parent", name: "Storyboard", visible: true, locked: false },
    ],
    clips: [],
    shots: {},
    feedback: [],
    activity: [],
  };
}
