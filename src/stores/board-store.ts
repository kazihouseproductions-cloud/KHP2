import { create } from "zustand";
import { readRecords, watchRecords } from "@/lib/local-records";
import { type BoardItem, isBoardItem, type WorkspaceIconId } from "@/lib/workspaces";

const prefix = "khp.board.v1.item.";

type BoardStore = {
  items: BoardItem[];
  ready: boolean;
  load: () => void;
  add: (title: string, icon: WorkspaceIconId, parentId: string | null) => void;
};

export const useBoardStore = create<BoardStore>((set) => ({
  items: [],
  ready: false,
  load: () => {
    try {
      set({ items: readRecords(prefix, isBoardItem), ready: true });
    } catch {
      set({ ready: true });
    }
  },
  add: (rawTitle, icon, parentId) => {
    const title = rawTitle.trim();
    if (!title || title.length > 60) throw new Error("Enter a title between 1 and 60 characters.");
    const item: BoardItem = {
      id: crypto.randomUUID(),
      title,
      icon,
      parentId,
      createdAt: Date.now(),
    };
    try {
      // Each new pin gets its own key so concurrent tabs cannot overwrite other pins.
      localStorage.setItem(prefix + item.id, JSON.stringify(item));
    } catch {
      throw new Error("Your browser could not save this pin. Allow local storage and try again.");
    }
    set((state) => ({ items: [...state.items, item] }));
  },
}));

export function listenToBoardStorage() {
  return watchRecords(prefix, useBoardStore.getState().load);
}
