import { useLayoutEffect, useRef } from "react";

const edgeSpace = 24;
const boundsSelector =
  ".pin-position, .board-hub, .branch-position, .branch-ancestor, .task-column";

export function useBoardScroll(boardId: string) {
  const viewport = useRef<HTMLElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const surface = viewport.current;
    const content = plane.current;
    if (!surface || !content) return;
    let leftInset: number | undefined;

    // Absolute-positioned pins can extend to the left of the scroll origin.
    // Give those pins real layout space, and retain the user's position as the board grows.
    function fit() {
      if (!surface || !content) return;
      const position =
        leftInset === undefined
          ? (positions.current.get(boardId) ?? 0)
          : surface.scrollLeft - leftInset;
      const origin = content.getBoundingClientRect().left;
      let left = 0;
      let right = surface.clientWidth;
      for (const node of content.querySelectorAll(boundsSelector)) {
        const box = node.getBoundingClientRect();
        left = Math.min(left, box.left - origin - edgeSpace);
        right = Math.max(right, box.right - origin + edgeSpace);
      }
      leftInset = Math.ceil(-left);
      surface.style.setProperty("--board-inset", `${leftInset}px`);
      surface.style.setProperty("--board-width", `${Math.ceil(right) + leftInset}px`);
      surface.scrollLeft = leftInset + position;
    }

    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(content);
    // Adding/removing pins changes the extents without resizing the plane.
    const changes = new MutationObserver((records) => {
      if (
        records.some(({ target }) => target instanceof Element && target.closest(".board-origin"))
      )
        fit();
    });
    changes.observe(content, { childList: true, subtree: true });

    function wheel(event: WheelEvent) {
      if (
        !surface ||
        !event.deltaY ||
        event.deltaX ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.target instanceof Element && event.target.closest(".task-list")) return;
      if (surface.scrollWidth <= surface.clientWidth) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientWidth : 1;
      event.preventDefault();
      surface.scrollLeft += event.deltaY * unit;
    }
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => {
      positions.current.set(boardId, surface.scrollLeft - (leftInset ?? 0));
      resize.disconnect();
      changes.disconnect();
      surface.removeEventListener("wheel", wheel);
    };
  }, [boardId]);

  return { viewport, plane };
}
