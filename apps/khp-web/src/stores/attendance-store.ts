import { create } from "zustand";
import { memberWorkspaceRefs, withActivity } from "@/lib/activity-log";
import { readMemberDirectory } from "@/lib/member-records";
import {
  type AttendanceEntry,
  type AttendanceIndex,
  attendanceId,
  isAttendanceEntry,
} from "@/lib/attendance";
import { readRecords, watchRecords } from "@/lib/local-records";

const prefix = "khp.attendance.v1.";
type Change = Pick<AttendanceEntry, "status"> | Pick<AttendanceEntry, "note">;
type AttendanceStore = {
  entries: AttendanceIndex;
  loadError: string;
  load: () => void;
  save: (memberId: AttendanceEntry["memberId"], day: string, change: Change) => Promise<void>;
};

export const useAttendanceStore = create<AttendanceStore>((set) => ({
  entries: new Map(),
  loadError: "",
  load() {
    try {
      const records = readRecords(prefix, isAttendanceEntry);
      set({ entries: new Map(records.map((entry) => [entry.id, entry])), loadError: "" });
    } catch {
      set({ loadError: "Attendance could not be loaded from this browser." });
    }
  },
  async save(memberId, day, change) {
    const id = attendanceId(memberId, day);
    const key = prefix + id;
    function write() {
      const raw = localStorage.getItem(key);
      const previous: unknown = raw === null ? null : JSON.parse(raw);
      if (raw !== null && (!isAttendanceEntry(previous) || previous.id !== id))
        throw new Error("This attendance record could not be read.");
      const entry: AttendanceEntry = {
        id,
        memberId,
        day,
        status: null,
        note: "",
        createdAt: Date.now(),
        ...(isAttendanceEntry(previous) ? previous : {}),
        ...change,
      };
      if (!isAttendanceEntry(entry)) throw new Error("Invalid attendance record.");
      const before = isAttendanceEntry(previous) ? previous : undefined;
      if (entry.status === (before?.status ?? null) && entry.note === (before?.note ?? "")) return;
      const empty = entry.status === null && !entry.note;
      const name = readMemberDirectory().find((member) => member.id === memberId)?.name;
      if (!name) throw new Error("This member is no longer available.");
      const description =
        "status" in change
          ? entry.status
            ? `Marked ${name} as ${entry.status}`
            : `Cleared attendance for ${name}`
          : `${entry.note ? (before?.note ? "Edited" : "Added") : "Removed"} an attendance note for ${name}`;
      withActivity(
        { area: "Attendance", description, detail: day, workspaces: memberWorkspaceRefs(memberId) },
        () => {
          if (empty) localStorage.removeItem(key);
          else localStorage.setItem(key, JSON.stringify(entry));
        },
      );
      set((state) => {
        const entries = new Map(state.entries);
        if (empty) entries.delete(id);
        else entries.set(id, entry);
        return { entries };
      });
    }
    // A note and a status can be edited in different tabs on the same day.
    if (navigator.locks) await navigator.locks.request(key, write);
    else write();
  },
}));

export function listenToAttendance() {
  return watchRecords(prefix, useAttendanceStore.getState().load);
}
