import { memberPerformance } from "@/lib/member-performance";
import type { MemberCount } from "@/lib/task-summary";

const percent = new Intl.NumberFormat("en", {
  style: "unit",
  unit: "percent",
  maximumFractionDigits: 1,
});

export function MemberPerformanceTable({
  members,
  rates,
}: {
  members: readonly MemberCount[];
  rates: ReadonlyMap<string, number> | undefined;
}) {
  return (
    <section
      aria-labelledby="performance-heading"
      className="mt-8 border-t border-neutral-200 pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 id="performance-heading" className="text-lg font-semibold">
          Performance
        </h2>
      </div>
      <p id="performance-formula" className="mt-1 mb-4 text-sm text-neutral-600">
        Performance averages the task approval rate and attendance rate through today. Present, Late
        and WFH count as attended. Absent counts as missed. Leave and unmarked days are excluded.
      </p>
      <table
        aria-labelledby="performance-heading"
        aria-describedby="performance-formula"
        className="w-full table-fixed border-collapse text-sm"
      >
        <thead className="border-y border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
          <tr>
            <th scope="col" className="w-[34%] px-1.5 py-2 text-left font-medium sm:px-3">
              Member
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-medium sm:px-3">
              Approval
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-medium sm:px-3">
              Attendance
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-medium sm:px-3">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {members.map((row) => {
            const { approval, attendance, score } = memberPerformance(row, rates);
            return (
              <tr key={row.name} className="border-b border-neutral-200">
                <th scope="row" className="break-words px-1.5 py-3 text-left font-medium sm:px-3">
                  {row.name}
                </th>
                <td className="px-1.5 py-2 text-right sm:px-3">
                  {approval === null ? (
                    <span className="text-xs text-neutral-500">No tasks</span>
                  ) : (
                    <>
                      {percent.format(approval)}
                      <span className="block text-xs text-neutral-500">
                        {row.approved} of {row.count}
                      </span>
                    </>
                  )}
                </td>
                <td className="px-1.5 text-right sm:px-3">
                  {attendance === null ? (
                    <span className="text-xs text-neutral-500">No data</span>
                  ) : (
                    percent.format(attendance)
                  )}
                </td>
                <td className="px-1.5 text-right sm:px-3">
                  {score === null ? (
                    <span className="text-xs text-neutral-500">Not scored</span>
                  ) : (
                    <strong className="inline-block rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-900">
                      {percent.format(score)}
                    </strong>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
