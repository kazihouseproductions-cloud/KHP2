import { useMemo, useRef, useState } from "react";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { useChatHistory } from "@/hooks/use-chat-history";
import { chatThreads } from "@/lib/chat";
import type { Member } from "@/lib/members";
import { ChatConversation } from "./chat-conversation";
import { ChatInbox } from "./chat-inbox";

type Props = {
  account: Member;
  members: readonly Member[];
  inboxOpen: boolean;
  showInbox: () => void;
  hideInbox: () => void;
  focusTrigger: () => void;
};

export function WorkspaceChat({
  account,
  members,
  inboxOpen,
  showInbox,
  hideInbox,
  focusTrigger,
}: Props) {
  const [contactId, setContactId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const bubble = useRef<HTMLButtonElement>(null);
  const { messages, unread, error, markRead, send } = useChatHistory(account.id);
  const threads = useMemo(
    () =>
      chatThreads(
        members.filter((member) => member.id !== account.id),
        messages,
      ),
    [members, account.id, messages],
  );
  const thread = threads.find(({ member }) => member.id === contactId);

  function updateDraft(id: string, text: string) {
    setDrafts((previous) => ({ ...previous, [id]: text }));
  }

  if (inboxOpen)
    return (
      <ChatInbox
        threads={threads}
        unread={unread}
        error={error}
        onClose={() => {
          hideInbox();
          focusTrigger();
        }}
        onOpen={(id) => {
          markRead(id);
          setContactId(id);
          setMinimized(false);
          hideInbox();
        }}
      />
    );
  if (!thread) return null;
  if (minimized)
    return (
      <button
        type="button"
        ref={bubble}
        className="chat-minimized"
        aria-label={`Resume chat with ${thread.member.name}`}
        onClick={() => setMinimized(false)}
      >
        <MemberAvatar member={thread.member} />
        <span className="truncate">{thread.member.name}</span>
      </button>
    );
  const id = thread.member.id;
  return (
    <ChatConversation
      key={id}
      thread={thread}
      draft={drafts[id] ?? ""}
      error={error}
      onDraft={(text) => updateDraft(id, text)}
      onSend={() => {
        if (send(id, drafts[id] ?? "")) updateDraft(id, "");
      }}
      onInbox={showInbox}
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
