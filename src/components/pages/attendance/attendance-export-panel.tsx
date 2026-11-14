import { useState } from "react";
import type { AttendanceIndex } from "@/lib/attendance";
import { downloadAttendance } from "@/lib/attendance-export";
import { dayKey, usableDate } from "@/lib/calendar";
import type { Member } from "@/lib/members";

export function AttendanceExportPanel({
  entries,
  members,
}: {
  entries: AttendanceIndex;
  members: readonly Member[];
}) {
  const [from, setFrom] = useState(() => `${dayKey(new Date()).slice(0, 8)}01`);
  const [to, setTo] = useState(() => dayKey(new Date()));
  const [scope, setScope] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = members.find((m) => m.id === scope);
  const valid = usableDate(from) && usableDate(to) && from <= to;
  async function download(format: "xlsx" | "csv") {
    setError("");
    setBusy(true);
    try {
      await downloadAttendance(format, entries, selected ? [selected] : members, from, to);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download attendance.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="export-attendance" className="border-y border-neutral-200 py-5">
      <h2 id="export-attendance" className="mb-3 text-lg font-semibold">
        Export attendance
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="task-field grow">
          Members
          <select
            value={selected?.id ?? "all"}
            disabled={!members.length}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="all">All members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="task-field grow">
          From
          <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="task-field grow">
          To
          <input
            type="date"
            required
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="attendance-primary"
            disabled={!valid || busy || !members.length}
            onClick={() => download("xlsx")}
          >
            Download Excel
          </button>
          <button
            type="button"
            className="secondary-button disabled:opacity-40"
            disabled={!valid || busy || !members.length}
            onClick={() => download("csv")}
          >
            Download CSV
          </button>
        </div>
      </div>
      {!valid && (
        <p className="mt-2 text-sm text-red-700">Choose a start date on or before the end date.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
