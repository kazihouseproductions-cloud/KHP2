import type { AttendanceIndex } from "./attendance";
import type { MemberCount } from "./task-summary";

// The reporting days are ascending. Replay earlier marks too so changing an
// Analytics window doesn't change a score for a date shared by both windows.
export function attendanceRatesByDay(entries: AttendanceIndex, days: readonly string[]) {
  const marks = [...entries.values()]
    .filter((entry) => entry.status !== null && entry.status !== "Leave")
    .sort((a, b) => a.day.localeCompare(b.day));
  const counts = new Map<string, { attended: number; marked: number }>();
  const rates = new Map<string, Map<string, number>>();
  let cursor = 0;
  for (const day of days) {
    while (cursor < marks.length && marks[cursor].day <= day) {
      const mark = marks[cursor++];
      const count = counts.get(mark.memberId) ?? { attended: 0, marked: 0 };
      count.marked++;
      if (mark.status !== "Absent") count.attended++;
      counts.set(mark.memberId, count);
    }
    rates.set(
      day,
      new Map([...counts].map(([id, count]) => [id, (100 * count.attended) / count.marked])),
    );
  }
  return rates;
}

export function memberPerformance(
  { member, count, approved }: MemberCount,
  rates: ReadonlyMap<string, number> | undefined,
) {
  const attendance = member ? (rates?.get(member.id) ?? null) : null;
  const approval = count > 0 ? (approved / count) * 100 : null;
  const score = approval !== null && attendance !== null ? (approval + attendance) / 2 : null;
  return { approval, attendance, score };
}
