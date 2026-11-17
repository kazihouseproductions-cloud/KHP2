import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useBoardStore } from "../src/stores/board-store.ts";
import { useTaskStore } from "../src/stores/task-store.ts";
import * as members from "../src/lib/members.ts";
import { newTaskFields } from "../src/lib/tasks.ts";
import type { HistoryEntry } from "../src/lib/task-history.ts";
import { taskTrends } from "../src/lib/task-trends.ts";
import { filterActivity, readActivity, withActivity } from "../src/lib/activity-log.ts";
import { useAttendanceStore } from "../src/stores/attendance-store.ts";
import { useWorkHoursStore } from "../src/stores/work-hours-store.ts";
import { sampleWeek } from "../src/lib/work-hours.ts";
import { useMemberStore } from "../src/stores/member-store.ts";
import { readMemberDirectory } from "../src/lib/member-records.ts";

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
function setActorRole(role: members.MemberRole) {
  storage.setItem("khp.members.v1.ayesha", JSON.stringify({ ...members.previewMember, role, createdAt: 1 }));
}
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

test("creating a member shares one routine across workspaces and makes the member assignable", async () => {
  setActorRole("Admin");
  seed();
  const days = { ...sampleWeek, Monday: { start: "08:30", end: "16:45" }, Thursday: null };
  const { id, name } = await useMemberStore.getState().add({
    name: "  Mika Roy ",
    role: "Member", jobTitle: "Lighting Artist",
    workspaceIds: ["root", "other"],
    days,
  });
  const directory = readMemberDirectory();
  assert.equal(directory.find((member) => member.id === id)?.jobTitle, "Lighting Artist");
  for (const workspace of useBoardStore.getState().items.filter((item) => item.parentId === null)) {
    assert.ok(members.getWorkspaceMembers(workspace, directory).some((member) => member.id === id));
  }
  useWorkHoursStore.getState().load();
  const routine = useWorkHoursStore.getState().routines.get(id)!;
  assert.deepEqual(routine.days, days);
  await useWorkHoursStore.getState().save(id, sampleWeek, routine);
  useTaskStore
    .getState()
    .save("section", { ...newTaskFields("To Do"), title: "Light scene", assignedTo: name });
  await useAttendanceStore.getState().save(id, "2026-11-14", { status: "Present" });
  useAttendanceStore.getState().load();
  assert.equal(useAttendanceStore.getState().entries.get(`2026-11-14/${id}`)?.status, "Present");
  assert.deepEqual(
    readActivity()
      .find((entry) => entry.area === "Members")
      ?.workspaces.map((w) => w.id)
      .sort(),
    ["other", "root"],
  );
  await assert.rejects(
    useMemberStore.getState().add({ name: "mika ROY", role: "Executive", workspaceIds: [] }),
    /already exists/,
  );
  assert.equal(readMemberDirectory().length, members.demoMembers.length + 1);
});

test("a failed schedule write restores both workspace rosters and the directory", async () => {
  setActorRole("Admin");
  seed();
  const before = new Map(storage.records);
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key.startsWith("khp.work-hours.v1.")) throw new Error("Storage full");
    write(key, value);
  };
  await assert.rejects(
    useMemberStore.getState().add({
      name: "Jamie",
      role: "Admin",
      workspaceIds: ["root", "other"],
      days: sampleWeek,
    }),
    /Storage full/,
  );
  assert.deepEqual(storage.records, before);
});

test("legacy job titles and seeded members survive profile edits, renames and reloads", async () => {
  setActorRole("Admin");
  seed();
  storage.setItem("khp.members.v1.guest", JSON.stringify({
    id: "guest", name: "Old Profile", role: "Sound Artist", color: "blue", initials: "OP", createdAt: 1,
  }));
  const directory = readMemberDirectory();
  const guest = directory.find(m => m.id === "guest")!;
  assert.equal(guest.role, "Member");
  assert.equal(guest.jobTitle, "Sound Artist");
  const original = directory.find(m => m.id === "ayesha")!;
  const store = useMemberStore.getState();
  useTaskStore.getState().save("section", {
    ...newTaskFields("Approved"), title: "Release", assignedTo: original.name, assignedBy: original.name,
  });
  await useAttendanceStore.getState().save(original.id, "2026-11-14", {status: "Late"});
  const updated = await store.update(original, {
    ...original, name: "Ayesha Noor", email: "ayesha@example.org", role: "Admin",
    days: { ...sampleWeek, Tuesday: null },
  });
  assert.equal(updated.jobTitle, original.jobTitle);
  assert.equal(updated.id, original.id);
  assert.equal(readMemberDirectory().length, directory.length);
  assert.deepEqual(readMemberDirectory().find(m => m.id === original.id), updated);
  useTaskStore.getState().load();
  const t = useTaskStore.getState().tasks.find(t => t.title === "Release")!;
  assert.deepEqual([t.assignedTo, t.assignedBy], [updated.name, updated.name]);
  useTaskStore.getState().save("section", { ...t, title: "Release v2" }, t);
  const history = [...storage.records].filter(([k]) => k.startsWith("khp.analytics.v1.")).map(([,v]) => JSON.parse(v));
  const trends = taskTrends(history, 1, new Date(), new Map(), readMemberDirectory());
  assert.equal(trends.members.filter(row => row.name === updated.name).length, 1);
  assert.ok(!trends.members.some(row => row.name === original.name));
  assert.equal(useAttendanceStore.getState().entries.get("2026-11-14/ayesha")?.status, "Late");
  assert.equal(useWorkHoursStore.getState().routines.get(original.id)?.days.Tuesday, null);
  await assert.rejects(store.update(original, { ...original, role: "Executive" }), /profile changed/);
  await assert.rejects(store.update(updated, { ...updated, days: sampleWeek }), /Work hours changed/);
  await assert.rejects(store.add({ name: original.name, role: "Member", workspaceIds: [] }), /already exists/);
});

test("a failed profile update also restores the previous routine", async () => {
  setActorRole("Admin");
  const member = readMemberDirectory().find(m => m.id === "nadia")!;
  const before = new Map(storage.records);
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === "khp.members.v1." + member.id) throw new Error("Storage full");
    write(key, value);
  };
  await assert.rejects(
    useMemberStore.getState().update(member, { ...member, role: "Executive", days: sampleWeek }),
    /Storage full/,
  );
  assert.deepEqual(storage.records, before);
});

test("members can edit their own details while role and schedule changes require an admin", async () => {
  const store = useMemberStore.getState();
  const actor = members.currentMember(readMemberDirectory());
  const other = members.demoMembers[1];
  const updated = await store.update(actor, { ...actor, name: "Ayesha Noor", jobTitle: "Editor", email: "editing@example.org" });
  assert.equal(updated.email, "editing@example.org");
  const before = new Map(storage.records);
  await assert.rejects(store.update(updated, { ...updated, role: "Admin" }), /own role/);
  await assert.rejects(store.update(other, { ...other, role: "Admin" }), /Only admins/);
  await assert.rejects(store.update(updated, { ...updated, days: sampleWeek }), /working hours/);
  await assert.rejects(useWorkHoursStore.getState().save(other.id, sampleWeek), /Only admins/);
  await assert.rejects(store.add({name: "Jo", role: "Executive", workspaceIds: []}), /Only admins/);
  await assert.rejects(store.add({name: "Jo", role: "Member", days: sampleWeek, workspaceIds: []}), /Only admins/);
  assert.deepEqual(storage.records, before);
  setActorRole("Admin");
  const admin = members.currentMember(readMemberDirectory());
  await assert.rejects(store.update(admin, { ...admin, role: "Member" }), /own role/);
  const promoted = await store.update(other, { ...other, role: "Executive", days: sampleWeek });
  assert.equal(promoted.role, "Executive");
  setActorRole("Executive");
  await assert.rejects(store.update(promoted, { ...promoted, role: "Admin" }), /Only admins/);
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
  const [today] = taskTrends(history(), 1, new Date(), new Map()).days;
  assert.deepEqual([today.approvals, today.approved, today.total], [2, 0, 0]);
});

test("new workspaces keep their catalog icon and only the members chosen for that workspace", async () => {
  const board = useBoardStore.getState();
  const first = await board.add("Studio", "core:interface-home-1", null);
  const skipped = await board.add("Studio", "core:interface-folder", null);
  assert.deepEqual(first.memberIds, []);
  await board.addMembers(first.id, ["nadia", "rafi"]);
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
  assert.equal([...storage.records.keys()].filter((key) => key.startsWith(itemPrefix)).length, 2);
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
      memberIds: ["nadia", "ayesha", "tanvir"],
    },
  );
  assert.deepEqual(JSON.parse(storage.getItem(itemPrefix + "root")!).memberIds, ["nadia"]);
  assert.equal(useBoardStore.getState().items.length, 4);
});

test("a deep branch can end in tasks while its siblings keep growing", async () => {
  const board = useBoardStore.getState();
  const workspace = await board.add("Studio", "office", null);
  const sibling = await board.add("Independent branch", "school", workspace.id);
  let tip = workspace;
  for (let i = 0; i < 32; i++) tip = await board.add("Section", "office", tip.id);
  const fields = { ...newTaskFields("To Do"), title: "Review" };
  useTaskStore.getState().save(workspace.id, { ...fields, title: "Workspace review" });
  await assert.rejects(board.endBranch(workspace.id), /already has sections/i);
  await board.endBranch(tip.id);
  await board.endBranch(tip.id);
  assert.equal(useTaskStore.getState().tasks.length, 1);
  board.load();
  assert.equal(
    useBoardStore.getState().items.find((item) => item.id === tip.id)?.boardType,
    "tasks",
  );
  await assert.rejects(board.add("Hidden child", "office", tip.id), /cannot contain/i);
  useTaskStore.getState().save(tip.id, fields);
  await board.add("Still growing", "office", sibling.id);
  assert.deepEqual(
    useTaskStore.getState().tasks.map((task) => task.sectionId),
    [workspace.id, tip.id],
  );
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

test("adding a member at depth includes every ancestor and leaves sibling rosters independent", async () => {
  const board = useBoardStore.getState();
  const workspace = await board.add("Studio", "office", null);
  const other = await board.add("Other studio", "school", null);
  await board.addMembers(workspace.id, ["nadia"]);
  await board.addMembers(other.id, ["samira"]);
  const department = await board.add("Design", "core:interface-folder", workspace.id);
  const project = await board.add("Pilot", "core:interface-folder", department.id);
  const section = await board.add("Review", "core:interface-folder", project.id);
  const sibling = await board.add("Other project", "office", department.id);
  await Promise.all([
    board.addMembers(section.id, ["rafi"]),
    board.addMembers(section.id, ["samira"]),
  ]);
  board.load();
  const items = useBoardStore.getState().items;
  for (const node of [section, project, department]) {
    assert.deepEqual(
      new Set(items.find((item) => item.id === node.id)?.memberIds),
      new Set(["rafi", "samira"]),
    );
  }
  assert.deepEqual(
    new Set(items.find((item) => item.id === workspace.id)?.memberIds),
    new Set(["nadia", "rafi", "samira"]),
  );
  assert.deepEqual(items.find((item) => item.id === sibling.id)?.memberIds, []);
  assert.deepEqual(items.find((item) => item.id === other.id)?.memberIds, ["samira"]);
  useTaskStore
    .getState()
    .save(sibling.id, { ...newTaskFields("To Do"), title: "Review", assignedTo: "Rafi Islam" });
  board.remove(project, "DELETE");
  assert.deepEqual(
    useBoardStore.getState().items.find((item) => item.id === workspace.id)?.memberIds,
    ["nadia"],
  );
});

test("inherited membership includes older child assignments and keeps independent workspace members", async () => {
  const board = useBoardStore.getState();
  const workspace = await board.add("Studio", "office", null);
  const department = await board.add("Art", "school", workspace.id);
  storage.setItem(
    itemPrefix + department.id,
    JSON.stringify({ ...department, memberIds: ["rafi"] }),
  );
  storage.setItem(
    itemPrefix + workspace.id,
    JSON.stringify({ ...workspace, memberIds: ["nadia"] }),
  );
  board.load();
  assert.deepEqual(useBoardStore.getState().items.find((i) => i.id === workspace.id)?.memberIds, [
    "nadia",
    "rafi",
  ]);
  await board.addMembers(department.id, ["samira"]);
  assert.deepEqual(JSON.parse(storage.getItem(itemPrefix + department.id)!).memberIds, [
    "rafi",
    "samira",
  ]);
  assert.deepEqual(useBoardStore.getState().items.find((i) => i.id === workspace.id)?.memberIds, [
    "nadia",
    "rafi",
    "samira",
  ]);
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
  await board.addMembers(workspace.id, ["nadia", "rafi"]);
  await board.addMembers(other.id, ["samira"]);
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

test("member assignment merges the latest assignments and survives reload", async () => {
  seed();
  storage.setItem(itemPrefix + "root", JSON.stringify({ ...pin("root"), memberIds: ["nadia"] }));
  await useBoardStore.getState().addMembers("root", ["ayesha", "ayesha", "rafi"]);
  useBoardStore.getState().load();
  assert.deepEqual(useBoardStore.getState().items.find((item) => item.id === "root")?.memberIds, [
    "nadia",
    "ayesha",
    "rafi",
    "tanvir",
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

test("adding an assigned member immediately restores a filtered pin without reloading", async () => {
  seed();
  const before = useBoardStore.getState().items.find((item) => item.id === "root")!;
  assert.equal(members.pinMatchesMember(before, "nadia"), false);
  await useBoardStore.getState().addMembers("root", ["nadia"]);
  const after = useBoardStore.getState().items.find((item) => item.id === "root")!;
  assert.equal(members.pinMatchesMember(after, "nadia"), true);
});

test("activity records committed changes in order, attributes the actor, and preserves historical workspace scope", async () => {
  setActorRole("Admin");
  const board = useBoardStore.getState();
  const studio = await board.add("Studio", "office", null);
  const school = await board.add("School", "school", null);
  const section = await board.add("Review", "office", studio.id);
  await board.addMembers(section.id, ["nadia", "ayesha"]);
  await board.addMembers(school.id, ["nadia"]);
  await board.endBranch(section.id);
  const tasks = useTaskStore.getState();
  tasks.save(section.id, {
    ...newTaskFields("To Do"),
    title: "Layout",
    assignedTo: "Nadia Ahmed",
    assignedBy: "Nadia Ahmed",
  });
  const task = useTaskStore.getState().tasks[0];
  tasks.move(task.id, "Approved");
  await useAttendanceStore.getState().save("nadia", "2026-11-14", { status: "Late" });
  await useAttendanceStore.getState().save("nadia", "2026-11-14", { note: "Personal details" });
  await useWorkHoursStore.getState().save("nadia", sampleWeek);
  const entries = readActivity();
  assert.equal(entries.length, 11);
  assert.deepEqual(
    entries.slice(0, 4).map((e) => e.area),
    ["Work Hours", "Attendance", "Attendance", "Tasks"],
  );
  assert.ok(entries.every((e) => e.actorId === "ayesha" && e.actorName === "Ayesha Rahman"));
  assert.equal(entries[3].detail, "To Do → Approved");
  assert.equal(JSON.stringify(entries).includes("Personal details"), false);
  assert.deepEqual(filterActivity(entries, undefined, "nadia"), []);
  assert.equal(filterActivity(entries, studio.id, "ayesha").length, 9);
  assert.equal(filterActivity(entries, school.id).length, 5);
  tasks.move(task.id, "Approved");
  await board.addMembers(section.id, ["nadia"]);
  await useAttendanceStore.getState().save("nadia", "2026-11-14", { status: "Late" });
  await useWorkHoursStore
    .getState()
    .save("nadia", sampleWeek, useWorkHoursStore.getState().routines.get("nadia"));
  assert.deepEqual(readActivity(), entries);
  assert.throws(() =>
    withActivity({ area: "Board", description: "Failed change", workspaces: [] }, () => {
      throw Error("Save failed");
    }),
  );
  assert.deepEqual(readActivity(), entries);
  board.update(studio, "Renamed studio", studio.icon);
  const renamed = useBoardStore.getState().items.find((item) => item.id === studio.id)!;
  board.remove(renamed, "DELETE");
  const after = filterActivity(readActivity(), studio.id);
  assert.match(after[0].description, /Deleted workspace “Renamed studio”/);
  assert.equal(after[0].detail, "Also removed 1 nested section and 1 task");
  assert.equal(after.at(-1)?.workspaces[0].title, "Studio");
});
