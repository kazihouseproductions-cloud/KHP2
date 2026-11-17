// biome-ignore-all lint/a11y/useSemanticElements: SVG connections need interactive SVG groups; HTML buttons cannot wrap their paths.
import type { PointerEvent } from "react";
import { connectionGeometry, connectionPath } from "@/lib/board-geometry";
import { type BoardItem, type Connection, isItemVisible, itemRect } from "@/lib/board-model";
import type { WireDrag } from "./use-board-canvas";

function visibleEndpoint(id: string, items: BoardItem[]): BoardItem | undefined {
  let item = items.find((entry) => entry.id === id);
  if (!item || item.hidden) return undefined;
  const seen = new Set<string>();
  while (item && !isItemVisible(item, items) && !seen.has(item.id)) {
    seen.add(item.id);
    item = items.find((entry) => entry.id === item?.parentId);
    if (item?.hidden) return undefined;
  }
  return item;
}

export function BoardConnections({
  items,
  connections,
  selected,
  wire,
  zoom,
  onSelect,
  onKeyboardSelect,
  onReconnect,
}: {
  items: BoardItem[];
  connections: Connection[];
  selected: string[];
  wire: WireDrag | null;
  zoom: number;
  onSelect: (event: PointerEvent<SVGGElement>, id: string) => void;
  onKeyboardSelect: (id: string) => void;
  onReconnect: (event: PointerEvent<SVGCircleElement>, id: string, endpoint: "from" | "to") => void;
}) {
  const previewSource = wire ? visibleEndpoint(wire.from, items) : undefined;
  const source = previewSource ? itemRect(previewSource) : undefined;
  const snapTarget = wire?.targetId ? visibleEndpoint(wire.targetId, items) : undefined;
  const snapped =
    previewSource && snapTarget ? connectionGeometry(previewSource, snapTarget) : undefined;
  return (
    <>
      <svg className="connections" aria-label="Connections">
        <title>Component connections</title>
        <defs>
          <marker
            id="connection-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto-start-reverse"
          >
            <path d="M1 1 L7 4 L1 7" fill="none" stroke="context-stroke" strokeWidth="1.3" />
          </marker>
        </defs>
        {connections.map((edge) => {
          const from = visibleEndpoint(edge.from, items);
          const to = visibleEndpoint(edge.to, items);
          if (!from || !to || from.id === to.id) return null;
          const geometry = connectionGeometry(from, to);
          const active = selected.includes(edge.id);
          return (
            <g
              key={edge.id}
              className={`connection ${active ? "is-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Connection from ${from.title} to ${to.title}`}
              aria-pressed={active}
              data-connection-id={edge.id}
              onPointerDown={(event) => onSelect(event, edge.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onKeyboardSelect(edge.id);
                }
              }}
            >
              <path
                className="connection-line"
                d={geometry.path}
                fill="none"
                markerEnd="url(#connection-arrow)"
                vectorEffect="non-scaling-stroke"
              />
              <path
                className="connection-hit"
                d={geometry.path}
                fill="none"
                stroke="transparent"
                strokeWidth={16 / zoom}
              />
            </g>
          );
        })}
        {wire && source && (
          <path
            className="connection-preview"
            d={
              snapped?.path ||
              connectionPath(
                { x: source.x + source.width / 2, y: source.y + source.height / 2 },
                wire.point,
              )
            }
            fill="none"
            markerEnd="url(#connection-arrow)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <svg className="connection-handles-layer" aria-hidden="true">
        {snapped && (
          <circle
            className="connection-snap-point"
            cx={snapped.end.x}
            cy={snapped.end.y}
            r={5 / zoom}
            strokeWidth={1.5 / zoom}
          />
        )}
        {connections
          .filter((edge) => selected.includes(edge.id))
          .flatMap((edge) => {
            const from = visibleEndpoint(edge.from, items);
            const to = visibleEndpoint(edge.to, items);
            if (!from || !to || from.id === to.id) return [];
            const geometry = connectionGeometry(from, to);
            return (["from", "to"] as const).map((endpoint) => {
              const point = endpoint === "from" ? geometry.start : geometry.end;
              return (
                <circle
                  key={`${edge.id}-${endpoint}`}
                  className="connection-handle"
                  data-endpoint={endpoint}
                  cx={point.x}
                  cy={point.y}
                  r={7 / zoom}
                  strokeWidth={1.5 / zoom}
                  onPointerDown={(event) => onReconnect(event, edge.id, endpoint)}
                />
              );
            });
          })}
      </svg>
    </>
  );
}
