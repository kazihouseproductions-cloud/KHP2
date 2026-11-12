import type { DemoMember } from "@/lib/members";

export function MemberAvatar({ member }: { member: DemoMember }) {
  return (
    <span className={`member-avatar avatar-${member.color}`} aria-hidden="true">
      {member.initials}
    </span>
  );
}
