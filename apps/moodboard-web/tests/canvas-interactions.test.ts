import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWheel,
  connectionGeometry,
  containsItemPoint,
  hitTestItems,
  rectangleSelection,
  selectRange,
  toBoardPoint,
} from "../src/lib/board-geometry.ts";
import {
  createHistory,
  createItem,
  historyReducer,
  isItemVisible,
} from "../src/lib/board-model.ts";

test("wheel pans vertically, Shift-wheel pans horizontally, and Ctrl-wheel preserves its zoom anchor", () => {
  const view = { x: 60, y: 80, zoom: 1 };
  const wheel = { deltaX: 0, deltaY: 100, shiftKey: false, ctrlKey: false, x: 500, y: 400 };
  assert.deepEqual(applyWheel(view, wheel), { x: 60, y: -20, zoom: 1 });
  assert.deepEqual(applyWheel(view, { ...wheel, shiftKey: true }), { x: -40, y: 80, zoom: 1 });
  const zoomed = applyWheel(view, { ...wheel, ctrlKey: true, deltaY: -100 });
  assert.ok(zoomed.zoom > 1);
  const before = toBoardPoint({ x: 500, y: 400 }, view);
  const after = toBoardPoint({ x: 500, y: 400 }, zoomed);
  assert.ok(Math.abs(before.x - after.x) < 0.000001);
  assert.ok(Math.abs(before.y - after.y) < 0.000001);
});

test("zoom clamps at usable limits without drifting the pointer anchor", () => {
  const result = applyWheel(
    { x: 0, y: 0, zoom: 2.5 },
    { deltaX: 0, deltaY: -10000, ctrlKey: true, shiftKey: false, x: 400, y: 300 },
  );
  assert.deepEqual(result, { x: 0, y: 0, zoom: 2.5 });
});

test("marquee selection works in either direction and excludes hidden cards", () => {
  const first = createItem("sticky", "first", 100, 100);
  const second = createItem("text", "second", 500, 100);
  const hidden = { ...createItem("text", "hidden", 200, 200), hidden: true };
  assert.deepEqual(
    rectangleSelection([first, second, hidden], { x: 800, y: 400 }, { x: 50, y: 50 }),
    ["first", "second"],
  );
});

test("Elements Ctrl toggles items and Shift selects the contiguous range", () => {
  const order = ["one", "two", "three", "four"];
  assert.deepEqual(selectRange(order, ["one"], "one", "three", { ctrl: true, shift: false }), [
    "one",
    "three",
  ]);
  assert.deepEqual(selectRange(order, ["one"], "one", "three", { ctrl: false, shift: true }), [
    "one",
    "two",
    "three",
  ]);
  assert.deepEqual(
    selectRange(order, ["one", "three"], "one", "one", { ctrl: true, shift: false }),
    ["three"],
  );
});

test("connection endpoints lie on the card boundaries", () => {
  const from = createItem("sticky", "one", 100, 100);
  const to = createItem("sticky", "two", 500, 100);
  const geometry = connectionGeometry(from, to);
  assert.equal(geometry.start.x, 338);
  assert.equal(geometry.end.x, 500);
});

test("connection target hit testing follows rotated card outlines", () => {
  const note = { ...createItem("sticky", "note", 100, 100), rotation: 90 };
  assert.equal(containsItemPoint(note, { x: 220, y: 85 }), true);
  assert.equal(containsItemPoint(note, { x: 105, y: 105 }), false);
});

test("connection targets follow the explicit layer order, independent of selection", () => {
  const note = createItem("sticky", "note", 100, 100);
  const group = createItem("collection", "group", 100, 100);
  assert.equal(hitTestItems([note, group], { x: 150, y: 150 }, [])?.id, "group");
  assert.equal(hitTestItems([note, group], { x: 150, y: 150 }, ["group"])?.id, "group");
  assert.equal(hitTestItems([group, note], { x: 150, y: 150 }, ["group"])?.id, "note");
});

test("duplicating a collection member refits its parent around the new item", () => {
  let history = historyReducer(createHistory(), {
    type: "add",
    item: createItem("collection", "group", 300, 80),
  });
  history = historyReducer(history, { type: "group", collectionId: "group", ids: ["sticky-1"] });
  history = historyReducer(history, { type: "update", id: "group", changes: { collapsed: false } });
  history = historyReducer(history, { type: "move", ids: ["sticky-1"], dx: 190, dy: 100 });
  const result = historyReducer(history, {
    type: "duplicate",
    ids: ["sticky-1"],
    idMap: { "sticky-1": "copy" },
  });
  const copy = result.present.items.find((item) => item.id === "copy");
  const group = result.present.items.find((item) => item.id === "group");
  assert.ok(copy && group);
  assert.equal(copy.parentId, group.id);
  assert.ok(copy.x + copy.width <= group.x + group.width - 24);
  assert.ok(copy.y + copy.height <= group.y + group.height - 24);
});

test("retargeting a connection keeps its identity and is undoable", () => {
  let history = createHistory();
  history = historyReducer(history, { type: "add", item: createItem("text", "third", 900, 200) });
  history = historyReducer(history, { type: "connect", from: "sticky-1", to: "link-1" });
  const edge = history.present.connections[0];
  const changed = historyReducer(history, {
    type: "reconnect",
    id: edge.id,
    endpoint: "to",
    itemId: "third",
  });
  assert.equal(changed.present.connections[0].id, edge.id);
  assert.equal(changed.present.connections[0].to, "third");
  assert.deepEqual(historyReducer(changed, { type: "undo" }).present, history.present);
  assert.equal(
    historyReducer(history, { type: "reconnect", id: edge.id, endpoint: "to", itemId: "sticky-1" }),
    history,
  );
});

test("multi-delete removes selected connections and cards in one undo step", () => {
  const history = historyReducer(createHistory(), {
    type: "connect",
    from: "sticky-1",
    to: "link-1",
  });
  const removed = historyReducer(history, {
    type: "delete-selection",
    itemIds: ["link-1"],
    connectionIds: [history.present.connections[0].id],
  });
  assert.equal(removed.present.items.length, 1);
  assert.equal(removed.present.connections.length, 0);
  assert.deepEqual(historyReducer(removed, { type: "undo" }).present, history.present);
});

test("a retargeted line and a new line to the old destination keep distinct identities", () => {
  let history = historyReducer(createHistory(), {
    type: "add",
    item: createItem("text", "third", 900, 200),
  });
  history = historyReducer(history, { type: "connect", from: "sticky-1", to: "link-1" });
  history = historyReducer(history, {
    type: "reconnect",
    id: history.present.connections[0].id,
    endpoint: "to",
    itemId: "third",
  });
  history = historyReducer(history, { type: "connect", from: "sticky-1", to: "link-1" });
  assert.equal(new Set(history.present.connections.map((edge) => edge.id)).size, 2);
});

test("collections reject nested collections and allow members to be dragged out", () => {
  let history = historyReducer(createHistory(), {
    type: "add",
    item: createItem("collection", "group", 300, 80),
  });
  history = historyReducer(history, {
    type: "add",
    item: createItem("collection", "other", 900, 80),
  });
  assert.equal(
    historyReducer(history, { type: "group", collectionId: "group", ids: ["other"] }),
    history,
  );
  history = historyReducer(history, { type: "group", collectionId: "group", ids: ["sticky-1"] });
  const removed = historyReducer(history, {
    type: "move",
    ids: ["sticky-1"],
    dx: -400,
    dy: 0,
    dropInto: null,
  });
  assert.equal(removed.present.items[0].parentId, null);
  assert.equal(isItemVisible(removed.present.items[0], removed.present.items), true);
});

test("moving a selection is one undo step and respects locked cards", () => {
  let history = createHistory();
  history = historyReducer(history, { type: "update", id: "link-1", changes: { locked: true } });
  const moved = historyReducer(history, {
    type: "move",
    ids: ["sticky-1", "link-1"],
    dx: 80,
    dy: -40,
  });
  assert.equal(moved.present.items[0].x, 416);
  assert.equal(moved.present.items[1].x, 666);
  assert.deepEqual(historyReducer(moved, { type: "undo" }).present, history.present);
});

test("collection membership hides children only when collapsed, and unwrap preserves them", () => {
  let history = historyReducer(createHistory(), {
    type: "add",
    item: createItem("collection", "group", 300, 80),
  });
  history = historyReducer(history, {
    type: "group",
    collectionId: "group",
    ids: ["sticky-1", "link-1"],
  });
  assert.equal(history.present.items.find((item) => item.id === "sticky-1")?.parentId, "group");
  assert.equal(isItemVisible(history.present.items[0], history.present.items), false);
  const opened = historyReducer(history, {
    type: "update",
    id: "group",
    changes: { collapsed: false },
  });
  assert.equal(isItemVisible(opened.present.items[0], opened.present.items), true);
  const unwrapped = historyReducer(opened, { type: "unwrap", id: "group" });
  assert.equal(unwrapped.present.items.length, 2);
  assert.equal(unwrapped.present.items[0].parentId, null);
  assert.equal(unwrapped.present.items[0].x, opened.present.items[0].x);
  assert.deepEqual(historyReducer(unwrapped, { type: "undo" }).present, opened.present);
});

test("moving a collapsed collection moves all its children, and deleting it removes attached lines", () => {
  let history = historyReducer(createHistory(), {
    type: "add",
    item: createItem("collection", "group", 300, 80),
  });
  history = historyReducer(history, { type: "group", collectionId: "group", ids: ["sticky-1"] });
  history = historyReducer(history, { type: "connect", from: "sticky-1", to: "link-1" });
  const moved = historyReducer(history, {
    type: "move",
    ids: ["group", "sticky-1"],
    dx: 50,
    dy: 40,
  });
  assert.equal(moved.present.items[0].x, history.present.items[0].x + 50);
  const deleted = historyReducer(moved, {
    type: "delete-selection",
    itemIds: ["group"],
    connectionIds: [],
  });
  assert.deepEqual(
    deleted.present.items.map((item) => item.id),
    ["link-1"],
  );
  assert.equal(deleted.present.connections.length, 0);
});
