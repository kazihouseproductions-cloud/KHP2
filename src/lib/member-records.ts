import { readRecords } from "./local-records";
import { demoMembers, type Member, memberRoles } from "./members";

export const memberPrefix = "khp.members.v1.";
type MemberRecord = Omit<Member, "role"> & { role: string; createdAt: number };

export function isMemberPhoto(photo: unknown): photo is string {
  return (
    typeof photo === "string" &&
    photo.length <= 160_000 &&
    /^data:image\/jpeg;base64,[a-zA-Z0-9+/]+=*$/.test(photo)
  );
}

function isMemberRecord(value: unknown): value is MemberRecord {
  if (!value || typeof value !== "object") return false;
  const member = value as Partial<MemberRecord>;
  return (
    typeof member.id === "string" &&
    !!member.id &&
    typeof member.name === "string" &&
    !!member.name.trim() &&
    typeof member.role === "string" &&
    !!member.role.trim() &&
    typeof member.initials === "string" &&
    demoMembers.some((seed) => seed.color === member.color) &&
    (member.jobTitle === undefined || typeof member.jobTitle === "string") &&
    (member.email === undefined || typeof member.email === "string") &&
    (member.photo === undefined || isMemberPhoto(member.photo)) &&
    (member.formerNames === undefined ||
      (Array.isArray(member.formerNames) &&
        member.formerNames.every((name) => typeof name === "string"))) &&
    Number.isFinite(member.createdAt)
  );
}

export function readMemberDirectory(): Member[] {
  const directory = new Map<string, Member>(demoMembers.map((member) => [member.id, member]));
  for (const record of readRecords(memberPrefix, isMemberRecord)) {
    const role = memberRoles.find(
      (option) => option.toLowerCase() === record.role.trim().toLowerCase(),
    );
    directory.set(record.id, {
      ...record,
      role: role ?? "Member",
      jobTitle: record.jobTitle ?? (role ? undefined : record.role),
    });
  }
  return [...directory.values()];
}
