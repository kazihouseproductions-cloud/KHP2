import assert from "node:assert/strict";
import test from "node:test";
import { demoMembers, findMemberTasks } from "../src/lib/members.ts";
import { attendanceRatesByDay, memberPerformance } from "../src/lib/member-performance.ts";
import { attendanceId, type AttendanceEntry } from "../src/lib/attendance.ts";
import { summarizeTasks } from "../src/lib/task-summary.ts";
import { type Task, taskStatuses } from "../src/lib/tasks.ts";

test("an empty dashboard keeps all statuses and members visible at zero", () => {
  const summary = summarizeTasks([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.unassigned, 0);
  assert.deepEqual(
    summary.statuses,
    taskStatuses.map((status) => ({ status, count: 0 })),
  );
  assert.deepEqual(
    summary.members.map((row) => row.name).sort(),
    demoMembers.map((m) => m.name).sort(),
  );
  assert.ok(summary.members.every((row) => row.count === 0));
  for (const member of summary.members) {
    const { approval, attendance, score } = memberPerformance(member, new Map());
    assert.equal(approval, null);
    assert.equal(attendance, null);
    assert.equal(score, null);
  }
});

test("both breakdowns reconcile across boards and member counts match the exact-assignee board", () => {
  function task(id: string, sectionId: string, status: Task["status"], assignedTo: string): Task {
    return {
      id,
      title: id,
      sectionId,
      status,
      assignedTo,
      assignedBy: "Rafi Islam",
      createdAt: 1,
      date: "2026-11-01",
      deadline: "2026-11-20",
      priority: "",
    };
  }
  const tasks = [
    task("one", "studio", "Pending", " Nadia Ahmed "),
    task("two", "school", "Approved", "NADIA AHMED"),
    task("three", "school", "Done", "Nadia Ahmed Khan"),
    task("four", "studio", "Pending", "nadia ahmed khan"),
    task("five", "studio", "To Do", " "),
  ];
  const summary = summarizeTasks(tasks);
  assert.equal(summary.total, 5);
  assert.deepEqual(
    summary.statuses.map((row) => row.count),
    [1, 2, 1, 1],
  );
  for (const row of summary.members) {
    assert.equal(row.count, findMemberTasks(tasks, row.name).length);
  }
  assert.equal(summary.members.find((row) => row.name === "Nadia Ahmed Khan")?.count, 2);
  assert.equal(summary.unassigned, 1);
  assert.equal(
    summary.members.reduce((sum, row) => sum + row.count, summary.unassigned),
    summary.total,
  );
});

test("performance gives approval and attendance equal weight and follows the current assignee and status", () => {
  const base: Task = {
    id: "1",
    sectionId: "school",
    title: "Review",
    status: "Approved",
    assignedTo: "Nadia Ahmed",
    assignedBy: "Rafi Islam",
    createdAt: 1,
    date: "",
    deadline: "",
    priority: "",
  };
  const tasks: Task[] = [
    base,
    { ...base, id: "2", sectionId: "studio", assignedTo: " NADIA AHMED ", status: "Done" },
    { ...base, id: "3", assignedTo: "Nadia Ahmed Khan" },
    { ...base, id: "4", assignedTo: "" },
  ];
  const marks = new Map<string, AttendanceEntry>();
  ([null, "Leave", "WFH", "Present", "Late", "Absent", "Absent"] as const).forEach((status, i) => {
    const day = `2026-11-0${i + 1}`;
    const id = attendanceId("nadia", day);
    marks.set(id, { day, id, memberId: "nadia", status, note: "", createdAt: 0 });
  });
  const rates = attendanceRatesByDay(marks, ["2026-11-02", "2026-11-06"]);
  assert.equal(rates.get("2026-11-02")?.has("nadia"), false);
  function result(name: string) {
    const member = summarizeTasks(tasks).members.find((row) => row.name === name);
    assert.ok(member);
    return memberPerformance(member, rates.get("2026-11-06"));
  }
  assert.deepEqual(result("Nadia Ahmed"), { approval: 50, attendance: 75, score: 62.5 });
  assert.deepEqual(result("Nadia Ahmed Khan"), { approval: 100, attendance: null, score: null });
  tasks[0] = { ...base, assignedTo: "Rafi Islam" };
  assert.deepEqual(result("Nadia Ahmed"), { approval: 0, attendance: 75, score: 37.5 });
  tasks[1] = { ...tasks[1], status: "Approved" };
  assert.deepEqual(result("Nadia Ahmed"), { approval: 100, attendance: 75, score: 87.5 });
});
