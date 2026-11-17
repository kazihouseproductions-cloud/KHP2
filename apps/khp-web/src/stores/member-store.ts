import { create } from "zustand";
import { memberWorkspaceRefs, withActivity, workspaceRefs } from "@/lib/activity-log";
import { boardItemPrefix, readBoardItem } from "@/lib/board-records";
import { watchRecords } from "@/lib/local-records";
import { isMemberPhoto, memberPrefix, readMemberDirectory } from "@/lib/member-records";
import {
  demoMembers,
  currentMember,
  getPinMemberIds,
  type Member,
  indexMemberNames,
  memberNameKey,
  memberRoles,
} from "@/lib/members";
import {
  isWeekRoutine,
  type MemberRoutine,
  type WeekRoutine,
  workHoursPrefix,
} from "@/lib/work-hours";
import { useBoardStore } from "./board-store";
import { useTaskStore } from "./task-store";
import { useWorkHoursStore } from "./work-hours-store";

type ProfileFields = Pick<Member, "name" | "role" | "jobTitle" | "email" | "photo">;
type MemberDraft = ProfileFields & { workspaceIds: string[]; days?: WeekRoutine };
type MemberEdit = ProfileFields & { days?: WeekRoutine };

type MemberState = {
  members: readonly Member[];
  loadError: string;
  load: () => void;
  add: (draft: MemberDraft) => Promise<Member>;
  update: (original: Member, draft: MemberEdit, originalRoutine?: MemberRoutine) => Promise<Member>;
};

// Share board locks with pin membership edits and serialize duplicate-name checks across tabs.
async function withMemberLocks<T>(keys: string[], save: () => T): Promise<T> {
  const [key, ...rest] = keys;
  if (!key || !navigator.locks) return save();
  return navigator.locks.request(key, () => withMemberLocks(rest, save));
}

function writeRecords(writes: [string, object][]) {
  const applied: [string, string | null][] = [];
  try {
    for (const [key, value] of writes) {
      const previous = localStorage.getItem(key);
      localStorage.setItem(key, JSON.stringify(value));
      applied.push([key, previous]);
    }
  } catch (cause) {
    for (const [key, previous] of applied.reverse()) {
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
    }
    throw cause;
  }
}

function profileFields(draft: ProfileFields, directory: Member[], id?: string) {
  const name = draft.name.trim();
  const email = draft.email?.trim() || undefined;
  if (!name || !memberRoles.includes(draft.role))
    throw new Error("Enter a name and select a role.");
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (draft.photo !== undefined && !isMemberPhoto(draft.photo))
    throw new Error("Choose a valid profile picture.");
  const owner = indexMemberNames(directory).get(memberNameKey(name));
  if (owner && owner.id !== id) throw new Error("A member with this name already exists.");
  const words = name.split(/\s+/u);
  const initials = [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])]
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase();
  return {
    name,
    initials,
    email,
    photo: draft.photo,
    role: draft.role,
    jobTitle: draft.jobTitle?.trim() || undefined,
  };
}

export const useMemberStore = create<MemberState>((set, get) => ({
  members: demoMembers,
  loadError: "",
  load() {
    try {
      set({ members: readMemberDirectory(), loadError: "" });
    } catch {
      set({ loadError: "Members could not be loaded from this browser." });
    }
  },
  async add(draft) {
    if (draft.days !== undefined && !isWeekRoutine(draft.days))
      throw new Error("Enter different start and end times for each working day.");
    const ids = [...new Set(draft.workspaceIds)].sort();
    return withMemberLocks([memberPrefix, ...ids.map((id) => boardItemPrefix + id)], () => {
      const directory = readMemberDirectory();
      if (
        currentMember(directory).role !== "Admin" &&
        (draft.role !== "Member" || draft.days !== undefined)
      )
        throw new Error("Only admins can assign roles or set working hours.");
      const fields = profileFields(draft, directory);
      const workspaces = ids.map(readBoardItem);
      if (workspaces.some((item) => item.parentId !== null))
        throw new Error("Choose a workspace from the list.");
      const id = crypto.randomUUID();
      const createdAt = Date.now();
      const member = {
        id,
        ...fields,
        color: demoMembers[directory.length % demoMembers.length].color,
        createdAt,
      };
      const writes: [string, object][] = [[memberPrefix + id, member]];
      for (const item of workspaces) {
        writes.push([
          boardItemPrefix + item.id,
          { ...item, memberIds: [...getPinMemberIds(item), id] },
        ]);
      }
      if (draft.days) writes.push([workHoursPrefix + id, { id, days: draft.days, createdAt }]);
      withActivity(
        {
          area: "Members",
          description: `Added member ${member.name}`,
          detail: member.role,
          workspaces: workspaceRefs(workspaces),
        },
        () => writeRecords(writes),
      );
      get().load();
      useBoardStore.getState().load();
      if (draft.days) useWorkHoursStore.getState().load();
      return member;
    });
  },
  async update(original, draft, originalRoutine) {
    const routineKey = workHoursPrefix + original.id;
    return withMemberLocks([memberPrefix, routineKey], () => {
      const directory = readMemberDirectory();
      const current = directory.find((member) => member.id === original.id);
      if (!current || JSON.stringify(current) !== JSON.stringify(original))
        throw new Error("This profile changed. Reopen Edit to see the latest profile.");
      const actor = currentMember(directory);
      if (current.id !== actor.id && actor.role !== "Admin")
        throw new Error("Only admins can edit another member’s profile.");
      if (current.id === actor.id && current.role !== draft.role)
        throw new Error("You cannot change your own role.");
      if (draft.days !== undefined && actor.role !== "Admin")
        throw new Error("Only admins can change working hours.");
      const fields = profileFields(draft, directory, current.id);
      const writes: [string, object][] = [];
      if (draft.days) {
        if (!isWeekRoutine(draft.days))
          throw new Error("Enter different start and end times for each working day.");
        if (
          localStorage.getItem(routineKey) !==
          (originalRoutine ? JSON.stringify(originalRoutine) : null)
        )
          throw new Error("Work hours changed. Reopen Edit to see the latest schedule.");
        writes.push([
          routineKey,
          { id: current.id, days: draft.days, createdAt: originalRoutine?.createdAt ?? Date.now() },
        ]);
      }
      const renamed = current.name !== fields.name;
      const formerNames = new Set(current.formerNames ?? []);
      if (renamed) formerNames.add(current.name);
      formerNames.delete(fields.name);
      const member = { ...current, ...fields, formerNames: [...formerNames] };
      const changed = (Object.keys(fields) as (keyof typeof fields)[]).some(
        (key) => fields[key] !== current[key],
      );
      if (changed) {
        const key = memberPrefix + member.id;
        const previous = JSON.parse(localStorage.getItem(key) ?? "{}");
        writes.push([key, { ...previous, ...member, createdAt: previous.createdAt ?? Date.now() }]);
      }
      if (!writes.length) return current;
      withActivity(
        {
          area: "Members",
          description: `Updated profile for ${member.name}`,
          detail: draft.days ? "Updated weekly schedule" : undefined,
          workspaces: memberWorkspaceRefs(member.id),
        },
        () => writeRecords(writes),
      );
      get().load();
      if (draft.days) useWorkHoursStore.getState().load();
      if (renamed) useTaskStore.getState().load();
      return get().members.find((entry) => entry.id === member.id) ?? member;
    });
  },
}));

export function useMemberDirectory() {
  return useMemberStore((state) => state.members);
}

export function listenToMembers() {
  return watchRecords(memberPrefix, () => {
    useMemberStore.getState().load();
    useTaskStore.getState().load();
  });
}
