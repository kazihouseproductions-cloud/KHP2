import type { DemoMember } from "./members";
import type { MemberCount } from "./task-summary";

// UI fixtures only. Replace this lookup when the attendance source is connected.
const sampleAttendancePercent: Record<DemoMember["id"], number> = {
  ayesha: 96,
  tanvir: 89,
  nadia: 94,
  rafi: 92,
  samira: 98,
};

export function memberPerformance({ member, count, approved }: MemberCount) {
  const attendance = member ? sampleAttendancePercent[member.id] : null;
  const approval = count > 0 ? (approved / count) * 100 : null;
  const score = approval !== null && attendance !== null ? (approval + attendance) / 2 : null;
  return { approval, attendance, score };
}
