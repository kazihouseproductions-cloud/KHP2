import {
  routineDays,
  sampleShift,
  type Shift,
  type Weekday,
  type WeekRoutine,
} from "@/lib/work-hours";

export function RoutineFields({
  days,
  initialDays,
  onChange,
}: {
  days: WeekRoutine;
  initialDays: WeekRoutine;
  onChange: (day: Weekday, shift: Shift | null) => void;
}) {
  return (
    <table className="w-full table-fixed text-sm" aria-label="Weekly working hours">
      <thead className="border-b border-neutral-200 text-left text-xs text-neutral-600">
        <tr>
          <th scope="col" className="w-[36%] pb-2 font-medium">
            Working day
          </th>
          <th scope="col" className="pb-2 pl-1 font-medium">
            Start
          </th>
          <th scope="col" className="pb-2 pl-1 font-medium">
            End
          </th>
        </tr>
      </thead>
      <tbody>
        {routineDays.map((day) => {
          const shift = days[day];
          return (
            <tr key={day} className="border-b border-neutral-100">
              <th scope="row" className="py-2 pr-1 text-left font-medium">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    aria-label={`Work on ${day}`}
                    checked={!!shift}
                    className="size-4 shrink-0 accent-neutral-800"
                    onChange={(e) =>
                      onChange(day, e.target.checked ? (initialDays[day] ?? sampleShift) : null)
                    }
                  />
                  <span className="max-sm:text-xs">{day}</span>
                </label>
              </th>
              {shift ? (
                (["start", "end"] as const).map((field) => (
                  <td key={field} className="py-1.5 pl-1">
                    <input
                      type="time"
                      required
                      aria-label={`${day} ${field} time`}
                      value={shift[field]}
                      className="min-h-9 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-1 text-xs tabular-nums sm:px-2 sm:text-sm"
                      onChange={(e) => onChange(day, { ...shift, [field]: e.target.value })}
                    />
                    {field === "end" && shift.end && shift.end < shift.start && (
                      <small className="block text-neutral-600">Next day</small>
                    )}
                  </td>
                ))
              ) : (
                <td colSpan={2} className="py-2 pl-1 text-xs text-neutral-500">
                  Day off
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
