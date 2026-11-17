import { Fragment, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { ChatAvatar } from "./chat-avatar";
import { ChatAttachmentView } from "./chat-attachment";
import { ChatComposer, type ComposerProps } from "./chat-composer";
import { chatDate, chatTime, type ChatThread } from "@/lib/chat";

type Props = ComposerProps & {
  thread: ChatThread;
  error: string;
  onMinimize: () => void;
  onClose: () => void;
};

export function ChatConversation({ thread, error, onMinimize, onClose, ...composer }: Props) {
  const { name, history, latest } = thread;
  const log = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const latestId = latest?.id;
  useEffect(() => {
    if (latestId && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [latestId]);

  return (
    <section
      aria-label={`Chat with ${name}`}
      className="chat-window chat-card"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onMinimize();
        }
      }}
    >
      <header className="flex items-center gap-2 border-b border-neutral-100 px-3 py-3">
        <ChatAvatar thread={thread} />
        <div className="min-w-0 flex-1">
          <h2 tabIndex={-1} ref={heading} className="truncate text-sm font-semibold outline-none">
            {name}
          </h2>
          <p className="truncate text-xs text-neutral-500">{thread.description}</p>
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
            Start a conversation with {name}.
          </p>
        )}
        {history.map((message, index) => {
          const date = chatDate(message.createdAt);
          const dayChanged = !index || chatDate(history[index - 1].createdAt) !== date;
          return (
            <Fragment key={message.id}>
              {dayChanged && <p className="chat-day">{date}</p>}
              <div className="chat-message" data-outgoing={message.outgoing}>
                <span className="sr-only">{message.outgoing ? "You" : name}: </span>
                {message.body && <p className="chat-bubble">{message.body}</p>}
                {message.attachments?.map((attachment) => (
                  <ChatAttachmentView
                    key={attachment.id}
                    owner={composer.owner}
                    attachment={attachment}
                  />
                ))}
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
      <ChatComposer {...composer} name={name} />
    </section>
  );
}
