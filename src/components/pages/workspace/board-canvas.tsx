import type { CSSProperties } from "react";
import { boardLevels, childHref, type BoardItem, type BoardStep } from "@/lib/workspaces";
import { AddPin, BoardPin } from "./board-pin";
import { WorkspaceBranch } from "./workspace-branch";

function orbitPosition(index: number, total: number): CSSProperties {
  let angle = (2 * Math.PI * index) / total - Math.PI / 2;
  let offset = 0;
  // Extend the top and bottom rows of a large orbit so all pins fit vertically.
  if (total > 8) {
    const top = Math.ceil((total - 6) / 2);
    const bottom = total - 6 - top;
    if (index < top) {
      angle = -Math.PI / 2;
      offset = (2 * index) / (top - 1) - 1;
    } else if (index < top + 3) {
      angle = ((index - top - 1) * Math.PI) / 4;
      offset = 1;
    } else if (index < total - 3) {
      angle = Math.PI / 2;
      offset = bottom === 1 ? 0 : 1 - (2 * (index - top - 3)) / (bottom - 1);
    } else {
      angle = ((index - total + 6) * Math.PI) / 4;
      offset = -1;
    }
  }
  return {
    "--pin-x": `calc(var(--orbit) * ${Math.cos(angle)} + var(--extension) * ${offset})`,
    "--pin-y": `calc(var(--orbit) * ${Math.sin(angle)})`,
  } as CSSProperties;
}

export function BoardCanvas({
  path,
  items,
  onAdd,
}: {
  path: BoardStep[];
  items: BoardItem[];
  onAdd: () => void;
}) {
  const current = path.at(-1);
  const extraPairs = Math.max(0, Math.ceil((items.length - 8) / 2));
  return (
    <div className="board-origin" style={{ "--extra-pairs": extraPairs } as CSSProperties}>
      <div className="board-hub">
        <h1 className="board-title">{current?.item.title ?? "Workspace"}</h1>
        <WorkspaceBranch path={path} endpoint={items.length < 3 ? "title" : "ring"} />
      </div>
      {items.map((item, index) => (
        <div key={item.id} className="pin-position" style={orbitPosition(index, items.length)}>
          <BoardPin item={item} href={childHref(current?.href ?? "#/", path.length, item.id)} />
        </div>
      ))}
      <div className={`pin-position ${items.length ? "add-position" : "empty-add-position"}`}>
        <AddPin label={`Add ${boardLevels[path.length].label}`} onClick={onAdd} />
      </div>
    </div>
  );
}
