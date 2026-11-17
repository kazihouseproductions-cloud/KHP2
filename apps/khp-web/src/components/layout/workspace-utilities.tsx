import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ShellIcon } from "@/components/ui/shell-icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import type { Member } from "@/lib/members";
import { sectionHref, sectionIcon, sections } from "@/lib/navigation";
import { WorkspaceSearch, type WorkspaceSearchProps } from "./workspace-search";
import { WorkspaceChat } from "@/components/pages/chat/workspace-chat";
import { NotificationPanel } from "./notification-panel";
import { useNotifications } from "@/hooks/use-notifications";

type Panel = "Notifications" | "Apps" | "Chat";

export function WorkspaceUtilities({
  member,
  ...search
}: { member: Member } & WorkspaceSearchProps) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const chatTrigger = useRef<HTMLButtonElement>(null);
  const notificationState = useNotifications(member.id);
  const unreadCount = notificationState.unreadIds.length;

  function closePanel() {
    setPanel(null);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!panel) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setPanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panel]);

  function props(which: Panel) {
    return {
      "aria-label": which,
      title: which,
      "aria-expanded": panel === which,
      "aria-controls": panel === which ? "utility-panel" : undefined,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        trigger.current = event.currentTarget;
        setPanel((current) => (current === which ? null : which));
      },
    };
  }

  return (
    <div ref={container}>
      <div className="account-pill">
        <WorkspaceSearch {...search} onOpen={() => setPanel(null)} />
        <a
          className="account-name"
          href={sectionHref("profile")}
          aria-label={member.name}
          title="My Profile"
          onClick={() => setPanel(null)}
        >
          {member.photo ? <MemberAvatar member={member} /> : <Icon name="account" size={22} />}
          <span className="account-label">{member.name}</span>
        </a>
        <button ref={chatTrigger} type="button" className="icon-action" {...props("Chat")}>
          <Icon name="chat" size={22} />
        </button>
        <button
          type="button"
          className="icon-action relative"
          {...props("Notifications")}
          aria-description={
            unreadCount ? `${unreadCount} unread notifications` : "All notifications are read"
          }
        >
          <Icon name="bell" size={22} />
          {unreadCount > 0 && (
            <span aria-hidden="true" className="notification-badge">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className="icon-action"
          aria-label="Sign out unavailable in local mode"
          title="Sign out is unavailable in local mode"
          disabled
        >
          <Icon name="logout" size={22} />
        </button>
      </div>
      <button type="button" className="utility-circle apps-button" {...props("Apps")}>
        <ShellIcon name="apps" size={29} />
        <span>Apps</span>
      </button>
      <WorkspaceChat
        account={member}
        members={search.members}
        inboxOpen={panel === "Chat"}
        hideInbox={() => setPanel(null)}
        focusTrigger={() => chatTrigger.current?.focus()}
      />
      {panel === "Notifications" && (
        <NotificationPanel {...notificationState} onClose={closePanel} />
      )}
      {panel === "Apps" && (
        <section
          id="utility-panel"
          aria-label={panel}
          className={`utility-panel panel-${panel.toLowerCase()}`}
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-brand">{panel}</h2>
            <button
              type="button"
              className="icon-action"
              aria-label={`Close ${panel.toLowerCase()}`}
              onClick={closePanel}
            >
              <Icon name="close" size={16} />
            </button>
          </header>
          <nav aria-label="Workspace apps" className="apps-menu">
            {sections.map(({ id, label }) => (
              <a key={id} href={sectionHref(id)} onClick={() => setPanel(null)}>
                <ShellIcon name={sectionIcon(id)} />
                <span>{id === "workspace" ? "Board" : label}</span>
              </a>
            ))}
          </nav>
        </section>
      )}
    </div>
  );
}
