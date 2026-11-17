import assert from "node:assert/strict";
import { test } from "node:test";
import { attendanceId, isAttendanceEntry, type AttendanceEntry } from "../src/lib/attendance.ts";
import { attendanceReport, attendanceCsv } from "../src/lib/attendance-export.ts";
import { demoMembers } from "../src/lib/members.ts";
import { useAttendanceStore } from "../src/stores/attendance-store.ts";

test("range reports include each date and member, including note-only and unmarked days", () => {
  const [first, second] = demoMembers;
  const id = attendanceId(first.id, "2024-02-29");
  const entry: AttendanceEntry = {
    id,
    day: "2024-02-29",
    memberId: first.id,
    createdAt: 1,
    status: null,
    note: 'Team, "onsite"\nnext shift',
  };
  const entries = new Map([[id, entry]]);
  const rows = attendanceReport(entries, [first, second], "2024-02-28", "2024-03-01");
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[2], ["2024-02-29", first.name, "Unmarked", entry.note]);
  assert.deepEqual(rows[5], ["2024-03-01", second.name, "Unmarked", ""]);
  assert.equal(attendanceReport(entries, [second], "2024-02-29", "2024-02-29").length, 1);
  assert.throws(() => attendanceReport(entries, [first], "2024-03-01", "2024-02-29"));
  assert.throws(() => attendanceReport(entries, [first], "2025-02-29", "2025-03-01"));
  assert.ok(attendanceCsv(rows).includes('"Team, ""onsite""\nnext shift"'));
  assert.ok(attendanceCsv([["2024-02-29", first.name, "WFH", "=1+1"]]).includes(`"'=1+1"`));
  assert.equal(isAttendanceEntry({ ...entry, id: "wrong member" }), false);
});

test("saving separate fields merges with the latest record, clearing a status preserves the note", async () => {
  const records = new Map<string, string>();
  const storage = {
    get length() {
      return records.size;
    },
    key: (index: number) => [...records.keys()][index] ?? null,
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => records.set(key, value),
    removeItem: (key: string) => records.delete(key),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  const { save, load } = useAttendanceStore.getState();
  const day = "2026-02-28";
  const id = attendanceId("nadia", day);
  await save("nadia", day, { status: "Present" });
  const key = `khp.attendance.v1.${id}`;
  const raw = records.get(key)!;
  records.set(key, JSON.stringify({ ...JSON.parse(raw), status: "Late" }));
  await save("nadia", day, { note: "Delayed bus" });
  assert.equal(useAttendanceStore.getState().entries.get(id)?.status, "Late");
  await save("nadia", day, { status: null });
  load();
  assert.equal(useAttendanceStore.getState().entries.get(id)?.note, "Delayed bus");
  await save("nadia", day, { note: "" });
  assert.equal([...records.keys()].filter((key) => key.startsWith("khp.attendance.v1.")).length, 0);
  assert.equal(useAttendanceStore.getState().entries.size, 0);
});
