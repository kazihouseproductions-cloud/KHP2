import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/common/scroll-area";
import {
  WorkspaceMemberFilter,
  type WorkspaceRoster,
} from "@/components/common/workspace-member-filter";
import { memberNameKey } from "@/lib/members";
import { useToday } from "@/hooks/use-today";
import { listenToAttendance, useAttendanceStore } from "@/stores/attendance-store";
import { listenToHistory, type HistoryEntry } from "@/lib/task-history";
import { taskTrends } from "@/lib/task-trends";
import { dateLabel, decimal, scoreLabel, TrendChart } from "./trend-chart";

type Trends = ReturnType<typeof taskTrends>;

function PerformanceComparison({ days, members }: Trends) {
  const first = days.find((day) => day.total !== null);
  const latest = days[days.length - 1];
  return (
    <section aria-labelledby="compare-members" className="mt-8 border-t border-neutral-200 pt-6">
      <h2 id="compare-members" className="text-lg font-semibold">
        Member comparison
      </h2>
      <p className="mt-1 mb-4 text-sm text-neutral-600">
        First tracked day in this range compared with today. Changes are in percentage points.
      </p>
      <table aria-labelledby="compare-members" className="w-full table-fixed text-sm tabular-nums">
        <thead className="border-y border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
          <tr>
            <th scope="col" className="w-[37%] p-2 text-left font-medium">
              Member
            </th>
            <th scope="col" className="p-2 text-right font-medium">
              {first ? dateLabel(first.day) : "First day"}
            </th>
            <th scope="col" className="p-2 text-right font-medium">
              Today
            </th>
            <th scope="col" className="p-2 text-right font-medium">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map(({ key, name }) => {
            const a = first?.scores.get(key),
              b = latest.scores.get(key);
            const delta = first?.day !== latest.day && a != null && b != null ? b - a : null;
            return (
              <tr key={key} className="border-b border-neutral-200">
                <th scope="row" className="break-words px-2 py-3 text-left font-medium">
                  {name}
                </th>
                <td className="px-2 text-right">{scoreLabel(a)}</td>
                <td className="px-2 text-right">{scoreLabel(b)}</td>
                <td className="px-2 text-right">
                  {delta === null ? "—" : `${delta > 0 ? "+" : ""}${decimal.format(delta)} pp`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function TrendPanels({ trends }: { trends: Trends }) {
  const { days, members } = trends;
  const latest = days[days.length - 1];
  const [choice, setChoice] = useState("");
  const selected =
    members.find((m) => m.key === choice) ??
    members.find((m) => latest.scores.get(m.key) != null) ??
    members[0];
  const score = selected && latest.scores.get(selected.key);
  return (
    <>
      <div className="mt-6 grid gap-5 @3xl:grid-cols-2">
        <section
          aria-labelledby="approvals-trend"
          className="flex min-w-0 flex-col rounded-xl border border-neutral-200 p-4 sm:p-5"
        >
          <h2 id="approvals-trend" className="text-lg font-semibold">
            Task approvals
          </h2>
          <p className="mt-2 text-3xl font-medium tabular-nums">
            {days.reduce((n, d) => n + (d.approvals ?? 0), 0)}
          </p>
          <p className="mt-1 mb-4 text-sm text-neutral-600">
            Approvals in this range · {latest.approved} of {latest.total} tasks currently approved
          </p>
          <div className="mt-auto">
            <TrendChart
              kind="approvals"
              points={days.map((d) => ({ day: d.day, value: d.approvals }))}
            />
          </div>
          <p className="mt-3 text-xs text-neutral-600">
            Each move into Approved counts, including reapprovals.
          </p>
        </section>
        <section
          aria-labelledby="score-trend"
          className="flex min-w-0 flex-col rounded-xl border border-neutral-200 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="score-trend" className="text-lg font-semibold">
              Member performance
            </h2>
            <select
              aria-label="Member for performance trend"
              value={selected?.key ?? ""}
              disabled={!selected}
              onChange={(e) => setChoice(e.target.value)}
              className="max-w-full rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs"
            >
              {!selected && <option value="">No members</option>}
              {members.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-3xl font-medium tabular-nums">
            {score == null ? "Not scored" : scoreLabel(score)}
          </p>
          <p className="mt-1 mb-4 text-sm text-neutral-600">
            {selected ? `Latest score · ${selected.name}` : "No members in this workspace yet."}
          </p>
          <div className="mt-auto">
            <TrendChart
              kind="score"
              points={days.map((d) => ({
                day: d.day,
                value: (selected && d.scores.get(selected.key)) ?? null,
              }))}
            />
          </div>
          <p className="mt-3 text-xs text-neutral-600">
            Each day’s score averages the approval and attendance rates through that date. A score
            needs assigned tasks and at least one counted attendance day.
          </p>
        </section>
      </div>
      <details className="mt-4 rounded-lg border border-neutral-200 px-3 text-sm">
        <summary className="cursor-pointer py-3 font-medium">Daily figures</summary>
        <table aria-label="Daily figures" className="mb-3 w-full text-right text-xs tabular-nums">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-600">
              <th scope="col" className="py-2 text-left">
                Day
              </th>
              <th scope="col">Approvals</th>
              <th scope="col">Approved / total</th>
              <th scope="col">{selected?.name ?? "Score"}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-b border-neutral-100">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {dateLabel(d.day)}
                </th>
                <td>{d.approvals ?? "—"}</td>
                <td>{d.total === null ? "—" : `${d.approved} / ${d.total}`}</td>
                <td>{scoreLabel(selected && d.scores.get(selected.key))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <PerformanceComparison {...trends} />
    </>
  );
}

export function TaskAnalytics({ roster }: { roster: WorkspaceRoster }) {
  const [history, setHistory] = useState<HistoryEntry[] | null>();
  const [length, setLength] = useState(7);
  const today = useToday();
  const entries = useAttendanceStore((s) => s.entries);
  useEffect(() => listenToHistory(setHistory), []);
  useEffect(listenToAttendance, []);
  const trends = useMemo(
    () =>
      history &&
      taskTrends(history, length, new Date(`${today}T12:00:00`), entries, roster.directory),
    [history, length, today, entries, roster.directory],
  );
  return (
    <div className="task-tool">
      <ScrollArea
        label="Analytics"
        className="@container min-h-0 flex-1 overflow-y-auto px-1 pb-24"
      >
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Task trends</h1>
            <p className="mt-1 text-sm text-neutral-600">Across all workspaces</p>
          </div>
          <WorkspaceMemberFilter roster={roster} />
          <fieldset aria-label="Time range" className="flex gap-1 rounded-full bg-neutral-100 p-1">
            {[7, 30, 90].map((n) => (
              <button
                type="button"
                key={n}
                aria-pressed={n === length}
                onClick={() => setLength(n)}
                className="rounded-full px-3 py-1.5 text-xs font-medium aria-pressed:bg-brand aria-pressed:text-white"
              >
                {n} days
              </button>
            ))}
          </fieldset>
        </header>
        {trends ? (
          <>
            <p className="mt-4 text-sm text-neutral-600">
              Tracking since{" "}
              {new Date(`${trends.since}T12:00:00`).toLocaleDateString("en", {
                dateStyle: "medium",
              })}{" "}
              in this browser. Existing tasks set the starting totals; earlier dates have no
              history.
            </p>
            <TrendPanels
              trends={
                roster.workspace
                  ? {
                      ...trends,
                      members: trends.members.filter((row) =>
                        roster.members.some((m) => memberNameKey(m.name) === row.key),
                      ),
                    }
                  : trends
              }
            />
          </>
        ) : (
          <p className="mt-5 text-sm text-neutral-600">
            {history === null
              ? "Task history is unavailable in this browser."
              : "Loading task history…"}
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
