import type { AskImport } from "./mediaDialog";
import {
  checkTracks,
  end,
  fitBlocks,
  fps,
  frame,
  makeRoom,
  shotBlocks,
} from "./timelineEdits";
import {
  type Clip,
  currentVersion,
  type DropTarget,
  type Project,
  timecode,
  type Version,
} from "./types";

function shotName(scene: string, shot: string) {
  return [scene, shot]
    .map((value) => value.replace(/^0+(?=\d)/, "").padStart(2, "0"))
    .join("_");
}

export function filenameShots(filename: string): string[] {
  const stem = filename
    .replace(/\.[^.]*$/, "")
    .replace(
      /(?<![a-z])(?:version|ver|v|take|tk|episode|ep|sequence|seq|sq)[._\s-]*\d+/gi,
      " ",
    )
    .replace(
      /(?<![a-z])(?:scene|sc|s)[._\s-]*(\d+)[._\s-]*(?:shot|sh)[._\s-]*(\d+)/gi,
      " $1_$2 ",
    )
    // A number inside a production prefix belongs to that word. In
    // "KHP04_01_04", the two standalone numbers form the shot name.
    .replace(/([a-z]\d+)[_-](?=\d{2,}_\d{2,}(?!\d))/gi, "$1 ");
  const names = new Set<string>();
  // Isolate SCENE_SHOT groups so a neighboring hyphenated counter cannot
  // borrow one of their numbers. Standalone hyphenated shot names also work.
  for (const segment of stem.split(/(\d+(?:_\d+)+)/)) {
    for (const [run] of segment.matchAll(/\d+(?:[_-]\d+)+/g)) {
      const numbers = run.split(/[_-]/);
      // Complete pairs are read left to right. With an odd group such as
      // 01_02_03, either adjacent pair could be the intended identifier.
      const step = numbers.length % 2 === 0 ? 2 : 1;
      for (let i = 0; i + 1 < numbers.length; i += step)
        names.add(shotName(numbers[i], numbers[i + 1]));
    }
  }
  return [...names];
}

export async function resolveShot(filename: string, ask: AskImport) {
  const candidates = filenameShots(filename);
  if (candidates.length === 1) return candidates[0];
  const answer = await ask({
    kind: "shot",
    title: "Identify the shot",
    description: candidates.length
      ? `${filename} contains several possible matches. Choose one or enter the scene and shot.`
      : `Enter the scene and shot numbers for ${filename}.`,
    options: candidates.map((value) => ({ value, label: value })),
  });
  const match = /^(\d+)_(\d+)$/.exec(answer);
  if (!match) throw new Error("Enter a whole number for both scene and shot.");
  return shotName(match[1], match[2]);
}

async function chooseParent(
  name: string,
  parents: Clip[],
  ask: AskImport,
): Promise<Clip> {
  const matches = parents.filter((p) => p.name === name);
  if (matches.length === 1) return matches[0];
  const options = matches.length ? matches : parents;
  const answer = await ask({
    kind: "parent",
    title: `Choose a parent for ${name}`,
    description: matches.length
      ? `Several parent clips are named ${name}. Choose where to align this clip on the timeline.`
      : `The timeline has no parent named ${name}. Choose another parent to own this clip.`,
    options: [
      ...options.map((p) => ({
        value: p.id,
        label: `${p.name} at ${timecode(p.start)}`,
      })),
    ],
  });
  const parent = options.find((p) => p.id === answer);
  if (!parent) throw Error("Choose a parent for this clip.");
  return parent;
}

export type Intake = { name: string; version: Version };
const placementLength = (duration: number) =>
  Math.max(1 / fps, frame(duration));

async function versionLength(
  clip: Clip,
  version: Version,
  ask: AskImport,
): Promise<number> {
  const length = placementLength(version.duration);
  if (frame(clip.length) === length) return clip.length;
  const decision = await ask({
    kind: "choose",
    title: "Set replacement duration",
    description: `${version.filename} has a different duration from the current placement of ${clip.name}.`,
    options: [
      {
        value: "keep",
        label: "Keep Existing Length",
        detail: `Keep the existing ${timecode(clip.length)} on the timeline.`,
      },
      {
        value: "source",
        label: "Adopt New Duration",
        detail: `Use the replacement’s full ${timecode(length)} duration.`,
      },
    ],
  });
  return decision === "keep" ? clip.length : length;
}

// Resolve an edge against its original clip so hover and import reserve the same shot.
export function intakePosition(p: Project, target: DropTarget) {
  const blocks = shotBlocks(p.clips);
  const anchor = p.clips.find((c) => c.id === target.clipId);
  const block =
    blocks.find(
      (b) =>
        b.parent.id === (anchor?.parentId ?? anchor?.id ?? target.parentId),
    ) ?? blocks.find((b) => b.start <= target.time && target.time < b.finish);
  let start = Math.max(0, frame(target.time));
  if (target.layerId === "parent") {
    if (block)
      start =
        target.kind === "insert" && target.side === "right"
          ? block.finish
          : block.start;
  } else if (anchor)
    start = target.side === "right" ? end(anchor) : anchor.start;
  else if (block) start = block.start;
  return { start, block };
}

/** Operates on a private draft. Prompts and collision checks finish before persistence. */
export async function placeIntake(
  p: Project,
  target: DropTarget,
  intake: Intake[],
  author: string,
  ask: AskImport,
) {
  const index = p.layers.findIndex((l) => l.id === target.layerId);
  if (index < 0) throw new Error("The destination layer no longer exists.");
  const base = p.layers[index];
  if (base.locked && target.kind !== "new-layer")
    throw new Error(`Unlock ${base.name} before importing video.`);
  const anchor = target.clipId
    ? p.clips.find((c) => c.id === target.clipId && c.layerId === base.id)
    : undefined;
  if (target.clipId && !anchor)
    throw new Error("The destination clip no longer exists.");
  if (target.kind === "version") {
    if (!anchor || intake.length !== 1)
      throw new Error("Choose one video to add a clip version.");
    const { version } = intake[0];
    const length = await versionLength(anchor, version, ask);
    if (length > anchor.length && anchor.parentId)
      makeRoom(
        p,
        base.id,
        anchor.start,
        length,
        author,
        anchor.parentId,
        anchor.id,
      );
    anchor.versions.push(version);
    anchor.active = version.id;
    anchor.length = length;
    anchor.offset = 0;
    anchor.editor = author;
    anchor.edited = version.created;
    fitBlocks(p, author);
    checkTracks(p);
    return;
  }

  const parents = p.clips
    .filter((c) => c.layerId === "parent")
    .sort((a, b) => a.start - b.start);
  // The first batch establishes storyboard parents, including a drop above an empty timeline.
  const layer = !parents.length
    ? p.layers.find((l) => l.id === "parent")
    : target.kind === "new-layer"
      ? {
          id: crypto.randomUUID(),
          name: "new layer",
          visible: true,
          locked: false,
        }
      : base;
  if (!layer) throw Error("The storyboard layer is unavailable.");
  if (layer.locked) throw Error(`Unlock ${layer.name} before importing video.`);
  if (!p.layers.includes(layer)) p.layers.splice(index + 1, 0, layer);
  const placement = intakePosition(p, target);
  let cursor = parents.length ? placement.start : 0;
  const ordered = [...intake].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en", { numeric: true }) ||
      a.version.filename.localeCompare(b.version.filename, "en", {
        numeric: true,
      }),
  );
  const claimed = new Set<string>();
  for (const [i, { name, version }] of ordered.entries()) {
    let parent: Clip | undefined;
    if (layer.id !== "parent") {
      if (target.kind === "new-layer")
        parent = await chooseParent(name, parents, ask);
      else {
        const at = shotBlocks(p.clips).find(
          (b) => b.start <= cursor && cursor < b.finish,
        );
        parent =
          (i === 0 ? placement.block?.parent : undefined) ??
          at?.parent ??
          (await chooseParent(name, parents, ask));
      }
    }
    if (target.kind === "new-layer" && parent && claimed.has(parent.id))
      throw Error(
        `Two videos need the same cell in ${parent.name}. Add the second as a version or on another layer.`,
      );
    if (parent) claimed.add(parent.id);
    const block =
      parent && shotBlocks(p.clips).find((b) => b.parent.id === parent.id);
    const start =
      block &&
      (target.kind === "new-layer" ||
        cursor < block.start ||
        cursor > block.finish)
        ? block.start
        : cursor;
    let length = placementLength(version.duration);
    if (
      parent &&
      block &&
      (target.kind === "cell" || target.kind === "new-layer")
    ) {
      const cellLength = frame(block.finish - start);
      if (cellLength > 0 && length > cellLength) {
        const decision = await ask({
          kind: "choose",
          title: "Set child clip length",
          description: `${version.filename} is longer than the available cell in parent ${parent.name}.`,
          options: [
            {
              value: "keep",
              label: "Keep Cell Length",
              detail: `Place ${timecode(cellLength)} on the timeline. Use Slip to choose which part of the source appears.`,
            },
            {
              value: "source",
              label: "Use Source Duration",
              detail: `Place the entire ${timecode(length)} video on this layer.`,
            },
          ],
        });
        if (decision === "keep") length = cellLength;
      }
    }
    const clip: Clip = {
      id: crypto.randomUUID(),
      name,
      layerId: layer.id,
      parentId: parent?.id ?? null,
      start,
      length,
      offset: 0,
      versions: [version],
      active: version.id,
      edited: version.created,
      editor: author,
    };
    makeRoom(p, layer.id, start, length, author, parent?.id);
    p.clips.push(clip);
    fitBlocks(p, author);
    cursor = end(clip);
    p.shots[clip.name] ??= {};
  }
  checkTracks(p);
}

export function visibleAt(project: Project, time: number): Clip | undefined {
  for (let index = project.layers.length - 1; index >= 0; index--) {
    const layer = project.layers[index];
    if (!layer.visible) continue;
    const clip = project.clips.find((c) => {
      if (
        c.hidden ||
        c.layerId !== layer.id ||
        time < c.start ||
        time >= c.start + c.length
      )
        return false;
      const version = currentVersion(c);
      const sourceTime = time - c.start + c.offset;
      return version && sourceTime >= 0 && sourceTime < version.duration;
    });
    if (clip) return clip;
  }
}

export type RenderSpan = {
  start: number;
  end: number;
  clip?: Clip;
  offset: number;
};

export function renderSpans(project: Project, selected?: Clip): RenderSpan[] {
  const projectEnd = selected
    ? selected.length
    : project.clips.reduce((t, c) => Math.max(t, c.start + c.length), 0);
  if (selected) {
    const available = Math.max(
      0,
      Math.min(
        selected.length,
        currentVersion(selected).duration - selected.offset,
      ),
    );
    const spans: RenderSpan[] = [];
    if (available > 0)
      spans.push({
        start: 0,
        end: available,
        clip: selected,
        offset: selected.offset,
      });
    if (available < projectEnd)
      spans.push({ start: available, end: projectEnd, offset: 0 });
    return spans;
  }
  const boundaries = new Set([0, projectEnd]);
  for (const clip of project.clips) {
    boundaries.add(clip.start);
    boundaries.add(
      clip.start +
        Math.max(
          0,
          Math.min(clip.length, currentVersion(clip).duration - clip.offset),
        ),
    );
  }
  const times = [...boundaries].sort((a, b) => a - b);
  const spans: RenderSpan[] = [];
  for (let index = 0; index + 1 < times.length; index++) {
    const start = times[index],
      end = times[index + 1];
    const clip = visibleAt(project, start + (end - start) / 2);
    const previous = spans.at(-1);
    if (previous && previous.clip?.id === clip?.id) previous.end = end;
    else
      spans.push({
        start,
        end,
        clip,
        offset: clip ? clip.offset + start - clip.start : 0,
      });
  }
  return spans;
}
