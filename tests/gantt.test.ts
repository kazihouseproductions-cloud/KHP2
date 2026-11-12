import assert from "node:assert/strict";
import test from "node:test";
import { indexCalendarTasks } from "../src/lib/calendar.ts";
import { ganttPeriod, ganttRows, placeRange } from "../src/lib/gantt.ts";
import type { Task } from "../src/lib/tasks.ts";

test("a Saturday week clips spanning tasks at either edge, including the last day", () => {
  const week = ganttPeriod(new Date(2026, 10, 1), "Weekly");
  assert.equal(week.ticks[0].key, "2026-10-31");
  assert.equal(week.ticks.at(-1)?.key, "2026-11-06");
  assert.deepEqual(placeRange("2026-10-25", "2026-11-02", week), {
    left: 0,
    width: 3 / 7,
    before: true,
    after: false,
  });
  assert.deepEqual(placeRange("2026-11-06", "2026-11-12", week), {
    left: 6 / 7,
    width: 1 / 7,
    before: false,
    after: true,
  });
  assert.deepEqual(placeRange("2026-10-01", "2026-12-01", week), {
    left: 0,
    width: 1,
    before: true,
    after: true,
  });
  assert.equal(placeRange("2026-10-20", "2026-10-30", week), null);
  assert.equal(placeRange("2026-11-07", "2026-11-08", week), null);
});

test("year and month scales give leap day its actual width and position", () => {
  const leap = new Date(2024, 1, 29);
  const year = ganttPeriod(leap, "Yearly");
  assert.equal(year.days, 366);
  assert.equal(year.ticks[1].days, 29);
  assert.equal(year.ticks.length, 12);
  assert.equal(placeRange("2024-02-29", "2024-02-29", year)?.left, 59 / 366);
  const month = ganttPeriod(leap, "Monthly");
  assert.equal(month.days, 29);
  assert.equal(placeRange("2024-02-29", "2024-02-29", month)?.width, 1 / 29);
});

test("the timeline keeps one row per overlapping task, with either date usable alone", () => {
  function task(title: string, date: string, deadline: string): Task {
    return {
      id: title,
      title,
      date,
      deadline,
      createdAt: 1,
      sectionId: title,
      assignedBy: "",
      assignedTo: "",
      status: "To Do",
      priority: "",
    };
  }
  const { ranges, unscheduled } = indexCalendarTasks([
    task("Deadline only", "", "2026-11-30"),
    task("Ongoing", "2026-10-10", "2026-12-01"),
    task("Start only", "2026-11-02", ""),
    task("Undated", "", ""),
    task("Later", "2027-01-15", ""),
  ]);
  const rows = ganttRows(ranges, ganttPeriod(new Date(2026, 10, 5), "Monthly"));
  assert.deepEqual(
    rows.map(({ task }) => task.title),
    ["Ongoing", "Start only", "Deadline only"],
  );
  assert.equal(rows[0].bar.width, 1);
  assert.equal(rows[1].bar.width, 1 / 30);
  assert.equal(rows[2].bar.left, 29 / 30);
  assert.equal(unscheduled[0].task.title, "Undated");
});
