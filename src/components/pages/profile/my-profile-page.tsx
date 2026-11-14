import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/common/scroll-area";
import type { WorkspaceRoster } from "@/components/common/workspace-member-filter";
import { MemberForm } from "@/components/pages/members/member-form";
import { MemberProfile } from "@/components/pages/members/member-profile";
import { getPinMemberIds, type Member } from "@/lib/members";
import { ProfilePassword } from "./profile-password";
import { useMemberStore } from "@/stores/member-store";
import { listenToWorkHours, useWorkHoursStore } from "@/stores/work-hours-store";

export function MyProfilePage({ member, roster }: { member: Member; roster: WorkspaceRoster }) {
  const routine = useWorkHoursStore((state) => state.routines.get(member.id));
  const hoursError = useWorkHoursStore((state) => state.loadError);
  const profileError = useMemberStore((state) => state.loadError);
  useEffect(listenToWorkHours, []);
  const [editor, setEditor] = useState<Member | null>(null);
  const [saved, setSaved] = useState(false);
  const workspaces = roster.workspaces.filter((workspace) =>
    getPinMemberIds(workspace).includes(member.id),
  );

  return (
    <div className="task-tool">
      <ScrollArea label="My profile details" className="min-h-0 flex-1 overflow-y-auto px-1 pb-24">
        <header className="mb-5 flex items-center gap-3 border-b border-neutral-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
          <span role="status" className="text-sm text-neutral-600">
            {saved && "Changes saved"}
          </span>
        </header>
        {(profileError || hoursError) && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {profileError || hoursError}
          </p>
        )}
        <div className="max-w-5xl">
          <MemberProfile
            member={member}
            workspaces={workspaces}
            routine={routine}
            onEdit={() => {
              setSaved(false);
              setEditor(member);
            }}
          >
            <ProfilePassword />
          </MemberProfile>
        </div>
      </ScrollArea>
      {editor && (
        <MemberForm
          selfService
          roster={roster}
          original={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setSaved(true);
          }}
        />
      )}
    </div>
  );
}
