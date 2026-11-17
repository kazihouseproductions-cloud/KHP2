import assert from "node:assert/strict";
import test from "node:test";
import { attendanceId, type AttendanceEntry } from "../src/lib/attendance.ts";
import { taskChange, type HistoryEntry } from "../src/lib/task-history.ts";
import { taskTrends } from "../src/lib/task-trends.ts";
import type { TaskStatus } from "../src/lib/tasks.ts";

const state = (assignedTo: string, status: TaskStatus) => ({ assignedTo, status });
const nadia = state("Nadia Ahmed", "Approved"),
  todo = state(" Nadia Ahmed ", "To Do");
const rafi = state("Rafi Islam", "Approved");
function attendance(rows: [AttendanceEntry["memberId"], string, AttendanceEntry["status"]][]) {
  return new Map(
    rows.map(([memberId, day, status]) => {
      const id = attendanceId(memberId, day);
      return [id, { id, memberId, day, status, note: "", createdAt: 1 }];
    }),
  );
}
const entry = (id: string, day: number, change: ReturnType<typeof taskChange>): HistoryEntry => ({
  id,
  createdAt: new Date(2026, 10, day, 10).getTime(),
  ...change,
});

test("unknown dates, recorded zero approvals, and absent scores remain distinct", () => {
  const history = [entry("baseline", 10, taskChange([], [nadia, todo]))];
  const marks = attendance([["nadia", "2026-11-11", "Absent"]]);
  const { days } = taskTrends(history, 3, new Date(2026, 10, 11), marks);
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
    [undefined, null, 25],
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
  const marks = attendance([
    ["nadia", "2026-10-31", "WFH"],
    ["nadia", "2026-11-03", "Absent"],
    ["rafi", "2026-11-04", "Late"],
  ]);
  const { days } = taskTrends(history, 5, new Date(2026, 10, 5), marks);
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
    [75, 100, 75, 75, null],
  );
  assert.deepEqual(
    days.map((d) => d.scores.get("rafi islam")),
    [null, null, null, 100, null],
  );
  assert.deepEqual(taskTrends(history, 2, new Date(2026, 10, 5), marks).days, days.slice(-2));
});
