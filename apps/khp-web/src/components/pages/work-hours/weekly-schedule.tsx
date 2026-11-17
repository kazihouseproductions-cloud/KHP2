import { clockLabel, routineDays, type WeekRoutine } from "@/lib/work-hours";

export function WeeklySchedule({ days }: { days: WeekRoutine }) {
  return (
    <dl className="grid border-t border-neutral-200 bg-neutral-100 @3xl:grid-cols-7 @3xl:gap-px">
      {routineDays.map((day) => {
        const shift = days[day];
        return (
          <div
            key={day}
            className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-white px-4 py-2.5 last:border-0 @3xl:block @3xl:border-0 @3xl:px-3 @3xl:py-3"
          >
            <dt className="text-xs font-medium text-neutral-600">{day}</dt>
            <dd className="text-sm tabular-nums @3xl:mt-2">
              {shift ? (
                <>
                  <span className="whitespace-nowrap font-medium">{clockLabel(shift.start)}</span>
                  <span className="text-neutral-400"> – </span>
                  <span className="whitespace-nowrap">{clockLabel(shift.end)}</span>
                  {shift.end < shift.start && (
                    <small className="ml-1 text-neutral-600">(next day)</small>
                  )}
                </>
              ) : (
                <span className="text-neutral-500">Day off</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
