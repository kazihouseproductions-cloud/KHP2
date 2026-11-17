import type { CSSProperties } from "react";
import type { BoardStep } from "@/lib/workspaces";
import { BoardPin } from "./board-pin";

export function WorkspaceBranch({
  path,
  endpoint,
}: {
  path: BoardStep[];
  endpoint: "title" | "ring" | "tasks";
}) {
  const current = path.at(-1);
  if (!current) return null;

  return (
    <nav
      aria-label="Return to a parent board"
      className="workspace-branch"
      data-endpoint={endpoint}
      data-has-ancestors={path.length > 1 || undefined}
    >
      <span className="branch-connector" aria-hidden="true" />
      <div className="branch-position">
        <BoardPin
          item={current.item}
          href={current.parentHref}
          label={`${current.item.title} — back to ${current.parentTitle}`}
        />
        {path
          .slice(0, -1)
          .reverse()
          .map((step, index) => (
            <div
              className="branch-ancestor"
              key={step.item.id}
              style={{ "--index": index } as CSSProperties}
            >
              <svg
                className="ancestor-connector"
                aria-hidden="true"
                viewBox="0 0 100 120"
                preserveAspectRatio="none"
                fill="none"
              >
                <path
                  d={index === 0 ? "M88 4 C105 81 95 120 14 103" : "M16 5 C69 45 69 115 14 100"}
                  stroke="#bcbcbc"
                  strokeWidth="1.8"
                  strokeDasharray="18 17"
                  strokeLinecap="round"
                />
              </svg>
              <BoardPin
                item={step.item}
                href={step.parentHref}
                label={`${step.item.title} — back to ${step.parentTitle}`}
              />
            </div>
          ))}
      </div>
    </nav>
  );
}
