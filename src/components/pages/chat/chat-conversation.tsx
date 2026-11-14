import { Fragment, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { chatDate, chatTime, type ChatThread } from "@/lib/chat";

type Props = {
  thread: ChatThread;
  draft: string;
  error: string;
  onDraft: (text: string) => void;
  onSend: () => void;
  onInbox: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

export function ChatConversation({
  thread,
  draft,
  error,
  onDraft,
  onSend,
  onInbox,
  onMinimize,
  onClose,
}: Props) {
  const { member, history, latest } = thread;
  const log = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const latestId = latest?.id;
  useEffect(() => {
    if (latestId && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [latestId]);

  return (
    <section
      aria-label={`Chat with ${member.name}`}
      className="chat-window chat-card"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onMinimize();
        }
      }}
    >
      <header className="flex items-center gap-2 border-b border-neutral-100 px-3 py-3">
        {/* <button type="button" className="chat-control" aria-label="Back to chats" onClick={onInbox}>
          <Icon name="back" size={17} />
        </button> */}
        <MemberAvatar member={member} />
        <div className="min-w-0 flex-1">
          <h2 tabIndex={-1} ref={heading} className="truncate text-sm font-semibold outline-none">
            {member.name}
          </h2>
          <p className="truncate text-xs text-neutral-500">{member.jobTitle || member.role}</p>
        </div>
        <button
          type="button"
          className="chat-control"
          aria-label="Minimize conversation"
          title="Minimize"
          onClick={onMinimize}
        >
          <Icon name="minimize" size={16} />
        </button>
        <button
          type="button"
          className="chat-control"
          aria-label="Close conversation"
          title="Close"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      </header>
      <div
        ref={log}
        role="log"
        aria-label="Message history"
        aria-live="polite"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable log needs keyboard focus.
        tabIndex={0}
        className="chat-history"
      >
        {history.length === 0 && (
          <p className="my-auto text-center text-sm text-neutral-500">
            Start a conversation with {member.name}.
          </p>
        )}
        {history.map((message, index) => {
          const date = chatDate(message.createdAt);
          const dayChanged = !index || chatDate(history[index - 1].createdAt) !== date;
          return (
            <Fragment key={message.id}>
              {dayChanged && <p className="chat-day">{date}</p>}
              <div className="chat-message" data-outgoing={message.outgoing}>
                <span className="sr-only">{message.outgoing ? "You" : member.name}: </span>
                <p className="chat-bubble">{message.body}</p>
                <time
                  dateTime={new Date(message.createdAt).toISOString()}
                  className="px-1 pt-0.5 text-[10px] text-neutral-500"
                >
                  {chatTime(message.createdAt)}
                </time>
              </div>
            </Fragment>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="px-4 py-1 text-xs text-red-700">
          {error}
        </p>
      )}
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) onSend();
          composer.current?.focus();
        }}
      >
        <textarea
          ref={composer}
          rows={1}
          aria-label={`Message to ${member.name}`}
          placeholder="Write a message…"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          aria-label="Send message"
          title="Send message"
          disabled={!draft.trim()}
          className="chat-send"
        >
          <Icon name="send" size={18} />
        </button>
      </form>
    </section>
  );
}
