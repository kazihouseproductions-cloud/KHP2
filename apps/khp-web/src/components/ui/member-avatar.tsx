import Image from "next/image";
import type { Member } from "@/lib/members";

export function MemberAvatar({
  member,
  large = false,
}: {
  member: Pick<Member, "initials" | "color" | "photo">;
  large?: boolean;
}) {
  return (
    <span
      className={`member-avatar avatar-${member.color} overflow-hidden ${large ? "size-16 text-xl" : ""}`}
      aria-hidden="true"
    >
      {member.photo ? (
        <Image
          src={member.photo}
          width={192}
          height={192}
          alt=""
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        member.initials
      )}
    </span>
  );
}
