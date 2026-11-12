import assert from "node:assert/strict";
import test from "node:test";
import { taskChange, type HistoryEntry } from "../src/lib/task-history.ts";
import { taskTrends } from "../src/lib/task-trends.ts";
import type { TaskStatus } from "../src/lib/tasks.ts";

const state = (assignedTo: string, status: TaskStatus) => ({ assignedTo, status });
const nadia = state("Nadia Ahmed", "Approved"),
  todo = state(" Nadia Ahmed ", "To Do");
const rafi = state("Rafi Islam", "Approved");
const entry = (id: string, day: number, change: ReturnType<typeof taskChange>): HistoryEntry => ({
  id,
  createdAt: new Date(2026, 10, day, 10).getTime(),
  ...change,
});

test("unknown dates, recorded zero approvals, and absent scores remain distinct", () => {
  const history = [entry("baseline", 10, taskChange([], [nadia, todo]))];
  const { days } = taskTrends(history, 3, new Date(2026, 10, 11));
  assert.deepEqual(
    days.map((d) => d.approvals),
    [null, 0, 0],
  );
  assert.deepEqual(
    days.map((d) => d.approved),
    [null, 1, 1],
  );
  assert.deepEqual(
    days.map((d) => d.scores.get("nadia ahmed")),
    [undefined, 72, 72],
  );
  assert.equal(days[2].scores.get("rafi islam"), null);
});

test("historical scores survive reopening, transfer, deletion, and window changes", () => {
  const history = [
    entry("baseline", 1, taskChange([], [todo, nadia])),
    entry("approve", 2, taskChange([todo], [nadia], 1)),
    entry("reopen", 3, taskChange([nadia], [todo])),
    entry("approve-again", 3, taskChange([todo], [nadia], 1)),
    entry("transfer", 4, taskChange([nadia], [rafi])),
    entry("delete", 5, taskChange([nadia, rafi], [])),
  ];
  const { days } = taskTrends(history, 5, new Date(2026, 10, 5));
  assert.deepEqual(
    days.map((d) => [d.approvals, d.approved, d.total]),
    [
      [0, 1, 2],
      [1, 2, 2],
      [1, 2, 2],
      [0, 2, 2],
      [0, 0, 0],
    ],
  );
  assert.deepEqual(
    days.map((d) => d.scores.get("nadia ahmed")),
    [72, 97, 97, 97, null],
  );
  assert.deepEqual(
    days.map((d) => d.scores.get("rafi islam")),
    [null, null, null, 96, null],
  );
  assert.deepEqual(taskTrends(history, 2, new Date(2026, 10, 5)).days, days.slice(-2));
});
