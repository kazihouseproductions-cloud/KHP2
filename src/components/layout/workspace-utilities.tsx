import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ShellIcon } from "@/components/ui/shell-icon";
import { previewMember } from "@/lib/members";
import { sections } from "@/lib/navigation";

type Panel = "Account" | "Notifications" | "Apps" | "Chat";

const panelMessages: Record<Panel, string> = {
  Account: "You are using a local workspace.",
  Notifications: "No notifications.",
  Apps: "Workspace tools",
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
          <ShellIcon name="account" size={30} />
          <span>{previewMember.name}</span>
        </button>
        <button type="button" className="icon-action" {...props("Chat")}>
          <ShellIcon name="chat" size={27} />
        </button>
        <button type="button" className="icon-action" {...props("Notifications")}>
          <ShellIcon name="bell" size={30} />
        </button>
        <button
          type="button"
          className="icon-action"
          aria-label="Sign out unavailable in local mode"
          title="Sign out is unavailable in local mode"
          disabled
        >
          <ShellIcon name="logout" size={30} />
        </button>
      </div>
      <button type="button" className="utility-circle apps-button" {...props("Apps")}>
        <ShellIcon name="apps" size={29} />
        <span>Apps</span>
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
          {panel === "Apps" ? (
            <nav aria-label="Workspace apps" className="apps-menu">
              {sections.map(({ id, label }) => (
                <a
                  key={id}
                  href={id === "workspace" ? "#/" : `#/tool/${id}`}
                  onClick={() => setPanel(null)}
                >
                  <ShellIcon name={id === "workspace" ? "board" : id} />
                  <span>{id === "workspace" ? "Board" : label}</span>
                </a>
              ))}
            </nav>
          ) : (
            <p className="text-sm text-neutral-600">{panelMessages[panel]}</p>
          )}
        </section>
      )}
    </div>
  );
}
