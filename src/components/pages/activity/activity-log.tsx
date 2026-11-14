import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/common/scroll-area";
import {
  MemberFilter,
  WorkspaceMemberFilter,
  type WorkspaceRoster,
} from "@/components/common/workspace-member-filter";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { type ActivityEntry, filterActivity, listenToActivity } from "@/lib/activity-log";
import { useMemberDirectory } from "@/stores/member-store";

const timestamp = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const directory = useMemberDirectory();
  const actor = directory.find((m) => m.id === entry.actorId);
  const when = new Date(entry.createdAt);
  const context = [entry.area, ...entry.workspaces.map((workspace) => workspace.title)].join(" · ");
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-neutral-200 py-4 @2xl:grid-cols-[auto_minmax(0,1fr)_auto]">
      {actor ? <MemberAvatar member={actor} /> : <span />}
      <div className="min-w-0 break-words">
        <p className="text-sm">
          <strong className="font-semibold">{entry.actorName}</strong>
        </p>
        <p className="mt-0.5 text-sm">{entry.description}</p>
        {entry.detail && <p className="mt-1 text-xs text-neutral-600">{entry.detail}</p>}
        <p className="mt-1.5 text-xs text-neutral-500">{context}</p>
      </div>
      <time
        className="col-start-2 text-xs tabular-nums text-neutral-600 @2xl:col-start-3 @2xl:pt-0.5"
        dateTime={when.toISOString()}
        title={when.toLocaleString()}
      >
        {timestamp.format(when)}
      </time>
    </li>
  );
}

export function ActivityLog({ roster }: { roster: WorkspaceRoster }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>();
  const [memberId, setMemberId] = useState("");
  useEffect(() => listenToActivity(setEntries), []);
  const actor = roster.members.find((member) => member.id === memberId);
  const visible = entries && filterActivity(entries, roster.workspace?.id, actor?.id);
  return (
    <div className="task-tool">
      <ScrollArea
        label="Workspace activity"
        className="@container min-h-0 flex-1 overflow-y-auto px-1 pb-24"
      >
        <header className="mb-2 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Activity log</h1>
          <div className="flex flex-wrap items-center gap-3">
            <WorkspaceMemberFilter roster={roster} />
            <MemberFilter members={roster.members} value={actor?.id ?? ""} onChange={setMemberId} />
          </div>
        </header>
        {visible?.length ? (
          <ol aria-label="Activity, newest first">
            {visible.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ol>
        ) : (
          <p role="status" className="py-5 text-sm text-neutral-600">
            {entries === null
              ? "Activity could not be loaded from this browser."
              : !entries
                ? "Loading activity…"
                : entries.length
                  ? "No activity matches these filters."
                  : "No activity recorded yet. New changes in this browser will appear here."}
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
