import { useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/common/scroll-area";
import {
  WorkspaceMemberFilter,
  type WorkspaceRoster,
} from "@/components/common/workspace-member-filter";
import { attendanceRatesByDay } from "@/lib/member-performance";
import { useToday } from "@/hooks/use-today";
import { listenToAttendance, useAttendanceStore } from "@/stores/attendance-store";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { memberTasksHref } from "@/lib/board-route";
import { summarizeTasks } from "@/lib/task-summary";
import { listenToTaskStorage, useTaskStore } from "@/stores/task-store";
import { MemberPerformanceTable } from "./member-performance-table";

type Summary = ReturnType<typeof summarizeTasks>;
const number = new Intl.NumberFormat("en");

function CountBar({ count, total }: { count: number; total: number }) {
  return (
    <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
      <div
        className="h-full rounded-full bg-[#76bfeb]"
        style={{ width: `${total ? (count / total) * 100 : 0}%` }}
      />
    </div>
  );
}

function StatusCounts({ statuses, total }: Pick<Summary, "statuses" | "total">) {
  return (
    <section aria-labelledby="status-counts">
      <h2 id="status-counts" className="mb-4 text-lg font-semibold">
        Tasks by status
      </h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200">
        {statuses.map(({ status, count }) => (
          <div key={status} className="bg-white p-4 sm:p-5">
            <dt className="text-sm text-neutral-600">{status}</dt>
            <dd className="mt-2 mb-4 text-3xl font-medium tabular-nums">{number.format(count)}</dd>
            <CountBar count={count} total={total} />
          </div>
        ))}
      </dl>
    </section>
  );
}

function MemberCounts({
  members,
  unassigned,
}: {
  members: Summary["members"];
  unassigned?: number;
}) {
  return (
    <section aria-labelledby="member-counts">
      <h2 id="member-counts" className="mb-4 text-lg font-semibold">
        Tasks by member
      </h2>
      <table aria-labelledby="member-counts" className="w-full table-fixed border-collapse text-sm">
        <thead className="border-y border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Assigned to
            </th>
            <th scope="col" className="w-20 px-3 py-2 text-right font-medium">
              Tasks
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map(({ member, name, count }) => (
            <tr key={name} className="border-b border-neutral-200">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {member ? (
                  <a
                    href={memberTasksHref("#/", member.id)}
                    className="group flex w-fit max-w-full items-center gap-2.5 rounded hover:text-brand"
                  >
                    <MemberAvatar member={member} />
                    <span className="break-words group-hover:underline">{name}</span>
                    <span className="shrink-0 text-neutral-400">
                      <Icon name="chevron" size={12} />
                    </span>
                  </a>
                ) : (
                  <span className="block break-words py-2">{name}</span>
                )}
              </th>
              <td className="px-3 text-right font-medium tabular-nums">{number.format(count)}</td>
            </tr>
          ))}
        </tbody>
        {unassigned !== undefined && (
          <tfoot>
            <tr className="text-neutral-600">
              <th scope="row" className="px-3 py-3 text-left font-normal">
                Unassigned
              </th>
              <td className="px-3 text-right tabular-nums">{number.format(unassigned)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  );
}

export function TaskDashboard({ roster }: { roster: WorkspaceRoster }) {
  const tasks = useTaskStore((state) => state.tasks);
  const entries = useAttendanceStore((s) => s.entries);
  const today = useToday();
  useEffect(listenToTaskStorage, []);
  useEffect(listenToAttendance, []);
  const rates = useMemo(() => attendanceRatesByDay(entries, [today]).get(today), [entries, today]);
  const summary = useMemo(() => summarizeTasks(tasks, roster.directory), [tasks, roster.directory]);
  const members = roster.workspace
    ? summary.members.filter((row) => roster.members.some((m) => m.id === row.member?.id))
    : summary.members;
  return (
    <div className="task-tool">
      <ScrollArea
        label="Dashboard"
        className="@container min-h-0 flex-1 overflow-y-auto px-1 pb-24"
      >
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Task overview</h1>
            <p className="mt-1 text-sm text-neutral-600">Across all workspaces</p>
          </div>
          <WorkspaceMemberFilter roster={roster} />
          <p className="shrink-0 text-right">
            <span className="block text-3xl leading-none font-semibold tabular-nums">
              {number.format(summary.total)}
            </span>
            <span className="text-xs text-neutral-600">Total tasks</span>
          </p>
        </header>
        {!summary.total && (
          <p className="mt-4 text-sm text-neutral-600">
            No tasks yet. Tasks you create on a board will appear here.
          </p>
        )}
        <div className="mt-7 grid items-start gap-8 @3xl:grid-cols-2 @3xl:gap-12">
          <StatusCounts statuses={summary.statuses} total={summary.total} />
          <MemberCounts
            members={members}
            unassigned={roster.workspace ? undefined : summary.unassigned}
          />
        </div>
        {!members.length && (
          <p className="mt-4 text-sm text-neutral-600">No members in this workspace yet.</p>
        )}
        <MemberPerformanceTable members={members} rates={rates} />
      </ScrollArea>
    </div>
  );
}
