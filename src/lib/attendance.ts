import { usableDate } from "./calendar";
import type { Member } from "./members";

export const attendanceStatuses = ["Present", "Late", "Absent", "Leave", "WFH"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];
export type AttendanceEntry = {
  id: string;
  memberId: Member["id"];
  day: string;
  status: AttendanceStatus | null;
  note: string;
  createdAt: number;
};
export type AttendanceIndex = ReadonlyMap<string, AttendanceEntry>;

export function attendanceId(memberId: Member["id"], day: string) {
  return `${day}/${memberId}`;
}

export function isAttendanceEntry(value: unknown): value is AttendanceEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<AttendanceEntry>;
  return (
    typeof e.day === "string" &&
    usableDate(e.day) &&
    typeof e.memberId === "string" && e.memberId.length > 0 &&
    e.id === attendanceId(e.memberId, e.day) &&
    (e.status === null || attendanceStatuses.some((status) => status === e.status)) &&
    typeof e.note === "string" &&
    typeof e.createdAt === "number"
  );
}
