import { attendanceId, type AttendanceIndex } from "./attendance";
import { usableDate } from "./calendar";
import type { Member } from "./members";

const columns = ["Date", "Member", "Status", "Note"];
const dayMs = 86_400_000;

export function attendanceReport(
  entries: AttendanceIndex,
  members: readonly Member[],
  from: string,
  to: string,
) {
  if (!usableDate(from) || !usableDate(to) || from > to)
    throw new Error("Choose a valid date range.");
  const start = Date.parse(from);
  const end = Date.parse(to);
  const rows: string[][] = [];
  for (let time = start; time <= end; time += dayMs) {
    const day = new Date(time).toISOString().slice(0, 10);
    for (const member of members) {
      const entry = entries.get(attendanceId(member.id, day));
      rows.push([day, member.name, entry?.status ?? "Unmarked", entry?.note ?? ""]);
    }
  }
  return rows;
}

export function attendanceCsv(rows: string[][]) {
  function quote(value: string) {
    const literal = /^\s*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${literal.replaceAll('"', '""')}"`;
  }
  const lines = [columns, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
  return `\uFEFF${lines}\r\n`;
}

export async function downloadAttendance(
  format: "csv" | "xlsx",
  entries: AttendanceIndex,
  members: readonly Member[],
  from: string,
  to: string,
) {
  const rowCount = ((Date.parse(to) - Date.parse(from)) / dayMs + 1) * members.length;
  if (format === "xlsx" && rowCount >= 1_048_576)
    throw new Error("This range exceeds the Excel sheet limit. Choose a shorter range.");
  const rows = attendanceReport(entries, members, from, to);
  const scope = members.length === 1 ? members[0].id : "team";
  const filename = `attendance-${scope}-${from}-to-${to}.${format}`;
  if (format === "xlsx") {
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    await writeExcelFile(
      [
        columns.map((value) => ({ value, fontWeight: "bold" })),
        ...rows.map(([day, member, status, note]) => [
          { value: new Date(day), type: Date, format: "yyyy-mm-dd" },
          member,
          status,
          note,
        ]),
      ],
      {
        sheet: "Attendance",
        columns: [15, 24, 15, 56].map((width) => ({ width })),
        stickyRowsCount: 1,
      },
    ).toFile(filename);
    return;
  }
  const url = URL.createObjectURL(
    new Blob([attendanceCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
