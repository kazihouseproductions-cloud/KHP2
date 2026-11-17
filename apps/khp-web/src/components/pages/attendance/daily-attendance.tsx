import { MemberAvatar } from "@/components/ui/member-avatar";
import { Icon } from "@/components/ui/icon";
import {
  type AttendanceIndex,
  attendanceId,
  type AttendanceStatus,
  attendanceStatuses,
} from "@/lib/attendance";
import { addDays, dayKey, fullDay, usableDate } from "@/lib/calendar";
import type { Member } from "@/lib/members";
import { AttendanceBadge, AttendanceSteps } from "./attendance-calendar";

export function DailyAttendance({
  members,
  date,
  entries,
  onDay,
  onStatus,
  onNote,
}: {
  members: readonly Member[];
  date: Date;
  entries: AttendanceIndex;
  onDay: (date: Date) => void;
  onStatus: (member: Member, status: AttendanceStatus | null) => void;
  onNote: (member: Member) => void;
}) {
  const day = dayKey(date);
  return (
    <section aria-labelledby="daily-attendance">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="daily-attendance" className="text-lg font-semibold">
            Daily attendance
          </h2>
          <p className="mt-1 text-sm text-neutral-600" aria-live="polite">
            {fullDay.format(date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            aria-label="Daily attendance date"
            className="attendance-date-input"
            type="date"
            value={day}
            onChange={(e) => {
              if (usableDate(e.target.value)) onDay(new Date(`${e.target.value}T12:00:00`));
            }}
          />
          <AttendanceSteps unit="day" onStep={(step) => onDay(addDays(date, step))} />
        </div>
      </header>
      <table className="w-full table-fixed text-left text-sm" aria-labelledby="daily-attendance">
        <thead className="border-y border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
          <tr>
            <th className="w-[38%] p-2 font-medium">Member</th>
            <th className="w-[28%] p-2 font-medium">Status</th>
            <th className="p-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const entry = entries.get(attendanceId(member.id, day));
            return (
              <tr key={member.id} className="border-b border-neutral-200">
                <th scope="row" className="p-2 py-3 text-left font-medium">
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex">
                      <MemberAvatar member={member} />
                    </span>
                    {member.name}
                  </div>
                </th>
                <td className="px-1">
                  <label className="relative inline-flex items-center rounded-full focus-within:outline-2 focus-within:outline-offset-2">
                    <AttendanceBadge status={entry?.status} />
                    <span aria-hidden="true" className="rotate-90 text-neutral-500">
                      <Icon name="chevron" size={12} />
                    </span>
                    <select
                      aria-label={`Status for ${member.name}`}
                      value={entry?.status ?? ""}
                      className="absolute inset-0 w-full cursor-pointer opacity-0"
                      onChange={(e) =>
                        onStatus(
                          member,
                          attendanceStatuses.find((s) => s === e.target.value) ?? null,
                        )
                      }
                    >
                      <option value="">Unmarked</option>
                      {attendanceStatuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </td>
                <td className="p-2">
                  {entry?.note && (
                    <p className="whitespace-pre-wrap break-words text-neutral-700">{entry.note}</p>
                  )}
                  <button
                    className="text-xs font-medium text-neutral-600 underline decoration-neutral-300 underline-offset-2 hover:text-black"
                    type="button"
                    aria-label={`${entry?.note ? "Edit" : "Add"} note for ${member.name}`}
                    onClick={() => onNote(member)}
                  >
                    {entry?.note ? "Edit note" : "Add note"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
