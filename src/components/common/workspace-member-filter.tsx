import { useMemo, useState } from "react";
import { useMemberDirectory } from "@/stores/member-store";
import { type Member, getWorkspaceMembers } from "@/lib/members";
import type { BoardItem } from "@/lib/workspaces";

export function useWorkspaceMemberFilter(items: BoardItem[]) {
  const directory = useMemberDirectory();
  const [id, setId] = useState("");
  const workspaces = useMemo(
    () =>
      items.filter((item) => item.parentId === null).sort((a, b) => a.title.localeCompare(b.title)),
    [items],
  );
  const workspace = workspaces.find((item) => item.id === id);
  const members = useMemo(
    () => (workspace ? getWorkspaceMembers(workspace, directory) : directory),
    [workspace, directory],
  );
  return { directory, workspaces, workspace, members, setId };
}

export type WorkspaceRoster = ReturnType<typeof useWorkspaceMemberFilter>;

export function MemberFilter({
  members,
  value,
  onChange,
}: {
  members: readonly Member[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm font-medium">
      Member
      <select
        className="attendance-date-input max-w-52 truncate"
        disabled={!members.length}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All members</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WorkspaceMemberFilter({ roster }: { roster: WorkspaceRoster }) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm font-medium">
      Workspace
      <select
        className="attendance-date-input max-w-52 truncate"
        value={roster.workspace?.id ?? ""}
        onChange={(e) => roster.setId(e.target.value)}
      >
        <option value="">All</option>
        {roster.workspaces.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
    </label>
  );
}
