import { dayKey } from "./calendar";
import type { AttendanceIndex } from "./attendance";
import { attendanceRatesByDay, memberPerformance } from "./member-performance";
import { type Member, demoMembers, indexMemberNames, memberNameKey } from "./members";
import type { HistoryEntry } from "./task-history";
import type { MemberCount } from "./task-summary";

export type TrendDay = {
  day: string;
  approvals: number | null;
  approved: number | null;
  total: number | null;
  scores: Map<string, number | null>;
};

export function taskTrends(
  history: readonly HistoryEntry[],
  length: number,
  today: Date,
  attendance: AttendanceIndex,
  directory: readonly Member[] = demoMembers,
) {
  const baseline = history.find((entry) => entry.id === "baseline");
  const since = baseline && dayKey(new Date(baseline.createdAt));
  const members = new Map<string, MemberCount>(
    directory.map((member) => [
      memberNameKey(member.name),
      { member, name: member.name, count: 0, approved: 0 },
    ]),
  );
  const names = indexMemberNames(directory);
  const days: TrendDay[] = [];
  const dates = Array.from(
    { length },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i + 1 - length),
  );
  const rates = attendanceRatesByDay(attendance, dates.map(dayKey));
  let cursor = 0,
    total = 0,
    approved = 0;
  // Storage returns entries in timestamp order. Replay older changes too, so a
  // shorter window still opens with the task state carried into its first day.
  for (const date of dates) {
    const day = dayKey(date);
    const until = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    let approvals = 0;
    while (cursor < history.length && history[cursor].createdAt < until) {
      const event = history[cursor++];
      total += event.count;
      approved += event.approved;
      if (event.createdAt >= date.getTime()) approvals += event.approvals;
      for (const delta of event.members) {
        const name = names.get(memberNameKey(delta.name))?.name ?? delta.name;
        const key = memberNameKey(name);
        const row = members.get(key) ?? { name, count: 0, approved: 0 };
        row.count += delta.count;
        row.approved += delta.approved;
        members.set(key, row);
      }
    }
    const tracked = since !== undefined && day >= since;
    const scores = new Map<string, number | null>();
    if (tracked) {
      for (const [key, row] of members)
        scores.set(key, memberPerformance(row, rates.get(day)).score);
    }
    days.push({
      day,
      total: tracked ? total : null,
      approved: tracked ? approved : null,
      approvals: tracked ? approvals : null,
      scores,
    });
  }
  return { since, days, members: [...members].map(([key, row]) => ({ key, name: row.name })) };
}
