import assert from "node:assert/strict";
import test from "node:test";
import { findConnectionTarget } from "../src/lib/board-geometry.ts";
import {
  boardsInSection,
  createLibrary,
  libraryImageSources,
  libraryReducer,
} from "../src/lib/board-library.ts";
import {
  type BoardHistory,
  createHistory,
  createImageItem,
  createItem,
  historyReducer,
  layerRows,
  layerZIndex,
} from "../src/lib/board-model.ts";

test("the to-do plus action appends a row without replacing existing tasks", () => {
  let state = historyReducer(createHistory(), {
    type: "add",
    item: createItem("todo", "tasks", 300, 100),
  });
  state = historyReducer(state, {
    type: "todo-update",
    id: "tasks",
    todoId: "tasks:todo-1",
    changes: { text: "Review the scene", done: true },
  });
  const added = historyReducer(state, { type: "todo-add", id: "tasks", todoId: "second" });
  const rows = added.present.items.find((item) => item.id === "tasks")?.todos;
  assert.deepEqual(
    rows?.map((row) => [row.id, row.text, row.done]),
    [
      ["tasks:todo-1", "Review the scene", true],
      ["second", "", false],
    ],
  );
  assert.deepEqual(historyReducer(added, { type: "undo" }).present, state.present);
});

test("locked to-do cards reject added rows and row edits", () => {
  let state = historyReducer(createHistory(), {
    type: "add",
    item: createItem("todo", "tasks", 300, 100),
  });
  state = historyReducer(state, { type: "update", id: "tasks", changes: { locked: true } });
  assert.equal(historyReducer(state, { type: "todo-add", id: "tasks", todoId: "second" }), state);
  assert.equal(
    historyReducer(state, {
      type: "todo-update",
      id: "tasks",
      todoId: "tasks:todo-1",
      changes: { done: true },
    }),
    state,
  );
});

test("images retain their aspect ratio and are placed at the requested board coordinate", () => {
  const item = createImageItem(
    "image",
    { src: "blob:example", name: "reference.png", width: 800, height: 400 },
    { x: -120, y: 230 },
  );
  assert.equal(item?.width, 360);
  assert.equal(item?.height, 180);
  assert.equal(item?.x, -120);
  assert.equal(item?.y, 230);
  assert.equal(item?.title, "reference.png");
  assert.equal(
    createImageItem(
      "bad",
      { src: "blob:bad", name: "bad.png", width: 0, height: 400 },
      { x: 0, y: 0 },
    ),
    null,
  );
});

test("Connect snaps near component outlines using a screen-sized tolerance", () => {
  const from = createItem("sticky", "from", 100, 100);
  const to = createItem("sticky", "to", 500, 100);
  assert.equal(findConnectionTarget([from, to], { x: 488, y: 197 }, "from", 1)?.id, "to");
  assert.equal(findConnectionTarget([from, to], { x: 482, y: 197 }, "from", 1), undefined);
  assert.equal(findConnectionTarget([from, to], { x: 488, y: 197 }, "from", 2), undefined);
  assert.equal(findConnectionTarget([from, to], { x: 120, y: 120 }, "from", 1), undefined);
});

test("connection snap targets respect rotated outlines and hidden components", () => {
  const source = createItem("text", "source", 600, 100);
  const rotated = { ...createItem("sticky", "rotated", 100, 100), rotation: 90 };
  assert.equal(
    findConnectionTarget([source, rotated], { x: 220, y: 70 }, "source", 1)?.id,
    "rotated",
  );
  assert.equal(
    findConnectionTarget([source, { ...rotated, hidden: true }], { x: 220, y: 70 }, "source", 1),
    undefined,
  );
});

function layerFixture(): BoardHistory {
  return {
    past: [],
    future: [],
    present: {
      items: [
        createItem("text", "one", 0, 0),
        createItem("text", "two", 0, 0),
        createItem("text", "three", 0, 0),
      ],
      connections: [],
    },
  };
}

test("Layers lists frontmost components first and drag reorder changes their stacking", () => {
  const initial = layerFixture();
  assert.deepEqual(
    layerRows(initial.present.items).map((row) => row.item.id),
    ["three", "two", "one"],
  );
  const reordered = historyReducer(initial, {
    type: "reorder",
    ids: ["one"],
    targetId: "three",
    position: "above",
  });
  assert.deepEqual(
    layerRows(reordered.present.items).map((row) => row.item.id),
    ["one", "three", "two"],
  );
  assert.deepEqual(historyReducer(reordered, { type: "undo" }).present, initial.present);
});

test("dragging multiple layers preserves their relative order", () => {
  const initial = layerFixture();
  const reordered = historyReducer(initial, {
    type: "reorder",
    ids: ["one", "two"],
    targetId: "three",
    position: "above",
  });
  assert.deepEqual(
    layerRows(reordered.present.items).map((row) => row.item.id),
    ["two", "one", "three"],
  );
});

test("moving a collection layer moves its member block without ungrouping it", () => {
  const group = createItem("collection", "group", 0, 0);
  const child = { ...createItem("text", "child", 30, 80), parentId: "group" };
  const other = createItem("text", "other", 500, 100);
  const initial: BoardHistory = {
    past: [],
    future: [],
    present: { items: [group, child, other], connections: [] },
  };
  const reordered = historyReducer(initial, {
    type: "reorder",
    ids: ["group"],
    targetId: "other",
    position: "above",
  });
  assert.deepEqual(
    layerRows(reordered.present.items).map((row) => row.item.id),
    ["group", "child", "other"],
  );
  assert.deepEqual(
    reordered.present.items.find((item) => item.id === "child"),
    child,
  );
});

test("collection members render in the hierarchy order after grouping older cards", () => {
  const group = { ...createItem("collection", "group", 0, 0), collapsed: false };
  const child = { ...createItem("text", "child", 30, 80), parentId: "group" };
  const other = createItem("text", "other", 30, 80);
  const items = [child, other, group];
  assert.deepEqual(
    layerRows(items).map(({ item }) => item.id),
    ["group", "child", "other"],
  );
  assert.ok(layerZIndex(child, items) > layerZIndex(other, items));
});

test("image resources remain reachable through undo and redo until the branch is discarded", () => {
  let library = libraryReducer(createLibrary(), { type: "create", id: "images", now: 100 });
  const image = createImageItem(
    "photo",
    {
      src: "blob:photo",
      name: "photo.jpg",
      width: 800,
      height: 600,
    },
    { x: 0, y: 0 },
  );
  assert.ok(image);
  library = libraryReducer(library, {
    type: "edit",
    id: "images",
    now: 101,
    action: { type: "add", item: image },
  });
  library = libraryReducer(library, {
    type: "edit",
    id: "images",
    now: 102,
    action: { type: "undo" },
  });
  assert.deepEqual([...libraryImageSources(library.boards)], ["blob:photo"]);
  library = libraryReducer(library, {
    type: "edit",
    id: "images",
    now: 103,
    action: { type: "add", item: createItem("text", "new-branch", 0, 0) },
  });
  assert.equal(libraryImageSources(library.boards).size, 0);
});

test("My boards and Shared with me filter ownership separately", () => {
  let library = libraryReducer(createLibrary(), { type: "create", id: "mine", now: 100 });
  library = {
    ...library,
    boards: [
      ...library.boards,
      { ...library.boards[0], id: "incoming", title: "Shared reference", sharedWithMe: true },
    ],
  };
  assert.deepEqual(
    boardsInSection(library.boards, "shared").map((board) => board.id),
    ["incoming"],
  );
  assert.equal(
    boardsInSection(library.boards, "mine").some((board) => board.id === "incoming"),
    false,
  );
});
