import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

type Panel = "Account" | "Notifications" | "Members" | "Chat";

const panelMessages: Record<Panel, string> = {
  Account: "You are using a local workspace.",
  Notifications: "No notifications.",
  Members: "No members have been added.",
  Chat: "Messaging is not connected.",
};

export function WorkspaceUtilities() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

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
        <button type="button" className="account-name" {...props("Account")}>
          <Icon name="account" size={28} />
          <span>Username</span>
        </button>
        <button type="button" className="icon-action" {...props("Notifications")}>
          <Icon name="bell" size={27} />
        </button>
        <button
          type="button"
          className="icon-action"
          aria-label="Sign out unavailable in local mode"
          title="Sign out is unavailable in local mode"
          disabled
        >
          <Icon name="logout" size={27} />
        </button>
      </div>
      <button type="button" className="utility-circle people-button" {...props("Members")}>
        <Icon name="people" size={44} />
      </button>
      <button type="button" className="utility-circle chat-button" {...props("Chat")}>
        <Icon name="chat" size={34} />
      </button>
      {panel && (
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
              onClick={() => {
                setPanel(null);
                trigger.current?.focus();
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </header>
          <p className="text-sm text-neutral-600">{panelMessages[panel]}</p>
        </section>
      )}
    </div>
  );
}
