import assert from "node:assert/strict";
import test from "node:test";
import {
  dayKey,
  indexCalendarTasks,
  monthDays,
  shiftPeriod,
  weekDays,
} from "../src/lib/calendar.ts";
import type { Task } from "../src/lib/tasks.ts";

test("months align to Saturday and include leap days and a sixth row when needed", () => {
  const feb = monthDays(new Date(2024, 1, 15));
  assert.equal(feb.length, 35);
  assert.equal(dayKey(feb[0]), "2024-01-27");
  assert.equal(dayKey(feb[5]), "2024-02-01");
  assert.equal(dayKey(feb[33]), "2024-02-29");
  const may = monthDays(new Date(2026, 4, 1));
  assert.equal(may.length, 42);
  assert.equal(dayKey(may[36]), "2026-05-31");
});

test("period navigation handles short months and weeks crossing a year", () => {
  assert.equal(dayKey(shiftPeriod(new Date(2024, 0, 31), "Monthly", 1)), "2024-02-29");
  assert.equal(dayKey(shiftPeriod(new Date(2024, 1, 29), "Yearly", 1)), "2025-02-28");
  const anchor = new Date(2027, 0, 1);
  assert.deepEqual(weekDays(anchor).map(dayKey), [
    "2026-12-26",
    "2026-12-27",
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
  ]);
  assert.equal(dayKey(shiftPeriod(anchor, "Weekly", 1)), "2027-01-08");
});

test("indexes all assignees by dates and deadlines without duplicating a same-day task", () => {
  const task = (id: string, date: string, deadline: string, assignedTo = ""): Task => ({
    id,
    date,
    deadline,
    assignedTo,
    assignedBy: "",
    sectionId: id,
    title: id,
    status: "To Do",
    priority: "",
    createdAt: 1,
  });
  const { byDay, unscheduled } = indexCalendarTasks([
    task("start", "2026-11-12", "2026-11-13", "Ayesha Rahman"),
    task("same", "2026-11-12", "2026-11-12", "Nadia Ahmed"),
    task("due", "", "2026-11-13"),
    task("date-only", "2026-11-14", ""),
    task("undated", "", ""),
    task("invalid", "2026-02-30", ""),
  ]);
  const entries = (key: string) => byDay.get(key)?.map(({ task, due }) => [task.id, due]);
  assert.deepEqual(entries("2026-11-12"), [
    ["start", false],
    ["same", true],
  ]);
  assert.deepEqual(entries("2026-11-13"), [
    ["start", true],
    ["due", true],
  ]);
  assert.deepEqual(entries("2026-11-14"), [["date-only", false]]);
  assert.deepEqual(
    unscheduled.map(({ task }) => task.id),
    ["undated", "invalid"],
  );
});
