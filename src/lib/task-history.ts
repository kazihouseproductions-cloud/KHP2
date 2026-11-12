import { readRecords, watchRecords } from "./local-records";
import { memberNameKey } from "./members";
import { isTask, type Task } from "./tasks";

export const taskPrefix = "khp.board.v1.task.";
const prefix = "khp.analytics.v1.";
const baselineKey = `${prefix}baseline`;
type State = Pick<Task, "assignedTo" | "status">;
type MemberChange = { name: string; count: number; approved: number };
export type TaskChange = {
  count: number;
  approved: number;
  approvals: number;
  members: MemberChange[];
};
export type HistoryEntry = TaskChange & { id: string; createdAt: number };

// Store count changes, not copies of task titles or cards. Assignment edits affect
// both members; moving an already approved card to another member is not an approval.
export function taskChange(
  before: readonly State[],
  after: readonly State[],
  approvals = 0,
): TaskChange {
  const members = new Map<string, MemberChange>();
  let approved = 0;
  function add(task: State, sign: number) {
    const amount = task.status === "Approved" ? sign : 0;
    approved += amount;
    const key = memberNameKey(task.assignedTo);
    if (!key) return;
    const row = members.get(key) ?? { name: task.assignedTo.trim(), count: 0, approved: 0 };
    row.count += sign;
    row.approved += amount;
    members.set(key, row);
  }
  for (const task of before) add(task, -1);
  for (const task of after) add(task, 1);
  return {
    count: after.length - before.length,
    approved,
    approvals,
    members: [...members.values()].filter((row) => row.count || row.approved),
  };
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<HistoryEntry>;
  return (
    typeof row.id === "string" &&
    Number.isFinite(row.createdAt) &&
    Number.isInteger(row.count) &&
    Number.isInteger(row.approved) &&
    Number.isInteger(row.approvals) &&
    Array.isArray(row.members) &&
    row.members.every(
      (m) =>
        m &&
        typeof m.name === "string" &&
        Number.isInteger(m.count) &&
        Number.isInteger(m.approved),
    )
  );
}

function insert(id: string, change: TaskChange) {
  localStorage.setItem(prefix + id, JSON.stringify({ ...change, id, createdAt: Date.now() }));
}

function ensureBaseline() {
  if (localStorage.getItem(baselineKey) !== null) return false;
  insert("baseline", taskChange([], readRecords(taskPrefix, isTask)));
  return true;
}

// Journal the change before the underlying write; discard it if persistence fails.
// Separate keys keep unrelated task edits from overwriting one daily counter.
export function withTaskHistory(change: TaskChange, write: () => void) {
  if (!change.count && !change.approved && !change.approvals && !change.members.length)
    return write();
  const id = crypto.randomUUID();
  const started = ensureBaseline();
  try {
    insert(id, change);
    write();
  } catch (error) {
    localStorage.removeItem(prefix + id);
    if (started) localStorage.removeItem(baselineKey);
    throw error;
  }
}

export function listenToHistory(receive: (entries: HistoryEntry[] | null) => void) {
  return watchRecords(prefix, () => {
    try {
      ensureBaseline();
      const entries = readRecords(prefix, isEntry);
      receive(entries.some((entry) => entry.id === "baseline") ? entries : null);
    } catch {
      receive(null);
    }
  });
}
