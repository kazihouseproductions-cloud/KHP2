import type { ReactNode } from "react";
import { ScrollArea } from "@/components/common/scroll-area";
import { useBoardScroll } from "@/hooks/use-board-scroll";

export function BoardSurface({ boardId, children }: { boardId: string; children: ReactNode }) {
  const { viewport, plane } = useBoardScroll(boardId);
  return (
    <ScrollArea ref={viewport} className="board-viewport" label="Workspace board">
      <div className="board-track">
        <div ref={plane} className="board-plane">
          {children}
        </div>
      </div>
    </ScrollArea>
  );
}
