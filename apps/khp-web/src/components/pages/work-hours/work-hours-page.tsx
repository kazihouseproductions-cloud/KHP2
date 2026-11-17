import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/common/scroll-area";
import {
  MemberFilter,
  WorkspaceMemberFilter,
  type WorkspaceRoster,
} from "@/components/common/workspace-member-filter";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { currentMember, type Member } from "@/lib/members";
import { WeeklySchedule } from "./weekly-schedule";
import { type MemberRoutine, sampleWeek } from "@/lib/work-hours";
import { listenToWorkHours, useWorkHoursStore } from "@/stores/work-hours-store";
import { RoutineEditor } from "./routine-editor";

function MemberWeek({
  member,
  routine,
  onEdit,
}: {
  member: Member;
  routine?: MemberRoutine;
  onEdit?: () => void;
}) {
  const days = routine?.days ?? sampleWeek;
  return (
    <section
      aria-label={`${member.name} weekly routine`}
      className="overflow-hidden rounded-xl border border-neutral-200"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MemberAvatar member={member} />
          <div>
            <h2 className="font-semibold">{member.name}</h2>
            {!routine && <p className="text-xs text-neutral-500">Sample routine</p>}
          </div>
        </div>
        {onEdit && (
          <button
            type="button"
            aria-label={`Edit routine for ${member.name}`}
            onClick={onEdit}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
          >
            Edit routine
          </button>
        )}
      </header>
      <WeeklySchedule days={days} />
    </section>
  );
}

export function WorkHoursPage({ roster }: { roster: WorkspaceRoster }) {
  const canEdit = currentMember(roster.directory).role === "Admin";
  const routines = useWorkHoursStore((state) => state.routines);
  const loadError = useWorkHoursStore((state) => state.loadError);
  useEffect(listenToWorkHours, []);
  const [memberId, setMemberId] = useState("");
  const selected = roster.members.find((m) => m.id === memberId);
  const visible = selected ? [selected] : roster.members;
  const [editor, setEditor] = useState<{ member: Member; original?: MemberRoutine } | null>(null);
  return (
    <div className="task-tool">
      <ScrollArea
        label="Weekly work hours"
        className="@container min-h-0 flex-1 overflow-y-auto px-1 pb-24"
      >
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Work Hours</h1>
          <div className="flex flex-wrap items-center gap-3">
            <WorkspaceMemberFilter roster={roster} />
            <MemberFilter
              members={roster.members}
              value={selected?.id ?? ""}
              onChange={setMemberId}
            />
          </div>
        </header>
        {loadError ? (
          <p role="alert" className="text-sm text-red-700">
            {loadError}
          </p>
        ) : !visible.length ? (
          <p className="text-sm text-neutral-600">No members in this workspace yet.</p>
        ) : (
          <div className="grid gap-4">
            {visible.map((member) => (
              <MemberWeek
                key={member.id}
                member={member}
                routine={routines.get(member.id)}
                onEdit={
                  canEdit
                    ? () => setEditor({ member, original: routines.get(member.id) })
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </ScrollArea>
      {canEdit && editor && visible.some((m) => m.id === editor.member.id) && (
        <RoutineEditor
          member={editor.member}
          original={editor.original}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
