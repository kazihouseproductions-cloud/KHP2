import {
  type Dispatch,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyWheel,
  boundsOf,
  containsPoint,
  findConnectionTarget,
  type Point,
  rectangleSelection,
  rectFromPoints,
  rotationDelta,
  selectRange,
  toBoardPoint,
  type View,
} from "@/lib/board-geometry";
import {
  allowNestedCollections,
  type BoardAction,
  type BoardHistory,
  type BoardImage,
  createImageItem,
  createItem,
  descendants,
  type ItemKind,
  isItemLocked,
  isItemVisible,
  itemRect,
  placeItem,
  rotateItems,
  selectionRoots,
  type Tool,
} from "@/lib/board-model";

export type WireDrag = {
  from: string;
  point: Point;
  targetId?: string;
  edgeId?: string;
  endpoint?: "from" | "to";
};
type Gesture =
  | { type: "move"; start: Point; ids: string[]; dx: number; dy: number }
  | {
      type: "rotate";
      start: Point;
      center: Point;
      ids: string[];
      initialAngle: number;
      delta: number;
    }
  | { type: "pan"; start: Point; view: View }
  | { type: "marquee"; start: Point; point: Point; initial: string[]; additive: boolean };

export function useBoardCanvas(history: BoardHistory, dispatch: Dispatch<BoardAction>) {
  const [tool, setTool] = useState<Tool>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [wire, setWire] = useState<WireDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const wireRef = useRef<WireDrag | null>(null);
  const viewRef = useRef(view);
  const selectionRef = useRef(selectedIds);
  const anchorRef = useRef<string | null>(null);
  const placementCount = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const board = history.present;
  viewRef.current = view;
  selectionRef.current = selectedIds;

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3200);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  function originX() {
    return window.innerWidth <= 700 ? -248 : 0;
  }
  function boardPoint(point: Point) {
    return toBoardPoint(point, viewRef.current, originX());
  }
  function clientPoint(event: { clientX: number; clientY: number }) {
    return { x: event.clientX, y: event.clientY };
  }
  function focusCanvas() {
    canvasRef.current?.focus({ preventScroll: true });
  }
  function capture(event: PointerEvent<Element>) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  const changeGesture = useCallback((next: Gesture | null) => {
    gestureRef.current = next;
    setGesture(next);
  }, []);
  const changeWire = useCallback((next: WireDrag | null) => {
    wireRef.current = next;
    setWire(next);
  }, []);

  const changeTool = useCallback(
    (next: Tool) => {
      setTool(next);
      setWire(null);
      wireRef.current = null;
      if (next === "connect") announce("Drag from one component to another to connect them.");
      if (next === "comment") announce("Click the canvas to leave a comment.");
    },
    [announce],
  );

  const addItem = useCallback(
    (kind: ItemKind) => {
      const id = crypto.randomUUID();
      const currentView = viewRef.current;
      dispatch({
        type: "add",
        item: placeItem(
          kind,
          id,
          { width: window.innerWidth, height: window.innerHeight },
          currentView,
          (placementCount.current++ % 5) * 28,
          currentView.zoom,
        ),
      });
      setSelectedIds([id]);
      setSelectedEdges([]);
      anchorRef.current = id;
      setTool("select");
      setWire(null);
      wireRef.current = null;
    },
    [dispatch],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function wheel(event: WheelEvent) {
      const scrollable =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-canvas-scroll], textarea")
          : null;
      if (
        !event.ctrlKey &&
        !event.shiftKey &&
        scrollable &&
        scrollable.scrollHeight > scrollable.clientHeight + 1
      )
        return;
      event.preventDefault();
      const multiplier =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const next = applyWheel(
        viewRef.current,
        {
          x: event.clientX,
          y: event.clientY,
          deltaX: event.deltaX * multiplier,
          deltaY: event.deltaY * multiplier,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
        },
        window.innerWidth <= 700 ? -248 : 0,
      );
      viewRef.current = next;
      setView(next);
    }
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, []);

  const deleteSelection = useCallback(() => {
    dispatch({ type: "delete-selection", itemIds: selectedIds, connectionIds: selectedEdges });
    setSelectedIds([]);
    setSelectedEdges([]);
  }, [selectedIds, selectedEdges, dispatch]);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.target as HTMLElement).closest("input, textarea, [contenteditable], dialog"))
        return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (command && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedIds(
          board.items.filter((item) => isItemVisible(item, board.items)).map((item) => item.id),
        );
        setSelectedEdges([]);
        return;
      }
      if (command || event.altKey) return;
      if (event.key === "Escape") {
        setSelectedIds([]);
        setSelectedEdges([]);
        changeGesture(null);
        changeWire(null);
        changeTool("select");
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedIds.length || selectedEdges.length) {
          event.preventDefault();
          deleteSelection();
        }
      }
      const arrows: Record<string, Point> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      if (arrows[event.key] && selectedIds.length) {
        event.preventDefault();
        const direction = arrows[event.key];
        dispatch({
          type: "move",
          ids: selectedIds,
          dx: direction.x * (event.shiftKey ? 10 : 1),
          dy: direction.y * (event.shiftKey ? 10 : 1),
        });
      }
      if (event.key.toLowerCase() === "v") changeTool("select");
      if (event.key.toLowerCase() === "h") changeTool("grab");
      if (event.key.toLowerCase() === "c") changeTool("comment");
      if (event.key.toLowerCase() === "n") addItem("sticky");
      if (event.key.toLowerCase() === "t") addItem("text");
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [
    selectedIds,
    selectedEdges,
    board.items,
    deleteSelection,
    changeTool,
    addItem,
    changeGesture,
    changeWire,
    dispatch,
  ]);

  const movingIds = useMemo(
    () => (gesture?.type === "move" ? descendants(board.items, gesture.ids) : []),
    [gesture, board.items],
  );
  const renderedItems = useMemo(
    () =>
      gesture?.type === "move"
        ? board.items.map((item) =>
            movingIds.includes(item.id)
              ? { ...item, x: item.x + gesture.dx, y: item.y + gesture.dy }
              : item,
          )
        : gesture?.type === "rotate"
          ? rotateItems(board.items, gesture.ids, gesture.center, gesture.delta)
          : board.items,
    [board.items, gesture, movingIds],
  );
  const visibleItems = renderedItems.filter((item) => isItemVisible(item, renderedItems));
  const activeItems = renderedItems.filter((item) => selectedIds.includes(item.id));
  const selectionBounds = boundsOf(
    activeItems.filter((item) => isItemVisible(item, renderedItems)),
  );

  function groupAt(point: Point, moving: string[]): string | null {
    const candidates = [...visibleItems]
      .reverse()
      .filter(
        (item) =>
          item.kind === "collection" &&
          !moving.includes(item.id) &&
          !isItemLocked(item, board.items) &&
          containsPoint(itemRect(item), point),
      );
    return candidates[0]?.id || null;
  }

  function startCard(event: PointerEvent<HTMLElement>, id: string) {
    if (tool === "grab" || event.button === 1) return;
    if (event.button !== 0) return;
    const item = board.items.find((entry) => entry.id === id);
    if (!item) return;
    const point = boardPoint(clientPoint(event));
    if (tool === "connect") {
      event.preventDefault();
      focusCanvas();
      capture(event);
      setSelectedIds([]);
      setSelectedEdges([]);
      changeWire({ from: id, point });
      return;
    }
    if (tool === "rotate") {
      if (item.kind !== "collection")
        startRotation(event, selectedIds.includes(id) ? selectedIds : [id]);
      return;
    }
    if (tool === "comment") return;
    const modifiers = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey };
    let ids = selectedIds;
    if (modifiers.ctrl || modifiers.shift)
      ids = selectRange(
        board.items.map((entry) => entry.id),
        selectedIds,
        anchorRef.current,
        id,
        { ctrl: true, shift: false },
      );
    else if (!selectedIds.includes(id)) ids = [id];
    setSelectedIds(ids);
    setSelectedEdges([]);
    anchorRef.current = id;
    if (modifiers.ctrl || modifiers.shift) event.preventDefault();
    const editing = (event.target as HTMLElement).closest(
      "input, textarea, button, a, [contenteditable], [data-card-interactive]",
    );
    if (editing || isItemLocked(item, board.items) || !ids.includes(id)) return;
    const roots = selectionRoots(board.items, ids).filter((selected) => {
      const card = board.items.find((entry) => entry.id === selected);
      return card && !isItemLocked(card, board.items);
    });
    if (!roots.length) return;
    event.preventDefault();
    focusCanvas();
    capture(event);
    changeGesture({ type: "move", start: point, ids: roots, dx: 0, dy: 0 });
  }

  function focusCard(id: string) {
    if (tool !== "select") return;
    if (!selectionRef.current.includes(id)) {
      setSelectedIds([id]);
      setSelectedEdges([]);
      anchorRef.current = id;
    }
  }

  function canvasDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    if (
      (event.target as HTMLElement).closest(
        ".selection-actions, .connection-hit, .connection-handle, .rotation-handle",
      )
    )
      return;
    if (
      tool !== "grab" &&
      event.button !== 1 &&
      (event.target as HTMLElement).closest(".board-card, .collection-heading")
    )
      return;
    focusCanvas();
    if (tool === "grab" || event.button === 1) {
      event.preventDefault();
      capture(event);
      changeGesture({ type: "pan", start: clientPoint(event), view });
      return;
    }
    const point = boardPoint(clientPoint(event));
    if (tool === "comment") {
      const id = crypto.randomUUID();
      dispatch({ type: "add", item: createItem("comment", id, point.x, point.y) });
      setSelectedIds([id]);
      setTool("select");
      return;
    }
    if (tool === "select") {
      event.preventDefault();
      capture(event);
      setSelectedEdges([]);
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      const initial = additive ? selectedIds : [];
      if (!additive) setSelectedIds([]);
      changeGesture({ type: "marquee", start: point, point, initial, additive });
    }
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const point = boardPoint(clientPoint(event));
    if (wireRef.current) {
      const target = findConnectionTarget(renderedItems, point, wireRef.current.from, view.zoom);
      changeWire({ ...wireRef.current, point, targetId: target?.id });
      return;
    }
    const current = gestureRef.current;
    if (current?.type === "pan") {
      const next = {
        ...current.view,
        x: current.view.x + event.clientX - current.start.x,
        y: current.view.y + event.clientY - current.start.y,
      };
      viewRef.current = next;
      setView(next);
    }
    if (current?.type === "move") {
      const next = { ...current, dx: point.x - current.start.x, dy: point.y - current.start.y };
      changeGesture(next);
      const allMoving = descendants(board.items, current.ids);
      const onlyGroups = current.ids.every(
        (id) => board.items.find((item) => item.id === id)?.kind === "collection",
      );
      setDropTarget(onlyGroups && !allowNestedCollections ? null : groupAt(point, allMoving));
    }
    if (current?.type === "marquee") {
      changeGesture({ ...current, point });
      if (Math.hypot(point.x - current.start.x, point.y - current.start.y) * view.zoom > 3)
        setSelectedIds([
          ...new Set([
            ...current.initial,
            ...rectangleSelection(renderedItems, current.start, point),
          ]),
        ]);
    }
    if (current?.type === "rotate")
      changeGesture({
        ...current,
        delta: rotationDelta(
          current.start,
          point,
          current.center,
          current.initialAngle,
          event.shiftKey,
        ),
      });
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const point = boardPoint(clientPoint(event));
    const currentWire = wireRef.current;
    if (currentWire) {
      const target = findConnectionTarget(renderedItems, point, currentWire.from, view.zoom);
      if (target) {
        if (currentWire.edgeId && currentWire.endpoint)
          dispatch({
            type: "reconnect",
            id: currentWire.edgeId,
            endpoint: currentWire.endpoint,
            itemId: target.id,
          });
        else dispatch({ type: "connect", from: currentWire.from, to: target.id });
      }
      changeWire(null);
    }
    const current = gestureRef.current;
    if (current?.type === "move") {
      const dx = point.x - current.start.x;
      const dy = point.y - current.start.y;
      if (Math.hypot(dx, dy) * view.zoom > 2) {
        const target = groupAt(point, descendants(board.items, current.ids));
        const regularIds = current.ids.filter(
          (id) =>
            allowNestedCollections ||
            board.items.find((item) => item.id === id)?.kind !== "collection",
        );
        dispatch({
          type: "move",
          ids: current.ids,
          dx,
          dy,
          dropInto: target && regularIds.length ? target : null,
        });
      }
    }
    if (current?.type === "rotate")
      dispatch({
        type: "rotate",
        ids: current.ids,
        center: current.center,
        delta: rotationDelta(
          current.start,
          point,
          current.center,
          current.initialAngle,
          event.shiftKey,
        ),
      });
    changeGesture(null);
    setDropTarget(null);
  }

  function edgeDown(event: PointerEvent<SVGGElement>, id: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    focusCanvas();
    setSelectedIds([]);
    setSelectedEdges(
      event.ctrlKey || event.metaKey
        ? selectedEdges.includes(id)
          ? selectedEdges.filter((edge) => edge !== id)
          : [...selectedEdges, id]
        : [id],
    );
  }

  function reconnectDown(
    event: PointerEvent<SVGCircleElement>,
    id: string,
    endpoint: "from" | "to",
  ) {
    event.stopPropagation();
    event.preventDefault();
    focusCanvas();
    const edge = board.connections.find((entry) => entry.id === id);
    if (!edge) return;
    capture(event);
    changeWire({
      from: endpoint === "from" ? edge.to : edge.from,
      point: boardPoint(clientPoint(event)),
      edgeId: id,
      endpoint,
    });
  }

  function selectFromPanel(
    id: string,
    modifiers: { ctrl: boolean; shift: boolean },
    order: string[],
  ) {
    const next = selectRange(order, selectedIds, anchorRef.current, id, modifiers);
    setSelectedIds(next);
    setSelectedEdges([]);
    setTool("select");
    if (!modifiers.shift) anchorRef.current = id;
    let item = board.items.find((entry) => entry.id === id);
    while (item?.parentId) {
      const parent = board.items.find((entry) => entry.id === item?.parentId);
      if (parent?.collapsed)
        dispatch({ type: "update", id: parent.id, changes: { collapsed: false } });
      item = parent;
    }
    const selected = board.items.find((entry) => entry.id === id);
    if (next.length === 1 && selected) {
      const rect = itemRect(selected);
      const left = originX() + view.x + rect.x * view.zoom;
      const top = view.y + rect.y * view.zoom;
      if (
        left < (window.innerWidth <= 700 ? 80 : 250) ||
        left + rect.width * view.zoom > window.innerWidth - 240 ||
        top < 20 ||
        top + rect.height * view.zoom > window.innerHeight - 100
      ) {
        setView({
          ...view,
          x: window.innerWidth / 2 - originX() - (rect.x + rect.width / 2) * view.zoom,
          y: window.innerHeight / 2 - (rect.y + rect.height / 2) * view.zoom,
        });
      }
    }
  }

  function duplicateSelection() {
    const ids = descendants(board.items, selectedIds);
    const idMap = Object.fromEntries(ids.map((id) => [id, crypto.randomUUID()]));
    dispatch({ type: "duplicate", ids: selectedIds, idMap });
    setSelectedIds(selectedIds.map((id) => idMap[id]));
  }

  function rotateSelection() {
    if (
      !activeItems.some(
        (item) =>
          item.kind !== "collection" &&
          !isItemLocked(item, board.items) &&
          isItemVisible(item, board.items),
      )
    ) {
      announce("Select an unlocked component to rotate it.");
      return;
    }
    changeTool(tool === "rotate" ? "select" : "rotate");
    if (tool !== "rotate")
      announce("Drag the selected object or rotation handle. Hold Shift to snap.");
  }

  function startRotation(event: PointerEvent<HTMLElement>, ids = selectedIds) {
    const items = board.items.filter(
      (item) =>
        ids.includes(item.id) &&
        item.kind !== "collection" &&
        !isItemLocked(item, board.items) &&
        isItemVisible(item, board.items),
    );
    const bounds = boundsOf(items);
    if (!bounds) return;
    event.stopPropagation();
    event.preventDefault();
    focusCanvas();
    capture(event);
    const targetIds = items.map((item) => item.id);
    setSelectedIds(targetIds);
    setSelectedEdges([]);
    changeGesture({
      type: "rotate",
      start: boardPoint(clientPoint(event)),
      center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      ids: targetIds,
      initialAngle: items[0].rotation,
      delta: 0,
    });
  }

  function resetZoom() {
    const point = toBoardPoint(
      { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      view,
      originX(),
    );
    setView({
      zoom: 1,
      x: window.innerWidth / 2 - originX() - point.x,
      y: window.innerHeight / 2 - point.y,
    });
  }

  function unwrapCollection(id: string) {
    const children = board.items.filter((item) => item.parentId === id).map((item) => item.id);
    dispatch({ type: "unwrap", id });
    setSelectedIds(children);
  }

  function placeImage(image: BoardImage, client: Point) {
    const item = createImageItem(crypto.randomUUID(), image, boardPoint(client));
    if (!item) return;
    dispatch({ type: "add", item });
    setSelectedIds([item.id]);
    setSelectedEdges([]);
    setTool("select");
    changeWire(null);
  }

  return {
    history,
    board,
    dispatch,
    tool,
    changeTool,
    selectedIds,
    selectedEdges,
    activeItems,
    selectionBounds,
    renderedItems,
    visibleItems,
    view,
    canvasRef,
    gesture,
    wire,
    dropTarget,
    notice,
    announce,
    addItem,
    placeImage,
    startCard,
    focusCard,
    canvasDown,
    pointerMove,
    pointerUp,
    cancelGesture: () => {
      changeGesture(null);
      changeWire(null);
      setDropTarget(null);
    },
    edgeDown,
    selectEdge: (id: string) => {
      setSelectedIds([]);
      setSelectedEdges([id]);
    },
    reconnectDown,
    selectFromPanel,
    duplicateSelection,
    deleteSelection,
    rotateSelection,
    startRotation,
    resetZoom,
    unwrapCollection,
    marquee: gesture?.type === "marquee" ? rectFromPoints(gesture.start, gesture.point) : null,
  };
}
