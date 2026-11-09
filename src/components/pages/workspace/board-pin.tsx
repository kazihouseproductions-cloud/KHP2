import { Icon } from "@/components/ui/icon";
import { WorkspaceGlyph } from "@/components/ui/workspace-glyph";
import type { BoardItem } from "@/lib/workspaces";

export function BoardPin({
  item,
  href,
  label = `Open ${item.title}`,
}: {
  item: BoardItem;
  href: string;
  label?: string;
}) {
  return (
    <a href={href} draggable={false} aria-label={label} className="board-pin group">
      <span className="pin-face pin-image">
        <WorkspaceGlyph icon={item.icon} />
      </span>
      <span className="pin-face pin-caption">
        <span>{item.title}</span>
      </span>
    </a>
  );
}

export function AddPin({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="add-pin">
      <Icon name="plus" size={26} />
      <span>{label}</span>
    </button>
  );
}
