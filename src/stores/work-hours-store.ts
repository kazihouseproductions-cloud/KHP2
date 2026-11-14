import { create } from "zustand";
import { memberWorkspaceRefs, withActivity } from "@/lib/activity-log";
import { readRecords, watchRecords } from "@/lib/local-records";
import { readMemberDirectory } from "@/lib/member-records";
import { currentMember } from "@/lib/members";
import {
  workHoursPrefix as prefix,
  clockLabel,
  isWeekRoutine,
  type MemberRoutine,
  routineDays,
  sampleWeek,
  type WeekRoutine,
} from "@/lib/work-hours";

function isMemberRoutine(value: unknown): value is MemberRoutine {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<MemberRoutine>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    Number.isFinite(row.createdAt) &&
    isWeekRoutine(row.days)
  );
}

type WorkHoursState = {
  routines: ReadonlyMap<string, MemberRoutine>;
  loadError: string;
  load: () => void;
  save: (id: MemberRoutine["id"], days: WeekRoutine, original?: MemberRoutine) => Promise<void>;
};

export const useWorkHoursStore = create<WorkHoursState>((set) => ({
  routines: new Map(),
  loadError: "",
  load() {
    try {
      const records = readRecords(prefix, isMemberRoutine);
      set({ routines: new Map(records.map((record) => [record.id, record])), loadError: "" });
    } catch {
      set({ loadError: "Work hours could not be loaded from this browser." });
    }
  },
  async save(id, days, original) {
    if (!isWeekRoutine(days))
      throw new Error("Enter different start and end times for each working day.");
    const key = prefix + id;
    function write() {
      const directory = readMemberDirectory();
      if (currentMember(directory).role !== "Admin")
        throw new Error("Only admins can change working hours.");
      const raw = localStorage.getItem(key);
      if (raw !== (original ? JSON.stringify(original) : null))
        throw new Error(
          "This routine changed in another tab. Reopen the editor to use the latest hours.",
        );
      const record: MemberRoutine = { id, days, createdAt: original?.createdAt ?? Date.now() };
      const changed = routineDays.filter((day) => {
        const prior = (original?.days ?? sampleWeek)[day];
        return prior?.start !== days[day]?.start || prior?.end !== days[day]?.end;
      });
      if (original && !changed.length) return;
      const detail = changed
        .map((day) => {
          const shift = days[day];
          return shift
            ? `${day} ${clockLabel(shift.start)}–${clockLabel(shift.end)}${shift.end < shift.start ? " (next day)" : ""}`
            : `${day} off`;
        })
        .join(" · ");
      const name = directory.find((member) => member.id === id)?.name;
      if (!name) throw new Error("This member is no longer available.");
      withActivity(
        {
          area: "Work Hours",
          description: `${original ? "Updated" : "Set"} the weekly routine for ${name}`,
          detail: detail || "Saved the sample week",
          workspaces: memberWorkspaceRefs(id),
        },
        () => localStorage.setItem(key, JSON.stringify(record)),
      );
      set((state) => ({ routines: new Map(state.routines).set(id, record) }));
    }
    if (navigator.locks) await navigator.locks.request(key, async () => write());
    else write();
  },
}));

export function listenToWorkHours() {
  return watchRecords(prefix, useWorkHoursStore.getState().load);
}
