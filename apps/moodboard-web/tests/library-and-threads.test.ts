import assert from "node:assert/strict";
import test from "node:test";
import { rotationDelta } from "../src/lib/board-geometry.ts";
import { createLibrary, libraryReducer } from "../src/lib/board-library.ts";
import { createHistory, createItem, historyReducer } from "../src/lib/board-model.ts";

test("the app starts in the library and new boards open empty", () => {
  const initial = createLibrary();
  assert.equal(initial.activeId, null);
  const created = libraryReducer(initial, { type: "create", id: "new", now: 100 });
  assert.equal(created.activeId, "new");
  assert.equal(created.boards.find((board) => board.id === "new")?.title, "Untitled board");
  assert.equal(created.boards.find((board) => board.id === "new")?.history.present.items.length, 0);
});

test("returning to the library and reopening preserves the board and undo history", () => {
  let state = libraryReducer(createLibrary(), { type: "create", id: "new", now: 100 });
  state = libraryReducer(state, {
    type: "edit",
    id: "new",
    now: 200,
    action: { type: "add", item: createItem("sticky", "idea", 300, 100) },
  });
  state = libraryReducer(state, { type: "close" });
  assert.equal(state.activeId, null);
  state = libraryReducer(state, { type: "open", id: "new" });
  const document = state.boards.find((board) => board.id === "new");
  assert.equal(document?.history.present.items[0].id, "idea");
  assert.equal(document?.history.past.length, 1);
});

test("board edits and renames stay isolated, and blank names use the default", () => {
  let state = libraryReducer(createLibrary(), { type: "create", id: "first", now: 100 });
  state = libraryReducer(state, { type: "create", id: "second", now: 200 });
  state = libraryReducer(state, {
    type: "rename",
    id: "first",
    title: "  Story references  ",
    now: 300,
  });
  state = libraryReducer(state, {
    type: "edit",
    id: "first",
    action: { type: "add", item: createItem("text", "text", 100, 100) },
    now: 400,
  });
  assert.equal(state.boards.find((board) => board.id === "first")?.title, "Story references");
  assert.equal(
    state.boards.find((board) => board.id === "second")?.history.present.items.length,
    0,
  );
  state = libraryReducer(state, { type: "rename", id: "first", title: "   ", now: 500 });
  assert.equal(state.boards.find((board) => board.id === "first")?.title, "Untitled board");
});

test("opening an unknown board leaves the library unchanged", () => {
  const state = createLibrary();
  assert.equal(libraryReducer(state, { type: "open", id: "missing" }), state);
});

test("drag rotation follows the pointer and Shift snaps the resulting angle", () => {
  const center = { x: 0, y: 0 };
  assert.equal(rotationDelta({ x: 0, y: -100 }, { x: 100, y: 0 }, center, 0, false), 90);
  const almostRight = { x: 100, y: -10 };
  assert.equal(rotationDelta({ x: 0, y: -100 }, almostRight, center, 7, true), 83);
  assert.ok(Math.abs(rotationDelta({ x: -100, y: 1 }, { x: -100, y: -1 }, center, 0, false)) < 2);
});

test("a full drag rotation is one undo step and does not move the object's center", () => {
  const initial = createHistory();
  const rotated = historyReducer(initial, {
    type: "rotate",
    ids: ["sticky-1"],
    center: { x: 455, y: 239 },
    delta: 90,
  });
  assert.equal(rotated.present.items[0].rotation, 90);
  assert.equal(rotated.present.items[0].x, 336);
  assert.equal(rotated.present.items[0].y, 142);
  assert.equal(rotated.past.length, 1);
  assert.deepEqual(historyReducer(rotated, { type: "undo" }).present, initial.present);
});

test("multi-object rotation rotates positions around a shared pivot and respects locks", () => {
  let initial = createHistory();
  initial = historyReducer(initial, { type: "update", id: "link-1", changes: { locked: true } });
  const rotated = historyReducer(initial, {
    type: "rotate",
    ids: ["sticky-1", "link-1"],
    center: { x: 0, y: 0 },
    delta: 90,
  });
  assert.ok(Math.abs(rotated.present.items[0].x - -358) < 0.00001);
  assert.equal(rotated.present.items[1].rotation, 0);
  assert.equal(rotated.present.items[1].x, 666);
});

test("rotating a collection member keeps its center and unselected siblings in place", () => {
  let state = historyReducer(createHistory(), {
    type: "add",
    item: createItem("collection", "group", 300, 80),
  });
  state = historyReducer(state, {
    type: "group",
    collectionId: "group",
    ids: ["sticky-1", "link-1"],
  });
  const note = state.present.items.find((item) => item.id === "sticky-1");
  const sibling = state.present.items.find((item) => item.id === "link-1");
  assert.ok(note && sibling);
  const rotated = historyReducer(state, {
    type: "rotate",
    ids: [note.id],
    center: { x: note.x + note.width / 2, y: note.y + note.height / 2 },
    delta: 90,
  });
  const result = rotated.present.items.find((item) => item.id === note.id);
  assert.equal(result?.x, note.x);
  assert.equal(result?.y, note.y);
  assert.deepEqual(
    rotated.present.items.find((item) => item.id === sibling.id),
    sibling,
  );
  assert.deepEqual(historyReducer(rotated, { type: "undo" }).present, state.present);
});

test("comment threads append named replies without replacing earlier messages", () => {
  let state = historyReducer(createHistory(), {
    type: "add",
    item: createItem("comment", "thread", 300, 200),
  });
  state = historyReducer(state, {
    type: "reply",
    id: "thread",
    message: {
      id: "one",
      author: "  Maya  ",
      text: "  Can we try a warmer color?  ",
      createdAt: 100,
    },
  });
  state = historyReducer(state, {
    type: "reply",
    id: "thread",
    message: { id: "two", author: "Arif", text: "Yes, I will update it.", createdAt: 200 },
  });
  const messages = state.present.items.find((item) => item.id === "thread")?.messages;
  assert.deepEqual(
    messages?.map((message) => [message.author, message.text]),
    [
      ["Maya", "Can we try a warmer color?"],
      ["Arif", "Yes, I will update it."],
    ],
  );
  assert.equal(
    historyReducer(state, { type: "undo" }).present.items.find((item) => item.id === "thread")
      ?.messages.length,
    1,
  );
});

test("comment threads reject empty replies, duplicate messages, and edits to locked threads", () => {
  const state = historyReducer(createHistory(), {
    type: "add",
    item: createItem("comment", "thread", 300, 200),
  });
  const message = { id: "one", author: "Maya", text: "Hello", createdAt: 100 };
  assert.equal(
    historyReducer(state, { type: "reply", id: "thread", message: { ...message, author: " " } }),
    state,
  );
  assert.equal(
    historyReducer(state, { type: "reply", id: "thread", message: { ...message, text: " " } }),
    state,
  );
  const posted = historyReducer(state, { type: "reply", id: "thread", message });
  assert.equal(historyReducer(posted, { type: "reply", id: "thread", message }), posted);
  const locked = historyReducer(posted, {
    type: "update",
    id: "thread",
    changes: { locked: true },
  });
  assert.equal(
    historyReducer(locked, { type: "reply", id: "thread", message: { ...message, id: "two" } }),
    locked,
  );
});
