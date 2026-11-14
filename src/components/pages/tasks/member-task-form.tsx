import { useMemo, useState } from "react";
import { useMemberDirectory } from "@/stores/member-store";
import { type Member, getWorkspaceMembers, memberTaskDestinations } from "@/lib/members";
import type { TaskStatus } from "@/lib/tasks";
import type { BoardItem } from "@/lib/workspaces";
import { TaskForm } from "./task-form";

export function MemberTaskForm({
  member,
  byId,
  preferredSectionId,
  status,
  onClose,
}: {
  member: Member;
  byId: ReadonlyMap<string, BoardItem>;
  preferredSectionId?: string;
  status: TaskStatus;
  onClose: () => void;
}) {
  const directory = useMemberDirectory();
  const sections = useMemo(() => memberTaskDestinations(member, byId), [member, byId]);
  const [sectionId, setSectionId] = useState(
    () =>
      sections.find((section) => section.id === preferredSectionId)?.id ??
      (sections.length === 1 ? sections[0].id : ""),
  );
  const destination = sections.find((section) => section.id === sectionId);
  return (
    <TaskForm
      sectionId={destination?.id ?? ""}
      members={getWorkspaceMembers(destination?.workspace, directory)}
      assignedMember={member}
      status={status}
      onClose={onClose}
      sectionPicker={
        <label className="task-field col-span-2">
          Section
          <select
            name="sectionId"
            required
            value={destination?.id ?? ""}
            disabled={!sections.length}
            onChange={(event) => setSectionId(event.target.value)}
          >
            <option value="">Choose a section</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
          {!sections.length && (
            <span className="text-xs font-normal text-neutral-600">
              Add {member.name} to a workspace to create a task for them.
            </span>
          )}
        </label>
      }
    />
  );
}
