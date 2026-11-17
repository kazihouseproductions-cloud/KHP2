import assert from "node:assert/strict";
import test from "node:test";
import {
  createHistory,
  createItem,
  historyReducer,
  placeItem,
  safeLink,
} from "../src/lib/board-model.ts";

test("undo and redo restore a card's content and visibility", () => {
  const initial = createHistory();
  const id = initial.present.items[0].id;
  const edited = historyReducer(initial, {
    type: "update",
    id,
    changes: { text: "New idea", hidden: true },
  });
  const undone = historyReducer(edited, { type: "undo" });
  assert.deepEqual(undone.present, initial.present);
  assert.deepEqual(historyReducer(undone, { type: "redo" }).present, edited.present);
});

test("a new edit after undo discards the abandoned redo branch", () => {
  const initial = createHistory();
  const added = historyReducer(initial, { type: "add", item: createItem("text", "new", 400, 300) });
  const undone = historyReducer(added, { type: "undo" });
  const branched = historyReducer(undone, {
    type: "update",
    id: initial.present.items[0].id,
    changes: { text: "Different idea" },
  });
  assert.equal(branched.future.length, 0);
  assert.equal(historyReducer(branched, { type: "redo" }), branched);
});

test("locked cards cannot be moved, edited, or removed until unlocked", () => {
  const initial = createHistory();
  const id = initial.present.items[0].id;
  const locked = historyReducer(initial, { type: "update", id, changes: { locked: true } });
  assert.equal(
    historyReducer(locked, { type: "update", id, changes: { x: 900, text: "Changed" } }),
    locked,
  );
  assert.equal(historyReducer(locked, { type: "remove", id }), locked);
  const unlocked = historyReducer(locked, { type: "update", id, changes: { locked: false } });
  assert.equal(unlocked.present.items[0].locked, false);
});

test("removing a card removes its connections, and undo restores both", () => {
  const initial = createHistory();
  const [first, second] = initial.present.items;
  const connected = historyReducer(initial, { type: "connect", from: first.id, to: second.id });
  assert.equal(connected.present.connections.length, 1);
  assert.equal(
    historyReducer(connected, { type: "connect", from: first.id, to: first.id }),
    connected,
  );
  const removed = historyReducer(connected, { type: "remove", id: second.id });
  assert.equal(removed.present.connections.length, 0);
  assert.deepEqual(historyReducer(removed, { type: "undo" }).present, connected.present);
});

test("reference links allow only HTTP and HTTPS", () => {
  assert.equal(safeLink("https://example.com/reference"), "https://example.com/reference");
  assert.equal(safeLink("www.example.com"), "https://www.example.com/");
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("data:text/html,test"), null);
  assert.equal(safeLink(""), null);
});

test("new cards stay visible after positive or negative panning", () => {
  for (const pan of [
    { x: 1400, y: 900 },
    { x: -1500, y: -800 },
  ]) {
    const item = placeItem("sticky", "new", { width: 1280, height: 800 }, pan);
    assert.ok(item.x + pan.x >= 260);
    assert.ok(item.x + pan.x + item.width <= 1020);
    assert.ok(item.y + pan.y >= 40);
    assert.ok(item.y + pan.y + item.height <= 700);
  }
});

test("new mobile tables fit between the sidebar and the screen edge", () => {
  const pan = { x: 400, y: 300 };
  const item = placeItem("table", "new", { width: 390, height: 844 }, pan);
  const screenX = item.x + pan.x - 248;
  assert.ok(screenX >= 80);
  assert.ok(screenX + item.width <= 360);
});

test("successive card placements can be staggered", () => {
  const viewport = { width: 1920, height: 940 };
  const first = placeItem("sticky", "one", viewport, { x: 0, y: 0 });
  const second = placeItem("sticky", "two", viewport, { x: 0, y: 0 }, 28);
  assert.notEqual(first.x, second.x);
  assert.notEqual(first.y, second.y);
});
