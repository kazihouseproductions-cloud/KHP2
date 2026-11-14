import assert from "node:assert/strict";
import { test } from "node:test";
import { clockLabel, isWeekRoutine, routineDays, sampleWeek } from "../src/lib/work-hours.ts";
import { useWorkHoursStore } from "../src/stores/work-hours-store.ts";
import { previewMember } from "../src/lib/members.ts";

test("weekly shifts preserve wall-clock times, days off, and overnight endings", () => {
  assert.deepEqual(
    routineDays.filter((day) => !sampleWeek[day]),
    ["Saturday", "Friday"],
  );
  assert.deepEqual(
    [clockLabel("00:00"), clockLabel("12:00"), clockLabel("19:05")],
    ["12 AM", "12 PM", "7:05 PM"],
  );
  assert.ok(isWeekRoutine({ ...sampleWeek, Tuesday: { start: "22:30", end: "04:45" } }));
  for (const end of ["", "24:00", "12:60", "10:00"]) {
    assert.equal(isWeekRoutine({ ...sampleWeek, Monday: { start: "10:00", end } }), false);
  }
  assert.equal(isWeekRoutine({ ...sampleWeek, Friday: undefined }), false);
});

test("saved routines survive reloads and stale editors cannot replace a newer week", async () => {
  const records = new Map<string, string>();
  records.set("khp.members.v1.ayesha", JSON.stringify({ ...previewMember, role: "Admin", createdAt: 1 }));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return records.size;
      },
      key: (index: number) => [...records.keys()][index] ?? null,
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
    },
  });
  const { load, save } = useWorkHoursStore.getState();
  const mondayOff = { ...sampleWeek, Monday: null };
  await save("nadia", mondayOff);
  await assert.rejects(save("nadia", sampleWeek), /another tab/);
  load();
  const first = useWorkHoursStore.getState().routines.get("nadia");
  assert.deepEqual(first?.days, mondayOff);
  const updated = { ...mondayOff, Sunday: { start: "08:30", end: "17:00" } };
  await save("nadia", updated, first);
  await assert.rejects(save("nadia", sampleWeek, first), /another tab/);
  await save("rafi", sampleWeek);
  load();
  assert.deepEqual(useWorkHoursStore.getState().routines.get("nadia")?.days, updated);
  assert.deepEqual(useWorkHoursStore.getState().routines.get("rafi")?.days, sampleWeek);
});
