import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { chatDate, chatTime, type ChatThread } from "@/lib/chat";

type Props = {
  threads: ChatThread[];
  unread: string[];
  error: string;
  onOpen: (id: string) => void;
  onClose: () => void;
};

export function ChatInbox({ threads, unread, error, onOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  const term = query.trim().toLowerCase();
  const visible = threads.filter(
    ({ member, latest }) =>
      member.name.toLowerCase().includes(term) &&
      (composing || ((latest || term) && (!unreadOnly || unread.includes(member.id)))),
  );

  return (
    <section id="utility-panel" aria-label="Chats" className="chat-inbox chat-card">
      <header className="flex items-center gap-2 px-5 pt-4">
        {composing && (
          <button
            className="chat-control"
            type="button"
            aria-label="Back to chats"
            onClick={() => {
              setComposing(false);
              setQuery("");
            }}
          >
            <Icon name="back" size={17} />
          </button>
        )}
        <h2
          ref={heading}
          tabIndex={-1}
          className="mr-auto text-xl font-semibold tracking-tight outline-none"
        >
          {composing ? "New message" : "Chats"}
        </h2>
        {!composing && (
          <button
            className="chat-control"
            type="button"
            aria-label="New message"
            title="New message"
            onClick={() => {
              setComposing(true);
              setQuery("");
              input.current?.focus();
            }}
          >
            <Icon name="edit" size={17} />
          </button>
        )}
        <button className="chat-control" type="button" aria-label="Close chats" onClick={onClose}>
          <Icon name="close" size={17} />
        </button>
      </header>
      <label className="mx-4 mt-3 flex shrink-0 items-center gap-2 rounded-full bg-neutral-100 px-3 text-neutral-500 focus-within:ring-1 focus-within:ring-blue-500">
        <Icon name="search" size={16} />
        <input
          ref={input}
          type="search"
          aria-label={composing ? "Search members to message" : "Search chats"}
          className="h-9 w-full min-w-0 bg-transparent text-sm text-neutral-900 outline-none"
          placeholder={composing ? "Search members" : "Search chats"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {!composing && (
        <div className="mx-4 mt-3 flex gap-1">
          {["All", "Unread"].map((label) => (
            <button
              type="button"
              key={label}
              className="chat-filter"
              aria-pressed={unreadOnly === (label === "Unread")}
              onClick={() => setUnreadOnly(label === "Unread")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <ul className="chat-thread-list">
        {visible.map(({ member, latest }) => {
          const isUnread = !composing && unread.includes(member.id);
          const date = latest && chatDate(latest.createdAt);
          return (
            <li key={member.id}>
              <button
                type="button"
                className="chat-row"
                onClick={() => onOpen(member.id)}
                aria-label={`Message ${member.name}${isUnread ? ", unread" : ""}`}
              >
                <MemberAvatar member={member} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="flex-1 truncate text-sm font-semibold">{member.name}</span>
                    {latest && !composing && (
                      <time
                        className="shrink-0 text-[10px] text-neutral-500"
                        dateTime={new Date(latest.createdAt).toISOString()}
                      >
                        {date === "Today" ? chatTime(latest.createdAt) : date}
                      </time>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className={`flex-1 truncate text-xs ${isUnread ? "font-medium text-neutral-800" : "text-neutral-500"}`}
                    >
                      {composing
                        ? member.jobTitle || member.role
                        : latest
                          ? (latest.outgoing ? "You: " : "") + latest.body
                          : "Start a conversation"}
                    </span>
                    {isUnread && <span className="size-2 shrink-0 rounded-full bg-blue-600" />}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && (
        <p role="status" className="px-5 pb-6 pt-2 text-sm text-neutral-500">
          {term
            ? "No matches found."
            : unreadOnly && !composing
              ? "You’re all caught up."
              : "No conversations yet."}
        </p>
      )}
      {error && (
        <p role="alert" className="px-4 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <p className="shrink-0 border-t border-neutral-100 px-5 py-2.5 text-[11px] text-neutral-500">
        Demo messages are saved in this browser.
      </p>
    </section>
  );
}
