import { getCatalogIcon } from "@/lib/catalog-icons";
import type { WorkspaceIconId } from "@/lib/workspaces";

export function WorkspaceGlyph({ icon, size = 36 }: { icon: WorkspaceIconId; size?: number }) {
  const catalogIcon = getCatalogIcon(icon);
  if (catalogIcon) {
    return (
      <svg aria-hidden="true" width={size} height={size} fill="currentColor" className="shrink-0">
        <use href={catalogIcon.href} width="100%" height="100%" />
      </svg>
    );
  }
  const mask = `url("/design/${icon}.svg") center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 bg-current"
      style={{ width: size, height: size, mask, WebkitMask: mask }}
    />
  );
}
