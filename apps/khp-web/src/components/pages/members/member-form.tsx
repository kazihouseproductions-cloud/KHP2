import { type FormEvent, useId, useState } from "react";
import { Modal } from "@/components/common/modal";
import type { WorkspaceRoster } from "@/components/common/workspace-member-filter";
import { RoutineFields } from "@/components/pages/work-hours/routine-fields";
import { currentMember, memberRoles, type Member, type MemberRole } from "@/lib/members";
import { ProfilePicture } from "./profile-picture";
import { type MemberRoutine, sampleWeek } from "@/lib/work-hours";
import { useMemberStore } from "@/stores/member-store";

export function MemberForm({
  roster,
  onClose,
  original,
  originalRoutine,
  onSaved,
  selfService = false,
}: {
  roster: WorkspaceRoster;
  onClose: () => void;
  original?: Member;
  originalRoutine?: MemberRoutine;
  selfService?: boolean;
  onSaved: (member: Member, workspaceIds: string[]) => void;
}) {
  const [name, setName] = useState(original?.name ?? "");
  const [role, setRole] = useState<MemberRole>(original?.role ?? "Member");
  const [jobTitle, setJobTitle] = useState(original?.jobTitle ?? "");
  const [email, setEmail] = useState(original?.email ?? "");
  const [photo, setPhoto] = useState(original?.photo);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const initialDays = originalRoutine?.days ?? sampleWeek;
  const [workspaceIds, setWorkspaceIds] = useState<string[]>(() =>
    roster.workspace ? [roster.workspace.id] : [],
  );
  const [customizeHours, setCustomizeHours] = useState(false);
  const [days, setDays] = useState(initialDays);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const actor = currentMember(roster.directory);
  const roleId = useId();
  const manageHours = !selfService && actor.role === "Admin";
  const manageRole = manageHours && original?.id !== actor.id;
  const add = useMemberStore((state) => state.add);
  const update = useMemberStore((state) => state.update);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || readingPhoto) return;
    setSaving(true);
    setError("");
    try {
      const fields = {
        name,
        role: manageRole ? role : (original?.role ?? "Member"),
        email,
        photo,
        jobTitle,
      };
      const changedDays = JSON.stringify(days) !== JSON.stringify(initialDays);
      const member = original
        ? await update(
            original,
            { ...fields, days: manageHours && changedDays ? days : undefined },
            originalRoutine,
          )
        : await add({
            ...fields,
            workspaceIds,
            days: manageHours && customizeHours ? days : undefined,
          });
      onSaved(member, workspaceIds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this member.");
      setSaving(false);
    }
  }
  return (
    <Modal
      title={selfService ? "Edit my profile" : original ? "Edit member" : "Add member"}
      onClose={onClose}
      className="workspace-dialog w-[min(560px,calc(100vw-32px))]"
    >
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="task-field">
            Name
            <input
              required
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="task-field" htmlFor={roleId}>
            Role
            {manageRole ? (
              <select id={roleId} value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                {memberRoles.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            ) : (
              <input id={roleId} readOnly value={original?.role ?? "Member"} />
            )}
          </label>
          <label className="task-field">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="task-field">
            Job title
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </label>
        </div>
        <ProfilePicture
          member={{
            initials: original?.initials ?? name.slice(0, 1).toUpperCase(),
            color: original?.color ?? "blue",
            photo,
          }}
          onChange={setPhoto}
          busy={readingPhoto}
          onBusy={setReadingPhoto}
        />
        {!original && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Workspaces <span className="font-normal text-neutral-500">(optional)</span>
            </legend>
            {roster.workspaces.length ? (
              <div className="grid max-h-36 gap-1 overflow-y-auto rounded-lg border border-neutral-200 p-1">
                {roster.workspaces.map((workspace) => (
                  <label
                    key={workspace.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-neutral-800"
                      checked={workspaceIds.includes(workspace.id)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setWorkspaceIds((ids) =>
                          checked
                            ? [...ids, workspace.id]
                            : ids.filter((id) => id !== workspace.id),
                        );
                      }}
                    />
                    <span className="break-words">{workspace.title}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No workspaces yet.</p>
            )}
          </fieldset>
        )}
        {manageHours && (
          <div className="border-t border-neutral-200 pt-4">
            {original ? (
              <h3 className="text-sm font-semibold">Weekly schedule</h3>
            ) : (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-neutral-800"
                  checked={customizeHours}
                  onChange={(e) => setCustomizeHours(e.target.checked)}
                />
                Set work hours
              </label>
            )}
            {(original || customizeHours) && (
              <div className="mt-3">
                <RoutineFields
                  days={days}
                  initialDays={initialDays}
                  onChange={(day, shift) => setDays((previous) => ({ ...previous, [day]: shift }))}
                />
              </div>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <footer className="flex justify-end gap-2">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving || readingPhoto}>
            {original ? "Save changes" : "Add member"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
