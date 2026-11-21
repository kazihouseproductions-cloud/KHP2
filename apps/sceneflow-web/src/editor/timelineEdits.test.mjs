import assert from "node:assert/strict";
import test from "node:test";
import {
  canCommand,
  checkTracks,
  clipRange,
  deleteClips,
  editRange,
  makeRoom,
  moveClip,
  normalizeShotBlocks,
  rearrange,
  slip,
  snapAll,
} from "./timelineEdits.ts";

const source = { id: "v1", duration: 16 };
const clip = (
  id,
  start,
  length = 2,
  layerId = "parent",
  parentId = null,
  name = id,
) => ({
  id,
  start,
  length,
  layerId,
  parentId,
  name,
  offset: 0,
  active: "v1",
  versions: [{ ...source }],
});
const project = (...clips) => ({
  clips,
  layers: ["parent", "upper", "top"].map((id) => ({
    id,
    name: id,
    locked: false,
    visible: true,
  })),
  feedback: [],
});
const centers = (id, layerId = "parent") => ({
  kind: "version",
  clipId: id,
  layerId,
  time: 0,
});
const at = (p, id) => p.clips.find((c) => c.id === id);
const positions = (p) =>
  Object.fromEntries(p.clips.map((c) => [c.id, c.start]));

test("an unequal parent swap uses free space before shifting later parents and carries their children", () => {
  const p = project(
    clip("a", 0, 5),
    clip("b", 6, 2),
    clip("c", 9),
    clip("d", 13),
    clip("child-a", 1, 1, "upper", "a"),
    clip("child-c", 9, 1, "upper", "c"),
    clip("later", 16, 1, "upper", "d"),
  );
  moveClip(p, "a", centers("b"), "Ann");
  assert.deepEqual(positions(p), {
    a: 6,
    b: 0,
    c: 11,
    d: 13,
    "child-a": 7,
    "child-c": 11,
    later: 16,
  });
});
test("a child swap exchanges both shot blocks and keeps ownership across layers", () => {
  const p = project(
    clip("p", 0),
    clip("q", 6),
    clip("x", 0, 2, "upper", "p"),
    clip("y", 6, 1, "top", "q"),
  );
  moveClip(p, "x", centers("y", "top"), "Ann");
  assert.deepEqual(
    [at(p, "x").layerId, at(p, "x").start, at(p, "x").parentId],
    ["top", 6, "p"],
  );
  assert.deepEqual(
    [at(p, "y").layerId, at(p, "y").start, at(p, "y").parentId],
    ["upper", 0, "q"],
  );
  assert.deepEqual([at(p, "p").start, at(p, "q").start], [6, 0]);
});
test("dragging a child into a gap carries its parent and siblings, including on later deletion", () => {
  const p = project(
    clip("p", 0),
    clip("s", 2),
    clip("x", 0, 2, "upper", "p"),
    clip("y", 2, 2, "upper", "s"),
    clip("z", 0, 1, "top", "p"),
  );
  moveClip(p, "x", { kind: "cell", layerId: "upper", time: 4 }, "Ann");
  assert.deepEqual(positions(p), { p: 4, s: 2, x: 4, y: 2, z: 4 });
  deleteClips(p, ["p"]);
  assert.deepEqual(positions(p), { s: 2, y: 2 });
});
test("insertions shift only until a sufficient gap and preserve parent-child offsets", () => {
  const p = project(
    clip("p", 0, 2),
    clip("q", 2, 4),
    clip("r", 7, 2),
    clip("s", 20),
    clip("child", 3, 1, "upper", "q"),
  );
  makeRoom(p, "parent", 2, 3, "Ann");
  assert.deepEqual(positions(p), { p: 0, q: 5, r: 9, s: 20, child: 6 });
});
test("locked linked children prevent parent movements", () => {
  const p = project(clip("p", 2), clip("c", 3, 1, "upper", "p"));
  p.layers[1].locked = true;
  assert.throws(
    () => moveClip(p, "p", { kind: "cell", layerId: "parent", time: 6 }, "Ann"),
    /Unlock/,
  );
  assert.deepEqual(positions(p), { p: 2, c: 3 });
});
test("splitting remaps feedback at the boundary once and leaves all children in place", () => {
  const p = project(clip("p", 3, 8), clip("c", 5, 4, "upper", "p"));
  at(p, "p").offset = 1;
  p.feedback = [
    { id: "first", clipId: "p", sourceTime: 2 },
    { id: "next", clipId: "p", sourceTime: 4 },
  ];
  editRange(p, "p", "split", 6, "Ann");
  const right = p.clips[2];
  assert.deepEqual(
    [at(p, "p").length, right.start, right.length, right.offset],
    [3, 9, 5, 4],
  );
  assert.deepEqual(
    p.feedback.map((f) => f.clipId),
    ["p", right.id],
  );
  assert.equal(at(p, "c").parentId, "p");
  assert.equal(at(p, "c").start, 5);
  for (const cmd of ["split", "trim-left", "trim-right"])
    assert.equal(canCommand(cmd, p, ["p", "c"], 5, false, false), false);
});
test("directional trims and slip preserve the correct boundaries", () => {
  const p = project(clip("p", 2, 10), clip("c", 2, 4, "upper", "p"));
  editRange(p, "p", "trim-left", 4, "Ann");
  editRange(p, "p", "trim-right", 11, "Ann");
  assert.deepEqual(
    [at(p, "p").start, at(p, "p").length, at(p, "p").offset, at(p, "c").start],
    [4, 7, 2, 2],
  );
  at(p, "p").length = 8;
  at(p, "p").versions[0].duration = 12;
  slip(p, "p", 3, "Ann");
  assert.deepEqual(
    [at(p, "p").start, at(p, "p").offset, at(p, "p").length],
    [4, 3, 8],
  );
  assert.throws(() => slip(p, "p", 5, "Ann"), /fit/);
});
test("magnet closes selected groups independently; carried children only move once", () => {
  const p = project(
    clip("a", 0),
    clip("b", 5),
    clip("wall", 9),
    clip("d", 13),
    clip("e", 18),
    clip("kid", 6, 1, "upper", "b"),
    clip("x", 0, 1, "top", "a"),
    clip("y", 5, 1, "top", "b"),
  );
  snapAll(p, ["a", "b", "d", "e", "kid", "x", "y"], "Ann");
  assert.deepEqual(positions(p), {
    a: 0,
    b: 2,
    wall: 9,
    d: 13,
    e: 15,
    kid: 3,
    x: 0,
    y: 2,
  });
});
test("rearranging a mismatched child orders by its parent's name and carries every sibling", () => {
  const p = project(
    clip("q", 0, 2, "parent", null, "01_02"),
    clip("p", 3, 1, "parent", null, "01_01"),
    clip("child", 3, 4, "upper", "p", "01_02"),
    clip("sibling", 4, 2, "top", "p"),
    clip("other", 0, 1, "upper", "q"),
  );
  rearrange(p, ["child"], "Ann");
  assert.deepEqual(positions(p), {
    p: 0,
    q: 4,
    child: 0,
    sibling: 1,
    other: 4,
  });
  assert.equal(at(p, "child").parentId, "p");
});

test("rearranging selected shots sorts numerically, retains unselected order and moves each block once", () => {
  const p = project(
    clip("01_10", 0),
    clip("01_03", 2),
    clip("01_01", 4),
    clip("01_02", 6),
    clip("child", 0, 2, "upper", "01_10"),
  );
  rearrange(p, ["01_10", "child", "01_02"], "Ann");
  assert.deepEqual(positions(p), {
    "01_10": 6,
    "01_03": 2,
    "01_01": 4,
    "01_02": 0,
    child: 6,
  });
});

test("deleting a parent removes feedback only for its group", () => {
  const p = project(
    clip("p", 0),
    clip("kid", 0, 2, "upper", "p"),
    clip("q", 5, 2),
    clip("other", 5, 2, "upper", "q"),
  );
  p.feedback = ["p", "kid", "other"].map((clipId) => ({
    id: `feedback-${clipId}`,
    clipId,
  }));
  deleteClips(p, ["p"]);
  assert.deepEqual(
    p.feedback.map((f) => f.clipId),
    ["other"],
  );
});

test("insertion follows the selected layer lock even when no clip is selected", () => {
  const p = project();
  p.layers[1].locked = true;
  for (const cmd of ["add-left", "add-right"]) {
    assert.equal(canCommand(cmd, p, [], 0, false, false, "upper"), false);
    assert.equal(canCommand(cmd, p, [], 0, false, false, "parent"), true);
  }
});

test("inserting a child at an edge reserves its entire block and consumes available gaps first", () => {
  const p = project(
    clip("a", 0, 2),
    clip("b", 2, 2),
    clip("c", 7, 2),
    clip("long", 7, 4, "upper", "c"),
    clip("short", 8, 1, "top", "c"),
    clip("b-child", 2, 1, "top", "b"),
  );
  moveClip(
    p,
    "short",
    {
      kind: "insert",
      layerId: "top",
      clipId: "b-child",
      side: "left",
      time: 2,
    },
    "Ann",
  );
  assert.deepEqual(positions(p), {
    a: 0,
    b: 6,
    c: 2,
    long: 2,
    short: 3,
    "b-child": 6,
  });
  checkTracks(p);
});

test("opening an older project restores ownership and resolves cross-column overhangs exactly once", () => {
  const p = project(
    clip("a", 0, 2),
    clip("b", 2, 2),
    clip("old", 0, 5, "top"),
    clip("kid", 2, 2, "upper", "b"),
  );
  normalizeShotBlocks(p);
  assert.equal(at(p, "old").parentId, "a");
  assert.deepEqual(positions(p), { a: 0, b: 5, old: 0, kid: 5 });
  checkTracks(p);
  const saved = structuredClone(p);
  normalizeShotBlocks(p);
  assert.deepEqual(p, saved);
});

test("Shift selects the inclusive range in either direction and respects the endpoint layers", () => {
  const p = project(
    clip("a", 0),
    clip("b", 2),
    clip("c", 4),
    clip("x", 0, 2, "upper", "a"),
    clip("y", 2, 2, "upper", "b"),
    clip("z", 4, 2, "upper", "c"),
    clip("top", 2, 2, "top", "b"),
  );
  assert.deepEqual(clipRange(p, at(p, "c"), at(p, "a")), ["a", "b", "c"]);
  assert.deepEqual(clipRange(p, at(p, "x"), at(p, "z")), ["x", "y", "z"]);
  assert.deepEqual(
    new Set(clipRange(p, at(p, "a"), at(p, "z"))),
    new Set(["a", "b", "c", "x", "y", "z"]),
  );
});

test("dragging a later child translates the selected units and preserves intervening gaps", () => {
  const p = project(
    clip("a", 0),
    clip("b", 2),
    clip("c", 6),
    clip("x", 0, 2, "upper", "a"),
    clip("z", 7, 1, "upper", "c"),
    clip("d", 12),
  );
  moveClip(p, "z", { kind: "cell", layerId: "upper", time: 11 }, "Ann", [
    "a",
    "x",
    "z",
  ]);
  assert.deepEqual(positions(p), { a: 4, x: 4, b: 2, c: 10, z: 11, d: 12 });
  assert.equal(at(p, "z").parentId, "c");
  checkTracks(p);
});

test("an edge drop inserts selected shots in order, including their children", () => {
  const p = project(
    clip("a", 0),
    clip("b", 2),
    clip("c", 4),
    clip("d", 6),
    clip("kid", 1, 1, "upper", "a"),
  );
  moveClip(
    p,
    "b",
    { kind: "insert", layerId: "parent", clipId: "d", side: "left", time: 6 },
    "Ann",
    ["a", "b"],
  );
  assert.deepEqual(positions(p), { a: 6, b: 8, c: 4, d: 10, kid: 7 });
});

test("a center drop exchanges an unselected shot with the selection as one unit", () => {
  const p = project(
    clip("a", 0),
    clip("b", 2),
    clip("c", 4),
    clip("d", 6),
    clip("kid", 2, 2, "upper", "b"),
  );
  moveClip(p, "b", centers("d"), "Ann", ["b", "a"]);
  assert.deepEqual(positions(p), { a: 6, b: 8, c: 4, d: 0, kid: 8 });
});

test("a locked sibling in another selected shot prevents the entire drag", () => {
  const p = project(clip("a", 0), clip("b", 2), clip("kid", 2, 2, "top", "b"));
  p.layers[2].locked = true;
  assert.throws(
    () =>
      moveClip(p, "a", { kind: "cell", layerId: "parent", time: 5 }, "Ann", [
        "a",
        "b",
      ]),
    /Unlock/,
  );
  assert.deepEqual(positions(p), { a: 0, b: 2, kid: 2 });
});

test("nonadjacent clips keep their spacing and the entire selection precedes the insertion target", () => {
  const p = project(
    clip("a", 0, 1),
    clip("b", 2, 1),
    clip("c", 4, 1),
    clip("d", 6, 1),
  );
  moveClip(
    p,
    "c",
    { kind: "insert", layerId: "parent", clipId: "d", side: "left", time: 6 },
    "Ann",
    ["a", "c"],
  );
  assert.deepEqual(positions(p), { a: 6, b: 2, c: 10, d: 11 });
});

test("moving selected children to another layer preserves their owners and relative timing", () => {
  const p = project(
    clip("a", 0),
    clip("b", 3),
    clip("x", 0, 2, "upper", "a"),
    clip("y", 3, 2, "upper", "b"),
  );
  moveClip(p, "y", { kind: "cell", layerId: "top", time: 4 }, "Ann", [
    "x",
    "y",
  ]);
  assert.deepEqual(positions(p), { a: 1, x: 1, b: 4, y: 4 });
  assert.deepEqual(
    ["x", "y"].map((id) => [at(p, id).layerId, at(p, id).parentId]),
    [
      ["top", "a"],
      ["top", "b"],
    ],
  );
});
