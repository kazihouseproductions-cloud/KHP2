import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ScrollArea } from "@/components/common/scroll-area";
import { Icon } from "@/components/ui/icon";

export function TaskList({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const listRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const cards = cardsRef.current;
    if (!list || !cards) return;

    const update = () =>
      setHasMoreBelow(list.scrollHeight - list.clientHeight - list.scrollTop > 1);
    update();
    const resize = new ResizeObserver(update);
    resize.observe(list);
    resize.observe(cards);
    list.addEventListener("scroll", update, { passive: true });
    return () => {
      resize.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, []);

  function scrollDown() {
    const list = listRef.current;
    if (!list) return;
    list.focus({ preventScroll: true });
    list.scrollBy({
      top: list.clientHeight * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <ScrollArea ref={listRef} id={id} className="task-list" label={label}>
      <div ref={cardsRef} className="grid gap-3 pb-2">
        {children}
      </div>
      {hasMoreBelow && (
        <div className="task-list-fade">
          <button
            type="button"
            className="task-scroll-down"
            aria-label={`Scroll down in ${label}`}
            aria-controls={id}
            onClick={scrollDown}
          >
            <Icon name="arrowDown" size={18} />
          </button>
        </div>
      )}
    </ScrollArea>
  );
}
