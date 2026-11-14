import type { Member } from "./members";

export type ChatAttachment = { id: string; name: string; size: number; kind: "file" | "voice" };
export type DraftAttachment = { attachment: ChatAttachment; blob: Blob };
export type ChatDraft = { text: string; files: DraftAttachment[] };
export const emptyChatDraft: ChatDraft = { text: "", files: [] };

export function prepareAttachment(
  file: File,
  kind: ChatAttachment["kind"] = "file",
): DraftAttachment {
  return {
    attachment: { id: crypto.randomUUID(), name: file.name, size: file.size, kind },
    blob: file,
  };
}

export type ChatGroup = { id: string; name: string; memberIds: string[]; createdAt: number };

export type ChatMessage = {
  id: string;
  contactId: string;
  outgoing: boolean;
  body: string;
  createdAt: number;
  attachments?: ChatAttachment[];
};

function sample(contactId: string, time: string, outgoing: boolean, body: string): ChatMessage {
  return {
    id: `sample-${contactId}-${time}`,
    contactId,
    createdAt: Date.parse(`${time}:00+06:00`),
    outgoing,
    body,
  };
}

export const sampleMessages = [
  sample(
    "samira",
    "2026-11-11T15:10",
    false,
    "The first pass of the school welcome text is ready.",
  ),
  sample(
    "samira",
    "2026-11-11T15:18",
    true,
    "Thanks! I’ll read through it before our next catch-up.",
  ),
  sample(
    "rafi",
    "2026-11-12T11:00",
    true,
    "Can we try the new board layout with a longer project name?",
  ),
  sample(
    "rafi",
    "2026-11-12T11:06",
    false,
    "Already tried it with Adventures in Mayapur. The title fits.",
  ),
  sample("tanvir", "2026-11-13T13:20", true, "How is the walk cycle coming along?"),
  sample(
    "tanvir",
    "2026-11-13T13:42",
    false,
    "The timing feels better now. I’ll bring the new cut to our review.",
  ),
  sample(
    "nadia",
    "2026-11-12T16:30",
    false,
    "I’m trying two color palettes for the Ogopogo boards.",
  ),
  sample(
    "nadia",
    "2026-11-12T16:36",
    true,
    "I liked the lake blue in your first sketch. Could we try that one?",
  ),
  sample(
    "nadia",
    "2026-11-13T15:05",
    false,
    "Yes! I paired it with a warmer background this time.",
  ),
  sample("nadia", "2026-11-13T15:12", true, "That sounds great. I can take a look this afternoon."),
  sample(
    "nadia",
    "2026-11-13T15:14",
    false,
    "The new color studies are in the Ogopogo workspace. Which one feels right to you?",
  ),
];

export const initiallyUnread = ["nadia", "tanvir"];

export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || !value) return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    typeof message.contactId === "string" &&
    typeof message.body === "string" &&
    !!message.body.trim() &&
    typeof message.outgoing === "boolean" &&
    Number.isFinite(message.createdAt)
  );
}

export type ChatThread = {
  id: string;
  name: string;
  member?: Member;
  group?: ChatGroup;
  description: string;
  history: ChatMessage[];
  latest?: ChatMessage;
  updatedAt: number;
};

export function messagePreview(message: ChatMessage) {
  if (message.body) return message.body;
  const attachments = message.attachments ?? [];
  if (attachments.length > 1) return `${attachments.length} attachments`;
  return attachments[0]?.kind === "voice" ? "Voice message" : (attachments[0]?.name ?? "");
}

export function chatThreads(
  members: readonly Member[],
  messages: readonly ChatMessage[],
  groups: readonly ChatGroup[],
) {
  const histories = new Map<string, ChatMessage[]>();
  const sorted = [...messages].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  for (const message of sorted) {
    const history = histories.get(message.contactId);
    if (history) history.push(message);
    else histories.set(message.contactId, [message]);
  }
  const contacts = [
    ...members.map((member) => ({
      id: member.id,
      name: member.name,
      member,
      description: member.jobTitle || member.role,
      createdAt: 0,
    })),
    ...groups.map((group) => ({
      id: group.id,
      name: group.name,
      group,
      description: `${group.memberIds.length} members`,
      createdAt: group.createdAt,
    })),
  ];
  return contacts
    .map((contact): ChatThread => {
      const history = histories.get(contact.id) ?? [];
      const latest = history.at(-1);
      return { ...contact, history, latest, updatedAt: latest?.createdAt ?? contact.createdAt };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });

export function chatTime(time: number) {
  return timeFormat.format(time);
}

export function chatDate(time: number) {
  const today = new Date();
  const day = dateFormat.format(time);
  if (day === dateFormat.format(today)) return "Today";
  today.setDate(today.getDate() - 1);
  return day === dateFormat.format(today) ? "Yesterday" : day;
}
