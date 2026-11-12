import { useLayoutEffect, useRef } from "react";

type Point = { x: number; y: number };

const boundsSelector =
  ".pin-position, .board-hub, .branch-position, .branch-ancestor, .task-column";

function panPadding(size: number, firstEdge: number, lastEdge: number, limit: number) {
  // Leave a control in reach when a compact board sits close to one edge.
  return Math.max(0, Math.min(size / 3, limit, size - firstEdge - 64, lastEdge - 64));
}

function enableMousePan(surface: HTMLElement, signal: AbortSignal) {
  let drag: { id: number; x: number; y: number } | undefined;

  function endDrag() {
    if (drag && surface.hasPointerCapture(drag.id)) surface.releasePointerCapture(drag.id);
    drag = undefined;
    delete surface.dataset.dragging;
  }

  // Touch uses the native two-axis scroller. Cards, controls and list scrollbars
  // retain their own pointer interactions.
  surface.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".board-track")) return;
      if (target.closest("a, button, input, select, textarea, [draggable=true]")) return;
      // A press on a native scrollbar targets the list itself, outside its client width.
      if (target.matches(".task-list") && event.offsetX >= target.clientWidth) return;
      event.preventDefault();
      surface.focus({ preventScroll: true });
      surface.setPointerCapture(event.pointerId);
      drag = {
        id: event.pointerId,
        x: event.clientX + surface.scrollLeft,
        y: event.clientY + surface.scrollTop,
      };
      surface.dataset.dragging = "true";
    },
    { signal },
  );

  surface.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const left = Math.max(
        0,
        Math.min(drag.x - event.clientX, surface.scrollWidth - surface.clientWidth),
      );
      const top = Math.max(
        0,
        Math.min(drag.y - event.clientY, surface.scrollHeight - surface.clientHeight),
      );
      surface.scrollTo(left, top);
      drag.x = event.clientX + left;
      drag.y = event.clientY + top;
    },
    { signal },
  );

  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    surface.addEventListener(
      eventName,
      (event) => {
        if (drag?.id === event.pointerId) endDrag();
      },
      { signal },
    );
  }
  signal.addEventListener("abort", endDrag, { once: true });
}

export function useBoardScroll(boardId: string) {
  const viewport = useRef<HTMLElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, Point>());

  useLayoutEffect(() => {
    const surface = viewport.current;
    const content = plane.current;
    if (!surface || !content) return;
    let inset: Point | undefined;

    const position = () =>
      inset
        ? { x: surface.scrollLeft - inset.x, y: surface.scrollTop - inset.y }
        : (positions.current.get(boardId) ?? { x: 0, y: 0 });

    const fit = () => {
      const previous = position();
      const origin = content.getBoundingClientRect();
      const width = surface.clientWidth;
      const height = surface.clientHeight;
      let left = width;
      let right = 0;
      let top = height;
      let bottom = 0;
      for (const node of content.querySelectorAll(boundsSelector)) {
        const box = node.getBoundingClientRect();
        left = Math.min(left, box.left - origin.left);
        right = Math.max(right, box.right - origin.left);
        top = Math.min(top, box.top - origin.top);
        bottom = Math.max(bottom, box.bottom - origin.top);
      }
      const roomX = panPadding(width, left, right, 320);
      const roomY = panPadding(height, top, bottom, 220);
      inset = {
        x: Math.ceil(roomX - Math.min(0, left)),
        y: Math.ceil(roomY - Math.min(0, top)),
      };
      surface.style.setProperty("--board-left", `${inset.x}px`);
      surface.style.setProperty("--board-top", `${inset.y}px`);
      surface.style.setProperty(
        "--board-width",
        `${Math.ceil(Math.max(width, right) + roomX) + inset.x}px`,
      );
      surface.style.setProperty(
        "--board-height",
        `${Math.ceil(Math.max(height, bottom) + roomY) + inset.y}px`,
      );
      surface.scrollTo(inset.x + previous.x, inset.y + previous.y);
    };

    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(content);
    const changes = new MutationObserver((records) => {
      if (
        records.some(({ target }) => target instanceof Element && target.closest(".board-origin"))
      )
        fit();
    });
    changes.observe(content, { childList: true, subtree: true });

    const listeners = new AbortController();
    enableMousePan(surface, listeners.signal);
    surface.addEventListener(
      "keydown",
      (event) => {
        if (event.target === surface && event.key === "Home" && inset) {
          event.preventDefault();
          surface.scrollTo(inset.x, inset.y);
        }
      },
      { signal: listeners.signal },
    );

    return () => {
      positions.current.set(boardId, position());
      resize.disconnect();
      changes.disconnect();
      listeners.abort();
    };
  }, [boardId]);

  return { viewport, plane };
}
