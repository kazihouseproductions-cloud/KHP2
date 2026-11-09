import { useEffect, useRef, type ComponentPropsWithRef, type UIEvent } from "react";

type ScrollAreaProps = ComponentPropsWithRef<"section"> & { label: string };

export function ScrollArea({ label, className = "", ...props }: ScrollAreaProps) {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(idleTimer.current), []);

  function showIndicator(event: UIEvent<HTMLElement>) {
    const area = event.currentTarget;
    area.dataset.scrolling = "true";
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => delete area.dataset.scrolling, 700);
  }

  return (
    <section
      {...props}
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users can focus and scroll this region.
      tabIndex={0}
      className={`scroll-area ${className}`}
      onScroll={showIndicator}
    />
  );
}
