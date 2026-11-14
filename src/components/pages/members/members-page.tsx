import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/common/scroll-area";
import { Modal } from "@/components/common/modal";
import {
  WorkspaceMemberFilter,
  type WorkspaceRoster,
} from "@/components/common/workspace-member-filter";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { memberTasksHref } from "@/lib/board-route";
import { currentMember, getPinMemberIds, type Member, memberNameKey } from "@/lib/members";
import type { BoardItem } from "@/lib/workspaces";
import { useMemberStore } from "@/stores/member-store";
import type { MemberRoutine } from "@/lib/work-hours";
import { listenToWorkHours, useWorkHoursStore } from "@/stores/work-hours-store";
import { MemberProfile } from "./member-profile";
import { MemberForm } from "./member-form";

export function MembersPage({ roster }: { roster: WorkspaceRoster }) {
  const actor = currentMember(roster.directory);
  const canEdit = (member: Member) => actor.role === "Admin" || member.id === actor.id;
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<
    | { kind: "add" }
    | { kind: "view"; id: string }
    | { kind: "edit"; member: Member; routine?: MemberRoutine }
    | null
  >(null);
  const routines = useWorkHoursStore((state) => state.routines);
  const hoursError = useWorkHoursStore((state) => state.loadError);
  useEffect(listenToWorkHours, []);
  const viewing =
    dialog?.kind === "view"
      ? roster.directory.find((member) => member.id === dialog.id)
      : undefined;
  function edit(member: Member) {
    setDialog({ kind: "edit", member, routine: routines.get(member.id) });
  }
  const [notice, setNotice] = useState("");
  const error = useMemberStore((state) => state.loadError);
  const workspacesByMember = useMemo(() => {
    const index = new Map<string, BoardItem[]>();
    for (const workspace of roster.workspaces) {
      for (const id of new Set(getPinMemberIds(workspace))) {
        const list = index.get(id);
        if (list) list.push(workspace);
        else index.set(id, [workspace]);
      }
    }
    return index;
  }, [roster.workspaces]);
  const search = memberNameKey(query);
  const visible = roster.members
    .filter((member) => memberNameKey(member.name).includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="task-tool">
      <ScrollArea
        label="Member directory"
        className="@container min-h-0 flex-1 overflow-y-auto px-1 pb-24"
      >
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <button
            type="button"
            className="attendance-primary inline-flex items-center gap-2"
            onClick={() => setDialog({ kind: "add" })}
          >
            <Icon name="plus" size={16} /> Add member
          </button>
        </header>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <WorkspaceMemberFilter roster={roster} />
          <input
            type="search"
            aria-label="Search members by name"
            placeholder="Search members by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="attendance-date-input w-full @lg:w-64"
          />
        </div>
        <p role="status" className="sr-only">
          {notice}
        </p>
        {(error || hoursError) && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {error || hoursError}
          </p>
        )}
        {visible.length ? (
          <div className="overflow-x-auto">
            <table
              className="w-full table-fixed border-collapse text-left text-sm"
              aria-label="Members"
            >
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-600 @max-lg:sr-only">
                <tr>
                  <th scope="col" className="w-1/4 px-3 py-2.5">
                    Name
                  </th>
                  <th scope="col" className="w-[14%] px-3 py-2.5">
                    Role
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Workspaces
                  </th>
                  <th scope="col" className="w-[112px] px-3 py-2.5">
                    Actions
                  </th>
                  <th scope="col" className="w-36 px-3 py-2.5">
                    View Task Board
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-neutral-100 @max-lg:grid @max-lg:grid-cols-[minmax(0,1fr)_auto] @max-lg:gap-1.5 @max-lg:py-3"
                  >
                    <th
                      scope="row"
                      className="px-3 py-3.5 font-medium @max-lg:col-span-2 @max-lg:px-1 @max-lg:py-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <MemberAvatar member={member} />
                        <div className="min-w-0 break-words">
                          {member.name}
                          {member.jobTitle && (
                            <span className="mt-0.5 block text-xs font-normal text-neutral-600">
                              {member.jobTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <td className="break-words px-3 py-3 text-neutral-700 @max-lg:col-start-1 @max-lg:px-1 @max-lg:py-0">
                      <span className="text-xs text-neutral-500 @lg:hidden">Role · </span>
                      {member.role}
                    </td>
                    <td className="px-3 py-3 @max-lg:col-span-2 @max-lg:px-1 @max-lg:py-0">
                      {workspacesByMember.has(member.id) ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {workspacesByMember.get(member.id)?.map((workspace) => (
                            <li
                              key={workspace.id}
                              className="max-w-full break-words rounded-md border border-neutral-200 px-2 py-0.5 text-xs"
                            >
                              {workspace.title}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-neutral-500">No workspaces</span>
                      )}
                    </td>
                    <td className="px-2 py-3 @max-lg:col-start-1 @max-lg:p-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="attendance-mark"
                          onClick={() => setDialog({ kind: "view", id: member.id })}
                        >
                          View
                        </button>
                        {canEdit(member) && (
                          <button
                            type="button"
                            className="attendance-mark"
                            onClick={() => edit(member)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 @max-lg:col-start-2 @max-lg:p-1">
                      <a
                        href={memberTasksHref("#/", member.id)}
                        className="attendance-mark inline-flex whitespace-nowrap"
                      >
                        View Task Board<span className="sr-only"> for {member.name}</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-sm text-neutral-600">
            {search ? "No members match your search." : "No members in this workspace yet."}
          </p>
        )}
      </ScrollArea>
      {viewing && (
        <Modal
          title="Member profile"
          onClose={() => setDialog(null)}
          className="workspace-dialog w-[min(800px,calc(100vw-32px))]"
        >
          <MemberProfile
            member={viewing}
            workspaces={workspacesByMember.get(viewing.id) ?? []}
            routine={routines.get(viewing.id)}
            onEdit={canEdit(viewing) ? () => edit(viewing) : undefined}
          />
        </Modal>
      )}
      {(dialog?.kind === "add" || (dialog?.kind === "edit" && canEdit(dialog.member))) && (
        <MemberForm
          roster={roster}
          original={dialog.kind === "edit" ? dialog.member : undefined}
          originalRoutine={dialog.kind === "edit" ? dialog.routine : undefined}
          onClose={() => setDialog(null)}
          onSaved={(member, ids) => {
            if (dialog.kind === "add" && roster.workspace && !ids.includes(roster.workspace.id))
              roster.setId("");
            if (!memberNameKey(member.name).includes(search)) setQuery("");
            setNotice(`${member.name} ${dialog.kind === "edit" ? "updated" : "added"}.`);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
