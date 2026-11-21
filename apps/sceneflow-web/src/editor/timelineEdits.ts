import type { Clip, Command, DropTarget, Project } from "./types";

export const fps = 24;
export const frame = (seconds: number) => Math.round(seconds * fps) / fps;
export const end = (clip: Pick<Clip, "start" | "length">) =>
  frame(clip.start + clip.length);
const active = (clip: Clip) => clip.versions.find((v) => v.id === clip.active);
const ordered = (clips: Clip[]) =>
  [...clips].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
const track = (p: Project, layer: string) =>
  ordered(p.clips.filter((c) => c.layerId === layer));

export function clipRange(project: Project, from: Clip, to: Clip): string[] {
  const rows = project.layers.map((l) => l.id);
  const a = rows.indexOf(from.layerId),
    b = rows.indexOf(to.layerId);
  const layers = new Set(rows.slice(Math.min(a, b), Math.max(a, b) + 1));
  const start = Math.min(from.start, to.start);
  const finish = Math.max(end(from), end(to));
  return ordered(
    project.clips.filter(
      (c) => layers.has(c.layerId) && c.start < finish && end(c) > start,
    ),
  ).map((c) => c.id);
}

function unlocked(p: Project, layer: string) {
  const l = p.layers.find((l) => l.id === layer);
  if (!l || l.locked)
    throw Error(
      l
        ? `Unlock ${l.name} to make this edit.`
        : "The destination layer no longer exists.",
    );
}
function touch(c: Clip, author: string) {
  c.editor = author;
  c.edited = Date.now();
}
type Block = {
  parent: Clip;
  members: Clip[];
  start: number;
  finish: number;
};

export function shotBlocks(clips: Clip[]): Block[] {
  const byId = new Map(
    ordered(clips.filter((c) => c.layerId === "parent")).map((parent) => [
      parent.id,
      { parent, members: [parent], start: parent.start, finish: end(parent) },
    ]),
  );
  for (const c of clips) {
    const block = c.parentId && byId.get(c.parentId);
    if (!block || c.layerId === "parent") continue;
    block.members.push(c);
    block.start = Math.min(block.start, c.start);
    block.finish = Math.max(block.finish, end(c));
  }
  return [...byId.values()];
}

export function shotColumns(clips: Clip[]) {
  return shotBlocks(clips).map(({ parent, start, finish }) => ({
    ...parent,
    start,
    length: frame(finish - start),
  }));
}

function shiftBlock(p: Project, block: Block, start: number, author?: string) {
  const delta = frame(start - block.start);
  if (!delta) return;
  if (author !== undefined)
    for (const c of block.members) unlocked(p, c.layerId);
  for (const c of block.members) {
    c.start = frame(c.start + delta);
    if (author !== undefined) touch(c, author);
  }
  block.start = start;
  block.finish = frame(block.finish + delta);
}

function ripple(p: Project, blocks: Block[], cursor: number, author?: string) {
  for (const block of blocks) {
    if (block.start < cursor) shiftBlock(p, block, cursor, author);
    cursor = block.finish;
  }
}

export function fitBlocks(p: Project, author?: string) {
  ripple(p, shotBlocks(p.clips), 0, author);
}

// Reserve room on one lane inside a shot. Its other layers keep their local offsets.
export function makeRoom(
  p: Project,
  layer: string,
  start: number,
  length: number,
  author: string,
  parentId?: string,
  ignoreId?: string,
) {
  if (layer === "parent") {
    const blocks = shotBlocks(p.clips).filter((b) => b.finish > start);
    ripple(p, blocks, frame(start + length), author);
    return;
  }
  let cursor = frame(start + length);
  for (const c of track(p, layer)) {
    if (c.parentId !== parentId || c.id === ignoreId || end(c) <= start)
      continue;
    if (c.start >= cursor) break;
    unlocked(p, layer);
    c.start = cursor;
    touch(c, author);
    cursor = end(c);
  }
}

export function checkTracks(p: Project) {
  const blocks = shotBlocks(p.clips);
  const parentIds = new Set(blocks.map((b) => b.parent.id));
  for (const c of p.clips)
    if (c.layerId !== "parent" && (!c.parentId || !parentIds.has(c.parentId)))
      throw Error("Choose a parent for every child clip.");
  for (let i = 1; i < blocks.length; i++)
    if (blocks[i].start < blocks[i - 1].finish)
      throw Error("Shot blocks would overlap.");
  for (const l of p.layers) {
    const clips = track(p, l.id);
    for (let i = 1; i < clips.length; i++) {
      if (clips[i].start < end(clips[i - 1]))
        throw Error(
          `The edit would overlap clips on ${l.name}. Make space there first.`,
        );
    }
  }
}

export function commandReason(
  cmd: Command,
  p: Project,
  ids: string[],
  time: number,
  canUndo: boolean,
  canRedo: boolean,
  layerId?: string,
) {
  if (cmd === "undo") return canUndo ? "" : "No earlier edit to undo.";
  if (cmd === "redo") return canRedo ? "" : "No edit to redo.";
  if (cmd === "snap") return "";
  const selected = p.clips.filter((c) => ids.includes(c.id));
  if (cmd === "add-left" || cmd === "add-right") {
    const layer = p.layers.find(
      (l) => l.id === (selected[0]?.layerId ?? layerId ?? "parent"),
    );
    if (layer?.locked) return `Unlock ${layer.name} to add a clip.`;
    return selected.length > 1 ? "Choose one clip or layer for insertion." : "";
  }
  if (!selected.length) return "Select a clip first.";
  const single = ["split", "trim-left", "trim-right", "slip"].includes(cmd);
  if (single && selected.length !== 1) return "Select exactly one clip.";
  const affected =
    cmd === "delete"
      ? [
          ...selected,
          ...p.clips.filter((c) => c.parentId && ids.includes(c.parentId)),
        ]
      : selected;
  const locked = p.layers.find(
    (l) => l.locked && affected.some((c) => c.layerId === l.id),
  );
  if (locked) return `Unlock ${locked.name} to make this edit.`;
  const c = selected[0];
  if (single && !active(c)) return "The active version is unavailable.";
  if (cmd === "slip")
    return maxSlipFrames(c) > 0
      ? ""
      : "Slip needs source footage longer than the clip.";
  if (single) {
    const cut = frame(time);
    if (cut <= c.start || cut >= end(c))
      return "Place the playhead inside the selected clip.";
    if (
      cmd !== "trim-right" &&
      frame(c.offset + cut - c.start) >= (active(c)?.duration ?? 0)
    )
      return "Place the playhead within this version’s source footage.";
  }
  return "";
}
export function canCommand(
  cmd: Command,
  project: Project,
  selected: string[],
  time: number,
  canUndo: boolean,
  canRedo: boolean,
  layerId?: string,
) {
  return !commandReason(
    cmd,
    project,
    selected,
    time,
    canUndo,
    canRedo,
    layerId,
  );
}

export function editRange(
  p: Project,
  id: string,
  cmd: "split" | "trim-left" | "trim-right",
  time: number,
  author: string,
) {
  const reason = commandReason(cmd, p, [id], time, false, false);
  if (reason) throw Error(reason);
  const c = p.clips.find((c) => c.id === id);
  if (!c) throw Error("The selected clip is unavailable.");
  const cut = frame(time);
  const left = frame(cut - c.start);
  const right = frame(c.length - left);
  const offset = frame(c.offset + left);
  if (cmd === "split") {
    const next = {
      ...structuredClone(c),
      id: crypto.randomUUID(),
      start: cut,
      length: right,
      offset,
    };
    touch(next, author);
    p.clips.push(next);
    for (const f of p.feedback)
      if (f.clipId === c.id && f.sourceTime >= offset) f.clipId = next.id;
  }
  if (cmd === "trim-left")
    Object.assign(c, { start: cut, length: right, offset });
  else c.length = left;
  touch(c, author);
  if (cmd === "split" && c.layerId === "parent") fitBlocks(p, author);
}

export function deleteClips(p: Project, ids: string[]) {
  const removed = p.clips.filter(
    (c) => ids.includes(c.id) || (c.parentId && ids.includes(c.parentId)),
  );
  if (!removed.length) throw Error("Select a clip first.");
  for (const c of removed) unlocked(p, c.layerId);
  const removedIds = new Set(removed.map((c) => c.id));
  p.feedback = p.feedback.filter((f) => !removedIds.has(f.clipId));
  p.clips = p.clips.filter((c) => !removed.includes(c));
}
export function maxSlipFrames(clip: Clip) {
  return Math.max(
    0,
    Math.floor(((active(clip)?.duration ?? 0) - clip.length) * fps + 1e-7),
  );
}

export function slip(p: Project, id: string, start: number, author: string) {
  const c = p.clips.find((c) => c.id === id);
  if (!c) throw Error("Select a clip first.");
  unlocked(p, c.layerId);
  const max = maxSlipFrames(c) / fps;
  if (
    max <= 0 ||
    !Number.isFinite(start) ||
    frame(start) < 0 ||
    frame(start) > max
  )
    throw Error("The source interval must fit within the original footage.");
  c.offset = frame(start);
  touch(c, author);
}

export function snapAll(p: Project, ids: string[], author: string) {
  const selected = new Set(
    p.clips.filter((c) => ids.includes(c.id)).map((c) => c.parentId ?? c.id),
  );
  let cursor: number | undefined;
  let changed = false;
  for (const block of shotBlocks(p.clips)) {
    if (!selected.has(block.parent.id)) {
      cursor = undefined;
      continue;
    }
    if (cursor !== undefined && cursor < block.start) {
      shiftBlock(p, block, cursor, author);
      changed = true;
    }
    cursor = block.finish;
  }
  if (!changed) throw Error("The selected shots have no gaps to close.");
  checkTracks(p);
}

function applyBlockOrder(
  p: Project,
  original: Block[],
  proposed: Block[],
  author: string,
) {
  const slots = original.map((b) => b.start);
  let cursor = 0;
  for (const [index, block] of proposed.entries()) {
    shiftBlock(p, block, Math.max(slots[index], cursor), author);
    cursor = block.finish;
  }
}

export function rearrange(p: Project, ids: string[], author: string) {
  const blocks = shotBlocks(p.clips);
  const selected = new Set(ids);
  const chosen = blocks.filter((b) =>
    b.members.some((c) => selected.has(c.id)),
  );
  if (!chosen.length) throw Error("Select a shot or a child to rearrange.");
  const remaining = blocks.filter((b) => !chosen.includes(b));
  const originalIndex = new Map(blocks.map((b, i) => [b, i]));
  const compare = (a: Block, b: Block) =>
    a.parent.name.localeCompare(b.parent.name, "en", { numeric: true }) ||
    (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  for (const block of chosen.sort(compare)) {
    const next = remaining.findIndex((other) => compare(other, block) > 0);
    remaining.splice(next < 0 ? remaining.length : next, 0, block);
  }
  if (remaining.every((b, i) => b === blocks[i]))
    throw Error("The selected shots are already in filename order.");
  applyBlockOrder(p, blocks, remaining, author);
  checkTracks(p);
}

// Reserve the selected intervals first. A noncontiguous selection can still have
// room for an unselected shot between two of its members at the destination.
function placeSelection(
  p: Project,
  moving: Block[],
  others: Block[],
  start: number,
  author: string,
  insert: boolean,
  swap?: Block,
) {
  const first = moving[0].start;
  if (swap && first < swap.start)
    start = Math.max(start, frame(first + swap.finish - swap.start));
  const delta = frame(start - first);
  const positions = new Map<Block, number>(
    moving.map((b) => [b, frame(b.start + delta)]),
  );
  // Edge insertion puts the entire selection on the indicated side of the target.
  const reservations = insert
    ? [{ start: first, finish: moving[moving.length - 1].finish }]
    : moving;
  const requested = (b: Block) => (b === swap ? first : b.start);
  let cursor = 0,
    reserved = 0;
  for (const block of others.sort((a, b) => requested(a) - requested(b))) {
    let at = Math.max(requested(block), cursor);
    const length = frame(block.finish - block.start);
    while (reserved < reservations.length) {
      const occupied = reservations[reserved];
      if (frame(at + length) <= frame(occupied.start + delta)) break;
      at = Math.max(at, frame(occupied.finish + delta));
      reserved++;
    }
    positions.set(block, at);
    cursor = frame(at + length);
  }
  for (const [block, at] of positions) {
    if (at !== block.start)
      for (const member of block.members) unlocked(p, member.layerId);
  }
  for (const [block, at] of positions) shiftBlock(p, block, at, author);
}

function moveSelectedLayers(
  p: Project,
  selected: Set<string>,
  lead: Clip,
  layer: string,
  target: Clip | undefined,
  author: string,
) {
  if (lead.layerId === layer) return;
  const rows = p.layers.map((l) => l.id);
  const delta = rows.indexOf(layer) - rows.indexOf(lead.layerId);
  const moves = new Map<Clip, string>();
  for (const c of p.clips) {
    if (!selected.has(c.id) || c.layerId === "parent") continue;
    const next = rows[rows.indexOf(c.layerId) + delta];
    if (!next || next === "parent")
      throw Error("Choose a destination with room for all selected layers.");
    unlocked(p, c.layerId);
    unlocked(p, next);
    moves.set(c, next);
  }
  if (target) moves.set(target, lead.layerId);
  // A center swap can exchange shot positions even if another sibling occupies the desired lane.
  if (
    target &&
    [...moves].some(([c, next]) =>
      p.clips.some(
        (other) =>
          other !== c &&
          (moves.get(other) ?? other.layerId) === next &&
          other.start < end(c) &&
          end(other) > c.start,
      ),
    )
  )
    return;
  for (const [c, next] of moves) {
    c.layerId = next;
    touch(c, author);
  }
}

export function moveClip(
  p: Project,
  id: string,
  target: DropTarget,
  author: string,
  selection: readonly string[] = [id],
) {
  const c = p.clips.find((c) => c.id === id);
  if (!c) throw Error("The dragged clip is unavailable.");
  const selected = new Set([...selection, id]);
  const blocks = shotBlocks(p.clips);
  const moving = blocks.filter((block) =>
    block.members.some((member) => selected.has(member.id)),
  );
  if (!moving.length) throw Error("The source shot is unavailable.");
  for (const member of p.clips)
    if (selected.has(member.id)) unlocked(p, member.layerId);
  const other = p.clips.find((o) => o.id === target.clipId);
  const dest = blocks.find(
    (b) => b.parent.id === (other?.parentId ?? other?.id ?? target.parentId),
  );
  const swapping = target.kind === "version";
  if (swapping && (!other || !dest)) throw Error("Choose a clip to swap with.");
  const sameShot = dest && moving.includes(dest);
  if (
    other &&
    sameShot &&
    !(swapping && selected.size === 1 && c.layerId !== other.layerId)
  )
    throw Error("Choose a shot outside the selection.");
  if (
    (target.layerId === "parent" && target.kind !== "new-layer") !==
    (c.layerId === "parent")
  )
    throw Error(
      "Keep parent clips on the parent layer and children on upper layers.",
    );
  let layer = target.layerId;
  if (target.kind === "new-layer") {
    const index = p.layers.findIndex((l) => l.id === layer);
    if (index < 0) throw Error("The destination layer is unavailable.");
    layer = crypto.randomUUID();
    p.layers.splice(index + 1, 0, {
      id: layer,
      name: "new layer",
      visible: true,
      locked: false,
    });
  }
  unlocked(p, layer);
  const first = moving[0];
  if (swapping && dest && moving.length === 1) {
    const proposed = [...blocks];
    proposed[blocks.indexOf(first)] = dest;
    proposed[blocks.indexOf(dest)] = first;
    applyBlockOrder(p, blocks, proposed, author);
  } else {
    const others = blocks.filter((b) => !moving.includes(b));
    let at = Math.max(0, frame(target.time - (c.start - first.start)));
    if (dest && (swapping || target.kind === "insert")) {
      at = target.side === "right" ? dest.finish : dest.start;
    } else {
      const inside = others.find((b) => b.start < at && at < b.finish);
      if (inside)
        at =
          at - inside.start < inside.finish - at ? inside.start : inside.finish;
    }
    placeSelection(
      p,
      moving,
      others,
      at,
      author,
      target.kind === "insert",
      swapping ? dest : undefined,
    );
  }
  moveSelectedLayers(
    p,
    selected,
    c,
    layer,
    swapping ? other : undefined,
    author,
  );
  checkTracks(p);
}

// Older projects allowed detached children and overlapping shots. Repair the loaded
// copy, retaining clip IDs, source ranges, versions, pins and existing checkpoints.
export function normalizeShotBlocks(p: Project) {
  let parents = track(p, "parent");
  if (!parents.length && p.clips.length) {
    const first = p.layers.find((l) => p.clips.some((c) => c.layerId === l.id));
    for (const c of p.clips.filter((c) => c.layerId === first?.id)) {
      c.layerId = "parent";
      c.parentId = null;
    }
    parents = track(p, "parent");
  }
  for (const c of p.clips) {
    if (
      c.layerId === "parent" ||
      parents.some((parent) => parent.id === c.parentId)
    )
      continue;
    const parent =
      parents.find((p) => p.start <= c.start && c.start < end(p)) ??
      parents.find((p) => p.name === c.name) ??
      parents.reduce((best, p) =>
        Math.abs(p.start - c.start) < Math.abs(best.start - c.start) ? p : best,
      );
    c.parentId = parent.id;
    if (c.start < parent.start || c.start >= end(parent))
      c.start = parent.start;
  }
  for (const b of shotBlocks(p.clips)) {
    const lanes = new Map<string, number>();
    for (const c of ordered(b.members)) {
      c.start = Math.max(c.start, lanes.get(c.layerId) ?? 0);
      lanes.set(c.layerId, end(c));
    }
  }
  fitBlocks(p);
}
