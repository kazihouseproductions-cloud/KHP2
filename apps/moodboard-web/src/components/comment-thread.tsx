import { MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ThreadMessage } from "@/lib/board-model";

export function CommentThread({
  messages,
  author,
  disabled,
  onAuthorChange,
  onPost,
}: {
  messages: ThreadMessage[];
  author: string;
  disabled: boolean;
  onAuthorChange: (author: string) => void;
  onPost: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (messages.length && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);
  const canPost = Boolean(author.trim() && draft.trim() && !disabled);
  function post() {
    if (canPost) {
      onPost(draft.trim());
      setDraft("");
    }
  }
  return (
    <div className="comment-thread">
      <h3 className="comment-thread-heading">
        <MessageSquare size={16} />
        <span>Conversation</span>
        <span className="thread-count">{messages.length}</span>
      </h3>
      <ol
        className="comment-messages"
        aria-label="Comment conversation"
        data-canvas-scroll
        data-card-interactive
        ref={list}
      >
        {messages.map((message) => (
          <li key={message.id} className="thread-message">
            <span className="message-avatar" aria-hidden="true">
              {message.author.slice(0, 1).toUpperCase()}
            </span>
            <div className="message-content">
              <div className="message-meta">
                <strong>{message.author}</strong>
                <time dateTime={new Date(message.createdAt).toISOString()}>
                  {new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Dhaka",
                  }).format(message.createdAt)}
                </time>
              </div>
              <p>{message.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {!messages.length && (
        <div className="thread-empty">
          <MessageSquare size={24} />
          <span>Start a conversation</span>
          <p>Keep your thoughts and replies together.</p>
        </div>
      )}
      <form
        className="thread-composer"
        onSubmit={(event) => {
          event.preventDefault();
          post();
        }}
      >
        <label className="comment-author">
          <span>Name</span>
          <input
            aria-label="Comment author name"
            placeholder="Your name"
            autoComplete="off"
            maxLength={60}
            value={author}
            disabled={disabled}
            onChange={(event) => onAuthorChange(event.target.value)}
          />
        </label>
        <div className="reply-input">
          <textarea
            aria-label="Comment reply"
            placeholder="Write a reply..."
            maxLength={4000}
            value={draft}
            readOnly={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                post();
              }
            }}
          />
          <button
            type="submit"
            aria-label="Post reply"
            title="Post reply (Ctrl+Enter)"
            disabled={!canPost}
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
