import {
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";

export function PinPopover({
  id,
  anchor,
  label,
  menu = false,
  onClose,
  children,
}: {
  id: string;
  anchor: HTMLButtonElement;
  label: string;
  menu?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    panel.showPopover();
    function place() {
      if (!panel) return;
      const trigger = anchor.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      panel.style.left = `${Math.max(12, Math.min(trigger.right - box.width, window.innerWidth - box.width - 12))}px`;
      panel.style.top = `${
        trigger.bottom + box.height + 8 <= window.innerHeight - 12
          ? trigger.bottom + 8
          : Math.max(12, trigger.top - box.height - 8)
      }px`;
    }
    place();
    panel.querySelector<HTMLElement>(menu ? '[role="menuitem"]' : "input, button")?.focus();
    const resize = new ResizeObserver(place);
    resize.observe(panel);
    window.addEventListener("resize", place);
    const scroll = (event: Event) => {
      if (event.target instanceof Node && panel.contains(event.target)) return;
      onClose();
    };
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("hashchange", onClose);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("hashchange", onClose);
      panel.hidePopover();
    };
  }, [anchor, menu, onClose]);

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      anchor.focus();
      onClose();
    }
    if (!menu) return;
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : event.key === "ArrowUp"
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : null;
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
    if (event.key === "Tab") onClose();
  }

  const props = {
    ref,
    id,
    popover: "auto" as const,
    "aria-label": label,
    className: `pin-popover ${menu ? "pin-menu" : "pin-members-panel"}`,
    onKeyDown: keyDown,
    onToggle: (event: SyntheticEvent<HTMLDivElement>) => {
      if (!event.currentTarget.matches(":popover-open")) onClose();
    },
  };
  return createPortal(
    menu ? (
      <div {...props} role="menu">
        {children}
      </div>
    ) : (
      <div {...props} role="dialog">
        {children}
      </div>
    ),
    document.body,
  );
}
