import assert from "node:assert/strict";
import { test } from "node:test";
import * as members from "../src/lib/members.ts";
import * as workspaces from "../src/lib/workspaces.ts";
import { memberTasksHref, parseBoardRoute, resolveNodeRoute } from "../src/lib/board-route.ts";

function boardHref(items: workspaces.BoardItem[], id: string) {
  return (
    workspaces.resolveBoardPath(id, workspaces.indexBoardItems(items).byId).at(-1)?.href ?? null
  );
}

test("a member's task view keeps the board it was opened from", () => {
  assert.deepEqual(parseBoardRoute(memberTasksHref("#/", "nadia")), {
    kind: "home",
    tasksFor: "nadia",
  });
  const href = workspaces.nodeHref({
    id: "room/1?draft",
    parentId: "studio",
    title: "Room",
    createdAt: 1,
    icon: "office",
  });
  assert.deepEqual(parseBoardRoute(memberTasksHref(href, "rafi")), {
    kind: "node",
    id: "room/1?draft",
    workspace: false,
    tasksFor: "rafi",
  });
  assert.equal(parseBoardRoute("#/tool/tasks?tasksFor=nadia").kind, "invalid");
});

test("clearing the member selection restores every pin, including unassigned pins", () => {
  for (const pin of [{}, { memberIds: [] }, { memberIds: ["nadia"] }])
    assert.equal(members.pinMatchesMember(pin, null), true);
});

test("a member task links to the correct nested section board", () => {
  const items = [
    { id: "w", parentId: null },
    { id: "d", parentId: "w" },
    { id: "p", parentId: "d" },
    { id: "s", parentId: "p" },
  ].map((item) => ({ ...item, title: item.id, icon: "office" as const, createdAt: 1 }));
  assert.equal(boardHref(items, "s"), "#/section/s");
  const { byId } = workspaces.indexBoardItems(items);
  const oldLink = "#/workspace/w/department/d/project/p/section/s";
  assert.deepEqual(
    resolveNodeRoute(parseBoardRoute(oldLink), byId),
    resolveNodeRoute(parseBoardRoute("#/section/s"), byId),
  );
  assert.deepEqual(resolveNodeRoute(parseBoardRoute(oldLink.replace("/d/", "/other/")), byId), []);
});

test("missing or cyclic boards never produce broken member task links", () => {
  const base = { title: "Pin", icon: "office" as const, createdAt: 1 };
  assert.equal(boardHref([{ ...base, id: "orphan", parentId: "gone" }], "orphan"), null);
  assert.equal(boardHref([{ ...base, id: "cycle", parentId: "cycle" }], "cycle"), null);
  assert.equal(boardHref([], "missing"), null);
});

test("only directly assigned pins match the selected member", () => {
  assert.equal(members.pinMatchesMember({ memberIds: ["nadia", "rafi"] }, "nadia"), true);
  assert.equal(members.pinMatchesMember({ memberIds: ["ayesha"] }, "nadia"), false);
  assert.equal(members.pinMatchesMember({ memberIds: [] }, "nadia"), false);
});

test("legacy pins use the same sample membership as their Members panel", () => {
  assert.equal(members.pinMatchesMember({}, "ayesha"), true);
  assert.equal(members.pinMatchesMember({}, "tanvir"), true);
  assert.equal(members.pinMatchesMember({}, "nadia"), false);
});

test("switching members evaluates each pin independently", () => {
  const design = { memberIds: ["nadia"] };
  const animation = { memberIds: ["tanvir"] };
  assert.deepEqual(
    [design, animation].map((pin) => members.pinMatchesMember(pin, "nadia")),
    [true, false],
  );
  assert.deepEqual(
    [design, animation].map((pin) => members.pinMatchesMember(pin, "tanvir")),
    [false, true],
  );
});

test("member tasks match the assignee exactly while ignoring case and surrounding whitespace", () => {
  const base = {
    sectionId: "section",
    title: "Task",
    createdAt: 1,
    date: "",
    deadline: "",
    assignedBy: "Nadia Ahmed",
    priority: "" as const,
    status: "To Do" as const,
  };
  const tasks = [
    { ...base, id: "owned", assignedTo: "  NADIA AHMED  " },
    { ...base, id: "different", assignedTo: "Ayesha Rahman" },
    { ...base, id: "partial", assignedTo: "Nadia Ahmed Khan" },
    { ...base, id: "unassigned", assignedTo: "" },
  ];
  assert.deepEqual(
    members.findMemberTasks(tasks, "Nadia Ahmed").map((task) => task.id),
    ["owned"],
  );
});
