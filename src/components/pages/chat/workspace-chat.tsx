import { useMemo, useRef, useState } from "react";
import { ChatAvatar } from "./chat-avatar";
import { useChatHistory } from "@/hooks/use-chat-history";
import { chatThreads, emptyChatDraft, type ChatDraft } from "@/lib/chat";
import type { Member } from "@/lib/members";
import { ChatConversation } from "./chat-conversation";
import { ChatInbox } from "./chat-inbox";

type Props = {
  account: Member;
  members: readonly Member[];
  inboxOpen: boolean;
  hideInbox: () => void;
  focusTrigger: () => void;
};

export function WorkspaceChat({ account, members, inboxOpen, hideInbox, focusTrigger }: Props) {
  const [contactId, setContactId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ChatDraft>>({});
  const [sending, setSending] = useState<ReadonlySet<string>>(new Set());
  const pendingSends = useRef(new Set<string>());
  const bubble = useRef<HTMLButtonElement>(null);
  const { messages, stored, unread, error, markRead, send, createGroup } = useChatHistory(
    account.id,
  );
  const contacts = useMemo(
    () => members.filter((member) => member.id !== account.id),
    [account.id, members],
  );
  const threads = useMemo(
    () => chatThreads(contacts, [...messages, ...stored.messages], stored.groups),
    [contacts, messages, stored],
  );
  const thread = threads.find(({ id }) => id === contactId);

  function updateDraft(id: string, change: (draft: ChatDraft) => ChatDraft) {
    setDrafts((previous) => ({ ...previous, [id]: change(previous[id] ?? emptyChatDraft) }));
  }

  function open(id: string) {
    markRead(id);
    setContactId(id);
    setMinimized(false);
    hideInbox();
  }
  if (inboxOpen)
    return (
      <ChatInbox
        threads={threads}
        unread={unread}
        error={error}
        members={contacts}
        onCreateGroup={async (name, ids) => {
          const id = await createGroup(name, ids);
          if (id) open(id);
        }}
        onClose={() => {
          hideInbox();
          focusTrigger();
        }}
        onOpen={open}
      />
    );
  if (!thread) return null;
  if (minimized)
    return (
      <button
        type="button"
        ref={bubble}
        className="chat-minimized"
        aria-label={`Resume chat with ${thread.name}`}
        onClick={() => setMinimized(false)}
      >
        <ChatAvatar thread={thread} />
        <span className="truncate">{thread.name}</span>
      </button>
    );
  const id = thread.id;
  return (
    <ChatConversation
      key={id}
      thread={thread}
      owner={account.id}
      draft={drafts[id] ?? emptyChatDraft}
      sending={sending.has(id)}
      error={error}
      onDraft={(change) => updateDraft(id, change)}
      onSend={async () => {
        if (pendingSends.current.has(id)) return;
        pendingSends.current.add(id);
        setSending(new Set(pendingSends.current));
        try {
          if (await send(id, drafts[id] ?? emptyChatDraft)) updateDraft(id, () => emptyChatDraft);
        } finally {
          pendingSends.current.delete(id);
          setSending(new Set(pendingSends.current));
        }
      }}
      onMinimize={() => {
        setMinimized(true);
        requestAnimationFrame(() => bubble.current?.focus());
      }}
      onClose={() => {
        setContactId(null);
        focusTrigger();
      }}
    />
  );
}
