import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useBoardStore } from "../src/stores/board-store.ts";
import { useTaskStore } from "../src/stores/task-store.ts";
import * as members from "../src/lib/members.ts";

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
