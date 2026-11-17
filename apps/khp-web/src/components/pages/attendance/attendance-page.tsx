import { useEffect, useState } from "react";
import { Modal } from "@/components/common/modal";
import {
  WorkspaceMemberFilter,
  type WorkspaceRoster,
} from "@/components/common/workspace-member-filter";
import { ScrollArea } from "@/components/common/scroll-area";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { attendanceId, attendanceStatuses, type AttendanceStatus } from "@/lib/attendance";
import { dayKey, fullDay, shiftPeriod } from "@/lib/calendar";
import { type Member, previewMember } from "@/lib/members";
import { listenToAttendance, useAttendanceStore } from "@/stores/attendance-store";
import { AttendanceBadge, AttendanceCalendar } from "./attendance-calendar";
import { AttendanceExportPanel } from "./attendance-export-panel";
import { DailyAttendance } from "./daily-attendance";

type NoteTarget = { member: Member; day: string; note: string };

function AttendanceNote({ target, onClose }: { target: NoteTarget; onClose: () => void }) {
  const [note, setNote] = useState(target.note);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = useAttendanceStore((s) => s.save);
  return (
    <Modal
      title={target.note ? "Edit note" : "Add note"}
      className="workspace-dialog"
      onClose={onClose}
    >
      <p className="mb-4 text-sm text-neutral-600">
        {target.member.name} · {fullDay.format(new Date(`${target.day}T12:00:00`))}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await save(target.member.id, target.day, { note: note.trim() });
            onClose();
          } catch {
            setError("Could not save this note. Check browser storage and try again.");
            setSaving(false);
          }
        }}
      >
        <div className="task-field">
          <label htmlFor="attendance-note-text">Note</label>
          <textarea
            id="attendance-note-text"
            rows={4}
            maxLength={32767}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base font-normal"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <footer className="mt-4 flex justify-end gap-2">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="attendance-primary" type="submit" disabled={saving}>
            Save note
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function AttendancePage({ roster }: { roster: WorkspaceRoster }) {
  const entries = useAttendanceStore((s) => s.entries);
  const save = useAttendanceStore((s) => s.save);
  const loadError = useAttendanceStore((s) => s.loadError);
  useEffect(listenToAttendance, []);
  const [memberId, setMemberId] = useState<string>(previewMember.id);
  const member = roster.members.find((m) => m.id === memberId) ?? roster.members[0];
  const [date, setDate] = useState(() => new Date());
  const [target, setTarget] = useState<NoteTarget | null>(null);
  const [saveError, setSaveError] = useState("");
  const day = dayKey(date);
  const entry = member && entries.get(attendanceId(member.id, day));
  function editNote(person: Member) {
    setTarget({ member: person, day, note: entries.get(attendanceId(person.id, day))?.note ?? "" });
  }
  async function mark(person: Member, status: AttendanceStatus | null) {
    try {
      await save(person.id, day, { status });
      setSaveError("");
    } catch {
      setSaveError(
        `Could not save attendance for ${person.name}. Check browser storage and try again.`,
      );
    }
  }
  return (
    <div className="task-tool">
      <ScrollArea
        label="Attendance overview"
        className="@container min-h-0 flex-1 overflow-y-auto px-1 pb-24"
      >
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <div className="flex flex-wrap items-center gap-3">
            <WorkspaceMemberFilter roster={roster} />
            <label className="flex items-center gap-2 text-sm font-medium">
              Member
              <select
                className="attendance-date-input"
                value={member?.id ?? ""}
                disabled={!member}
                onChange={(e) => setMemberId(e.target.value)}
              >
                {!member && <option value="">No members</option>}
                {roster.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        {(saveError || loadError) && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {saveError || loadError}
          </p>
        )}
        {member ? (
          <div className="grid items-start gap-5 @3xl:grid-cols-[minmax(0,1fr)_230px] @5xl:grid-cols-[minmax(0,1fr)_260px]">
            <AttendanceCalendar
              date={date}
              onDay={setDate}
              entries={entries}
              member={member}
              onMonth={(step) => setDate((d) => shiftPeriod(d, "Monthly", step))}
            />
            <aside
              aria-label="Selected attendance record"
              className="rounded-xl border border-neutral-200 p-4"
            >
              <p className="mb-2 text-xs font-medium text-neutral-600">{fullDay.format(date)}</p>
              <div className="mb-3 flex items-center gap-2">
                <MemberAvatar member={member} />
                <h2 className="font-semibold">{member.name}</h2>
              </div>
              <AttendanceBadge status={entry?.status} />
              <fieldset
                className="mt-4 flex flex-wrap gap-1.5 border-t border-neutral-200 pt-3"
                aria-label="Mark attendance"
              >
                {attendanceStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={entry?.status === status}
                    aria-label={`Mark as ${status}`}
                    className="attendance-mark"
                    onClick={() => mark(member, status)}
                  >
                    {status === "WFH" ? "WFH (work from home)" : status}
                  </button>
                ))}
              </fieldset>
              {entry?.status && (
                <button
                  type="button"
                  className="mt-2 text-xs text-neutral-600 hover:underline"
                  onClick={() => mark(member, null)}
                >
                  Clear status
                </button>
              )}
              <div className="mt-3 border-t border-neutral-200 pt-3">
                {entry?.note && (
                  <p className="mb-2 whitespace-pre-wrap break-words text-sm text-neutral-700">
                    {entry.note}
                  </p>
                )}
                <button type="button" className="attendance-mark" onClick={() => editNote(member)}>
                  {entry?.note ? "Edit note" : "Add note"}
                </button>
              </div>
            </aside>
          </div>
        ) : (
          <p className="text-sm text-neutral-600">No members in this workspace yet.</p>
        )}
        <div className="mt-6 grid gap-6">
          <AttendanceExportPanel entries={entries} members={roster.members} />
          <DailyAttendance
            members={roster.members}
            date={date}
            entries={entries}
            onDay={setDate}
            onStatus={mark}
            onNote={editNote}
          />
        </div>
      </ScrollArea>
      {target && roster.members.some((m) => m.id === target.member.id) && (
        <AttendanceNote target={target} onClose={() => setTarget(null)} />
      )}
    </div>
  );
}
