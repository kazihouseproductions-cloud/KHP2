import type { Member } from "./members";

export const routineDays = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;
export type Weekday = (typeof routineDays)[number];
export const workHoursPrefix = "khp.work-hours.v1.";
export type Shift = { start: string; end: string };
export type WeekRoutine = Record<Weekday, Shift | null>;
export type MemberRoutine = { id: Member["id"]; createdAt: number; days: WeekRoutine };

export const sampleShift: Shift = { start: "10:00", end: "19:00" };
export const sampleWeek: WeekRoutine = {
  Saturday: null,
  Sunday: sampleShift,
  Monday: sampleShift,
  Tuesday: sampleShift,
  Wednesday: sampleShift,
  Thursday: sampleShift,
  Friday: null,
};

export function isWeekRoutine(value: unknown): value is WeekRoutine {
  if (!value || typeof value !== "object") return false;
  const days = value as Partial<Record<Weekday, Partial<Shift> | null>>;
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return routineDays.every((day) => {
    const shift = days[day];
    return (
      shift === null ||
      (!!shift &&
        typeof shift.start === "string" &&
        clock.test(shift.start) &&
        typeof shift.end === "string" &&
        clock.test(shift.end) &&
        shift.start !== shift.end)
    );
  });
}

export function clockLabel(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}${minute === "00" ? "" : `:${minute}`} ${Number(hour) < 12 ? "AM" : "PM"}`;
}
