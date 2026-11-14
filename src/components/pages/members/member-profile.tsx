import { type ReactNode, useEffect, useState } from "react";
import {
  AttendanceBadge,
  AttendanceCalendar,
} from "@/components/pages/attendance/attendance-calendar";
import { WeeklySchedule } from "@/components/pages/work-hours/weekly-schedule";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { attendanceId } from "@/lib/attendance";
import { dayKey, fullDay, shiftPeriod } from "@/lib/calendar";
import type { Member } from "@/lib/members";
import { type MemberRoutine, sampleWeek } from "@/lib/work-hours";
import type { BoardItem } from "@/lib/workspaces";
import { listenToAttendance, useAttendanceStore } from "@/stores/attendance-store";

export function MemberProfile({
  member,
  workspaces,
  routine,
  onEdit,
  children,
}: {
  member: Member;
  workspaces: BoardItem[];
  routine?: MemberRoutine;
  onEdit?: () => void;
  children?: ReactNode;
}) {
  const [date, setDate] = useState(() => new Date());
  const entries = useAttendanceStore((state) => state.entries);
  const error = useAttendanceStore((state) => state.loadError);
  useEffect(listenToAttendance, []);
  const entry = entries.get(attendanceId(member.id, dayKey(date)));
  return (
    <div className="@container grid gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <MemberAvatar member={member} large />
        <div className="min-w-0 flex-1 break-words">
          <h3 className="text-xl font-semibold">{member.name}</h3>
          {member.jobTitle && <p className="text-sm text-neutral-600">{member.jobTitle}</p>}
        </div>
        {onEdit && (
          <button type="button" className="secondary-button" onClick={onEdit}>
            Edit profile
          </button>
        )}
        {children}
      </header>
      <dl className="grid gap-x-5 gap-y-3 rounded-lg border border-neutral-200 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-600">Role</dt>
          <dd>{member.role}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-600">Email</dt>
          <dd className="break-all">{member.email || "No email added"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-neutral-600">Workspaces</dt>
          <dd className="break-words">
            {workspaces.map((w) => w.title).join(", ") || "No workspaces"}
          </dd>
        </div>
      </dl>
      <section aria-label="Weekly schedule">
        <h3 className="mb-2 text-base font-semibold">Weekly schedule</h3>
        {!routine && <p className="mb-2 text-xs text-neutral-600">Sample routine</p>}
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <WeeklySchedule days={routine?.days ?? sampleWeek} />
        </div>
      </section>
      <section aria-label="Workspace attendance">
        <h3 className="text-base font-semibold">Workspace attendance</h3>
        <p className="mb-4 text-xs text-neutral-600">One daily record across all workspaces.</p>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : (
          <>
            <AttendanceCalendar
              date={date}
              member={member}
              entries={entries}
              onDay={setDate}
              onMonth={(step) => setDate((d) => shiftPeriod(d, "Monthly", step))}
            />
            <div
              aria-live="polite"
              className="mt-3 rounded-lg border border-neutral-200 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span>{fullDay.format(date)}</span>
                <AttendanceBadge status={entry?.status} />
              </div>
              {entry?.note && (
                <p className="mt-2 whitespace-pre-wrap break-words text-neutral-700">
                  {entry.note}
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
