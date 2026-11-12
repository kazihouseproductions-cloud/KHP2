import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useBoardStore } from "../src/stores/board-store.ts";
import { useTaskStore } from "../src/stores/task-store.ts";
import * as members from "../src/lib/members.ts";
import { newTaskFields } from "../src/lib/tasks.ts";
import type { HistoryEntry } from "../src/lib/task-history.ts";
import { taskTrends } from "../src/lib/task-trends.ts";

const itemPrefix = "khp.board.v1.item.";
const taskPrefix = "khp.board.v1.task.";

class MemoryStorage {
  records = new Map<string, string>();
  failRemoval: string | null = null;
  failWrite = false;
  get length() {
    return this.records.size;
  }
  key(index: number) {
    return [...this.records.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.records.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error("Storage unavailable");
    this.records.set(key, String(value));
  }
  removeItem(key: string) {
    if (key === this.failRemoval) {
      this.failRemoval = null;
      throw new Error("Storage unavailable");
    }
    this.records.delete(key);
  }
}

let storage: MemoryStorage;
const pin = (id: string, parentId: string | null = null) => ({
  id,
  parentId,
  title: id,
  icon: "office" as const,
  createdAt: 1,
});
const task = (id: string, sectionId: string) => ({
  id,
  sectionId,
  title: id,
  createdAt: 1,
  date: "",
  deadline: "",
  assignedTo: "",
  assignedBy: "",
  priority: "",
  status: "To Do",
});
function seed() {
  for (const item of [pin("root"), pin("child", "root"), pin("section", "child"), pin("other")])
    storage.setItem(itemPrefix + item.id, JSON.stringify(item));
  storage.setItem(taskPrefix + "owned", JSON.stringify(task("owned", "section")));
  storage.setItem(taskPrefix + "unrelated", JSON.stringify(task("unrelated", "other")));
  storage.setItem("unrelated-setting", "keep");
  useBoardStore.getState().load();
  useTaskStore.getState().load();
}

beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  useBoardStore.setState({ items: [], ready: false });
  useTaskStore.setState({ tasks: [] });
});

test("forms, board moves and branch deletion journal only committed changes", async () => {
  const item = await useBoardStore.getState().add("Studio", "office", null);
  await useBoardStore.getState().endBranch(item.id);
  const root = useBoardStore.getState().items.find((node) => node.id === item.id)!;
  const store = useTaskStore.getState();
  const data = { ...newTaskFields("Approved"), title: "Review" };
  store.save(root.id, data);
  const original = useTaskStore.getState().tasks[0];
  store.save(root.id, { ...data, title: "Renamed" }, original);
  store.move(original.id, "Approved");
  store.move(original.id, "Done");
  store.move(original.id, "Approved");
  const history = (): HistoryEntry[] =>
    [...storage.records]
      .filter(([key]) => key.startsWith("khp.analytics.v1."))
      .map(([, raw]) => JSON.parse(raw));
  assert.equal(history().length, 4); // baseline, creation, reopening and reapproval
  const before = history();
  storage.failRemoval = itemPrefix + root.id;
  assert.throws(() => useBoardStore.getState().remove(root, "DELETE"));
  assert.deepEqual(history(), before);
  useBoardStore.getState().remove(root, "DELETE");
  const [today] = taskTrends(history(), 1, new Date()).days;
  assert.deepEqual([today.approvals, today.approved, today.total], [2, 0, 0]);
});

test("new workspaces keep their catalog icon and only the members chosen for that workspace", async () => {
  const board = useBoardStore.getState();
  const first = await board.add("Studio", "core:interface-home-1", null);
  const skipped = await board.add("Studio", "core:interface-folder", null);
  assert.deepEqual(first.memberIds, []);
  board.addMembers(first.id, ["nadia", "rafi"]);
  board.load();
  const items = useBoardStore.getState().items;
  assert.deepEqual(
    items.find((item) => item.id === first.id),
    { ...first, memberIds: ["nadia", "rafi"] },
  );
  assert.deepEqual(
    items.find((item) => item.id === skipped.id),
    { ...skipped, memberIds: [] },
  );
  await assert.rejects(() => board.add("Invalid", "core:missing-icon", null), /icon/i);
  assert.equal(storage.length, 2);
});

test("editing a pin persists its title and icon without losing members or children", () => {
  seed();
  const original = useBoardStore.getState().items.find((item) => item.id === "root")!;
  storage.setItem(itemPrefix + "root", JSON.stringify({ ...original, memberIds: ["nadia"] }));
  useBoardStore.getState().update(original, "  Renamed  ", "school");
  useBoardStore.getState().load();
  assert.deepEqual(
    useBoardStore.getState().items.find((item) => item.id === "root"),
    {
      ...original,
      title: "Renamed",
      icon: "school",
      memberIds: ["nadia"],
    },
  );
  assert.equal(useBoardStore.getState().items.length, 4);
});

test("a deep branch can end in tasks while its siblings keep growing", async () => {
  const board = useBoardStore.getState();
  const workspace = await board.add("Studio", "office", null);
  const sibling = await board.add("Independent branch", "school", workspace.id);
  let tip = workspace;
  for (let i = 0; i < 32; i++) tip = await board.add("Section", "office", tip.id);
  const fields = { ...newTaskFields("To Do"), title: "Review" };
  assert.throws(() => useTaskStore.getState().save(tip.id, fields), /end this branch/i);
  await assert.rejects(board.endBranch(workspace.id), /already has sections/i);
  await board.endBranch(tip.id);
  await board.endBranch(tip.id);
  assert.equal(useTaskStore.getState().tasks.length, 0);
  board.load();
  assert.equal(
    useBoardStore.getState().items.find((item) => item.id === tip.id)?.boardType,
    "tasks",
  );
  await assert.rejects(board.add("Hidden child", "office", tip.id), /cannot contain/i);
  useTaskStore.getState().save(tip.id, fields);
  await board.add("Still growing", "office", sibling.id);
  assert.equal(useTaskStore.getState().tasks[0]?.sectionId, tip.id);
});

test("adding a child and ending the same empty branch cannot both succeed", async () => {
  const board = useBoardStore.getState();
  for (const endFirst of [false, true]) {
    const workspace = await board.add("Studio", "office", null);
    const add = () => board.add("Child", "office", workspace.id);
    const end = () => board.endBranch(workspace.id);
    const results = await Promise.allSettled(endFirst ? [end(), add()] : [add(), end()]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    board.load();
    const items = useBoardStore.getState().items;
    const root = items.find((item) => item.id === workspace.id)!;
    assert.equal(
      items.some((item) => item.parentId === root.id),
      root.boardType === "sections",
    );
  }
});

test("all nested levels start unassigned and can select anyone from their own workspace", async () => {
  const board = useBoardStore.getState();
  const workspace = await board.add("Studio", "office", null);
  const other = await board.add("Other studio", "school", null);
  board.addMembers(workspace.id, ["nadia", "rafi"]);
  board.addMembers(other.id, ["samira"]);
  const department = await board.add("Design", "core:interface-folder", workspace.id);
  const project = await board.add("Pilot", "core:interface-folder", department.id);
  const section = await board.add("Review", "core:interface-folder", project.id);
  for (const item of [department, project, section]) {
    assert.deepEqual(item.memberIds, []);
    assert.throws(() => board.addMembers(item.id, ["samira"]), /roster/i);
  }
  board.addMembers(department.id, ["nadia"]);
  board.addMembers(section.id, ["rafi"]);
  board.load();
  const items = useBoardStore.getState().items;
  assert.deepEqual(items.find((item) => item.id === project.id)?.memberIds, []);
  assert.deepEqual(items.find((item) => item.id === section.id)?.memberIds, ["rafi"]);
});

test("assignments use the latest workspace roster even when the member dialog is already open", async () => {
  const board = useBoardStore.getState();
  const workspace = await board.add("Studio", "office", null);
  const department = await board.add("Art", "school", workspace.id);
  assert.throws(() => board.addMembers(department.id, ["rafi"]), /roster/i);
  board.addMembers(workspace.id, ["rafi"]);
  storage.setItem(
    itemPrefix + workspace.id,
    JSON.stringify({ ...workspace, memberIds: ["nadia"] }),
  );
  assert.throws(() => board.addMembers(department.id, ["rafi", "nadia"]), /roster/i);
  board.addMembers(department.id, ["nadia"]);
  assert.deepEqual(JSON.parse(storage.getItem(itemPrefix + department.id)!).memberIds, ["nadia"]);
});

test("pin color survives reload and rejects invalid colors and stale edits", async () => {
  const board = useBoardStore.getState();
  const workspace = await board.add("Studio", "core:interface-folder", null, "#185d8c");
  const child = await board.add("Art", "core:interface-home-1", workspace.id, "#eecc22");
  board.update(child, child.title, child.icon, "#123456");
  assert.throws(() => board.update(child, "Stale", child.icon, "#000000"), /changed/i);
  await assert.rejects(() => board.add("Invalid", "office", null, "transparent"), /color/i);
  board.load();
  const items = useBoardStore.getState().items;
  assert.equal(items.find((item) => item.id === workspace.id)?.color, "#185d8c");
  assert.equal(items.find((item) => item.id === child.id)?.color, "#123456");
});

test("both task assignment fields use the current workspace roster, including at save time", async () => {
  const board = useBoardStore.getState();
  const workspace = await board.add("Studio", "office", null);
  const other = await board.add("Other studio", "office", null);
  board.addMembers(workspace.id, ["nadia", "rafi"]);
  board.addMembers(other.id, ["samira"]);
  const department = await board.add("Art", "office", workspace.id);
  const project = await board.add("Pilot", "office", department.id);
  const section = await board.add("Review", "office", project.id);
  await board.endBranch(section.id);
  const fields = {
    ...newTaskFields("To Do"),
    title: "Review boards",
    assignedTo: "Rafi Islam",
    assignedBy: "Nadia Ahmed",
  };
  const tasks = useTaskStore.getState();
  for (const field of ["assignedTo", "assignedBy"] as const) {
    assert.throws(
      () => tasks.save(section.id, { ...fields, [field]: "Samira Khan" }),
      /workspace member/,
    );
  }
  tasks.save(section.id, fields);
  tasks.load();
  const [saved] = useTaskStore.getState().tasks;
  assert.equal(saved.assignedTo, "Rafi Islam");
  assert.equal(saved.assignedBy, "Nadia Ahmed");
  storage.setItem(itemPrefix + workspace.id, JSON.stringify({ ...workspace, memberIds: [] }));
  assert.throws(() => tasks.save(section.id, fields), /workspace member/);
  tasks.save(section.id, { ...fields, assignedTo: "", assignedBy: "" });
  assert.equal(useTaskStore.getState().tasks.length, 2);
});

test("editing an older task preserves free-text names and allows replacing or clearing them", () => {
  seed();
  storage.setItem(itemPrefix + "project", JSON.stringify(pin("project", "child")));
  storage.setItem(itemPrefix + "section", JSON.stringify(pin("section", "project")));
  const old = {
    ...task("owned", "section"),
    assignedTo: "Guest artist",
    assignedBy: "Former lead",
  };
  storage.setItem(taskPrefix + old.id, JSON.stringify(old));
  const tasks = useTaskStore.getState();
  tasks.load();
  const original = useTaskStore.getState().tasks.find((item) => item.id === old.id)!;
  tasks.save("section", { ...original, title: "Revised" }, original);
  const revised = useTaskStore.getState().tasks.find((item) => item.id === old.id)!;
  assert.equal(revised.assignedTo, old.assignedTo);
  assert.equal(revised.assignedBy, old.assignedBy);
  tasks.save("section", { ...revised, assignedTo: "Tanvir Hasan", assignedBy: "" }, revised);
  const stored = JSON.parse(storage.getItem(taskPrefix + old.id)!);
  assert.equal(stored.assignedTo, "Tanvir Hasan");
  assert.equal(stored.assignedBy, "");
});

test("a stale editor cannot overwrite a pin renamed in another tab", () => {
  seed();
  storage.setItem(
    itemPrefix + "root",
    JSON.stringify({ ...pin("root"), title: "Changed elsewhere" }),
  );
  assert.throws(
    () => useBoardStore.getState().update(pin("root"), "Overwrite", "school"),
    /changed/i,
  );
  assert.equal(JSON.parse(storage.getItem(itemPrefix + "root")!).title, "Changed elsewhere");
});

test("member assignment merges the latest assignments and survives reload", () => {
  seed();
  storage.setItem(itemPrefix + "root", JSON.stringify({ ...pin("root"), memberIds: ["nadia"] }));
  useBoardStore.getState().addMembers("root", ["ayesha", "ayesha", "rafi"]);
  useBoardStore.getState().load();
  assert.deepEqual(useBoardStore.getState().items.find((item) => item.id === "root")?.memberIds, [
    "nadia",
    "ayesha",
    "rafi",
  ]);
});

test("invalid members and invalid titles do not alter stored data", () => {
  seed();
  const before = [...storage.records];
  assert.throws(() => useBoardStore.getState().addMembers("root", ["unknown"]), /member/i);
  assert.throws(() => useBoardStore.getState().update(pin("root"), " ", "office"), /title/i);
  assert.deepEqual([...storage.records], before);
});

test("deletion rejects missing, lowercase, or padded DELETE confirmation without changing any records", () => {
  seed();
  const before = [...storage.records];
  for (const text of ["", "delete", " DELETE", "DELETE ", "DELET"]) {
    assert.throws(() => useBoardStore.getState().remove(pin("root"), text), /DELETE/);
    assert.deepEqual([...storage.records], before);
  }
});

test("confirmed deletion removes the pin, its descendants and their tasks while preserving unrelated data", () => {
  seed();
  useBoardStore.getState().remove(pin("root"), "DELETE");
  useBoardStore.getState().load();
  assert.deepEqual(
    useBoardStore.getState().items.map((item) => item.id),
    ["other"],
  );
  assert.deepEqual(
    useTaskStore.getState().tasks.map((task) => task.id),
    ["unrelated"],
  );
  assert.equal(storage.getItem(itemPrefix + "child"), null);
  assert.equal(storage.getItem(itemPrefix + "section"), null);
  assert.equal(storage.getItem(taskPrefix + "owned"), null);
  assert.equal(storage.getItem("unrelated-setting"), "keep");
});

test("delete includes descendants added by another tab after the local board loaded", () => {
  seed();
  storage.setItem(itemPrefix + "new-child", JSON.stringify(pin("new-child", "root")));
  useBoardStore.getState().remove(pin("root"), "DELETE");
  assert.equal(storage.getItem(itemPrefix + "new-child"), null);
});

test("a pin changed since the confirmation opened is not deleted", () => {
  seed();
  storage.setItem(
    itemPrefix + "root",
    JSON.stringify({ ...pin("root"), title: "Changed elsewhere" }),
  );
  assert.throws(() => useBoardStore.getState().remove(pin("root"), "DELETE"), /changed/i);
  assert.notEqual(storage.getItem(itemPrefix + "child"), null);
});

test("a failed delete restores already removed records and leaves the board intact", () => {
  seed();
  const before = [...storage.records].sort();
  storage.failRemoval = itemPrefix + "root";
  assert.throws(() => useBoardStore.getState().remove(pin("root"), "DELETE"), /delete/i);
  assert.deepEqual([...storage.records].sort(), before);
  assert.equal(useBoardStore.getState().items.length, 4);
});

test("a failed save does not claim to update the in-memory pin", () => {
  seed();
  storage.failWrite = true;
  assert.throws(() => useBoardStore.getState().update(pin("root"), "Not saved", "office"), /save/i);
  assert.equal(useBoardStore.getState().items.find((item) => item.id === "root")?.title, "root");
});

test("adding an assigned member immediately restores a filtered pin without reloading", () => {
  seed();
  const before = useBoardStore.getState().items.find((item) => item.id === "root")!;
  assert.equal(members.pinMatchesMember(before, "nadia"), false);
  useBoardStore.getState().addMembers("root", ["nadia"]);
  const after = useBoardStore.getState().items.find((item) => item.id === "root")!;
  assert.equal(members.pinMatchesMember(after, "nadia"), true);
});
