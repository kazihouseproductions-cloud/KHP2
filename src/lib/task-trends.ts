import { dayKey } from "./calendar";
import { memberPerformance } from "./member-performance";
import { demoMembers, memberNameKey } from "./members";
import type { HistoryEntry } from "./task-history";
import type { MemberCount } from "./task-summary";

export type TrendDay = {
  day: string;
  approvals: number | null;
  approved: number | null;
  total: number | null;
  scores: Map<string, number | null>;
};

export function taskTrends(history: readonly HistoryEntry[], length: number, today: Date) {
  const baseline = history.find((entry) => entry.id === "baseline");
  const since = baseline && dayKey(new Date(baseline.createdAt));
  const members = new Map<string, MemberCount>(
    demoMembers.map((member) => [
      memberNameKey(member.name),
      { member, name: member.name, count: 0, approved: 0 },
    ]),
  );
  const days: TrendDay[] = [];
  let cursor = 0,
    total = 0,
    approved = 0;
  // Storage returns entries in timestamp order. Replay older changes too, so a
  // shorter window still opens with the task state carried into its first day.
  for (let offset = 1 - length; offset <= 0; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const day = dayKey(date);
    const until = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    let approvals = 0;
    while (cursor < history.length && history[cursor].createdAt < until) {
      const event = history[cursor++];
      total += event.count;
      approved += event.approved;
      if (event.createdAt >= date.getTime()) approvals += event.approvals;
      for (const delta of event.members) {
        const key = memberNameKey(delta.name);
        const row = members.get(key) ?? { name: delta.name, count: 0, approved: 0 };
        row.count += delta.count;
        row.approved += delta.approved;
        members.set(key, row);
      }
    }
    const tracked = since !== undefined && day >= since;
    const scores = new Map<string, number | null>();
    if (tracked) {
      for (const [key, row] of members) scores.set(key, memberPerformance(row).score);
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
