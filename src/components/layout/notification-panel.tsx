import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { notifications } from "@/lib/notifications";

const kinds = {
  assignment: { icon: "tasks", color: "bg-blue-50 text-blue-700" },
  approval: { icon: "check", color: "bg-emerald-50 text-emerald-700" },
  workspace: { icon: "people", color: "bg-amber-50 text-amber-800" },
} as const;
const timestamp = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function NotificationPanel({
  unreadIds,
  markRead,
  error,
  onClose,
}: {
  unreadIds: string[];
  markRead: (ids: readonly string[]) => void;
  error: string;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      id="utility-panel"
      aria-labelledby="notifications-heading"
      className="notifications-panel"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2
            id="notifications-heading"
            ref={heading}
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight outline-none"
          >
            Notifications
          </h2>
          <p role="status" className="text-xs text-neutral-500">
            {unreadIds.length ? `${unreadIds.length} unread` : "All caught up"}
          </p>
        </div>
        {unreadIds.length > 0 && (
          <button
            type="button"
            onClick={() => markRead(unreadIds)}
            className="rounded-md px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            Mark all as read
          </button>
        )}
        <button
          type="button"
          className="icon-action"
          aria-label="Close notifications"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      </header>
      {error && (
        <p role="alert" className="px-4 pt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <ol
        aria-label="Recent notifications"
        className="min-h-0 divide-y divide-neutral-100 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
      >
        {notifications.map((item) => {
          const unread = unreadIds.includes(item.id);
          const { icon, color } = kinds[item.kind];
          return (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3.5">
              <span
                aria-hidden="true"
                className={`grid size-9 shrink-0 place-items-center rounded-xl ${color}`}
              >
                <Icon name={icon} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={unread ? "text-sm font-semibold" : "text-sm font-medium"}>
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{item.detail}</p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-[11px]">
                  <time dateTime={item.createdAt} className="text-neutral-500">
                    {timestamp.format(new Date(item.createdAt))}
                  </time>
                  {unread ? (
                    <button
                      type="button"
                      aria-label={`Mark as read: ${item.title}`}
                      onClick={() => markRead([item.id])}
                      className="rounded px-1 py-0.5 font-medium text-blue-700 hover:underline"
                    >
                      Mark as read
                    </button>
                  ) : (
                    <span className="px-1 py-0.5 text-neutral-500">Read</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
