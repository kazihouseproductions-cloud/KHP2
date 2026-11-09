import type { WorkspaceIconId } from "@/lib/workspaces";

export function WorkspaceGlyph({ icon, size = 36 }: { icon: WorkspaceIconId; size?: number }) {
  const mask = `url("/design/${icon}.svg") center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 bg-current"
      style={{ width: size, height: size, mask, WebkitMask: mask }}
    />
  );
}
