import { create } from "zustand";
import { boardItemPrefix, readBoardItem } from "@/lib/board-records";
import { readRecords, watchRecords } from "@/lib/local-records";
import { getAssignableMembers, getPinMemberIds } from "@/lib/members";
import { taskChange, taskPrefix, withTaskHistory } from "@/lib/task-history";
import { isTask } from "@/lib/tasks";
import {
  type BoardItem,
  collectPinIds,
  defaultPinColor,
  getPinAncestry,
  isBoardItem,
  isPinColor,
  isTaskBoard,
  isWorkspaceIconId,
  type WorkspaceIconId,
} from "@/lib/workspaces";
import { useTaskStore } from "@/stores/task-store";

// Adding a child and ending its parent must make the leaf decision under the same lock.
function changeBranch<T>(id: string, change: () => T): Promise<T> {
  return navigator.locks.request(boardItemPrefix + id, change);
}

function assertUnchanged(original: BoardItem, current: BoardItem) {
  if (
    original.title !== current.title ||
    original.icon !== current.icon ||
    original.color !== current.color ||
    original.boardType !== current.boardType ||
    original.parentId !== current.parentId
  )
    throw new Error(
      "This pin changed in another tab. Close and reopen it to use the latest version.",
    );
}

function validatePin(rawTitle: string, icon: WorkspaceIconId, color?: string) {
  const title = rawTitle.trim();
  if (!title || title.length > 60) throw new Error("Enter a title between 1 and 60 characters.");
  if (!isWorkspaceIconId(icon)) throw new Error("Choose a valid pin icon.");
  if (color !== undefined && !isPinColor(color)) throw new Error("Choose a valid pin color.");
  return title;
}

type BoardStore = {
  items: BoardItem[];
  ready: boolean;
  load: () => void;
  add: (
    title: string,
    icon: WorkspaceIconId,
    parentId: string | null,
    color?: string,
  ) => Promise<BoardItem>;
  endBranch: (id: string) => Promise<void>;
  update: (original: BoardItem, title: string, icon: WorkspaceIconId, color?: string) => void;
  addMembers: (id: string, memberIds: string[]) => void;
  remove: (original: BoardItem, confirmation: string) => void;
};

export const useBoardStore = create<BoardStore>((set, get) => {
  function persist(item: BoardItem) {
    try {
      localStorage.setItem(boardItemPrefix + item.id, JSON.stringify(item));
    } catch {
      throw new Error("Your browser could not save this pin. Allow local storage and try again.");
    }
    set((state) => ({
      items: state.items.some((entry) => entry.id === item.id)
        ? state.items.map((entry) => (entry.id === item.id ? item : entry))
        : [...state.items, item],
    }));
  }
  return {
    items: [],
    ready: false,
    load: () => {
      try {
        set({ items: readRecords(boardItemPrefix, isBoardItem), ready: true });
      } catch {
        set({ ready: true });
      }
    },
    async add(rawTitle, icon, parentId, color = defaultPinColor) {
      const title = validatePin(rawTitle, icon, color);
      const item: BoardItem = {
        id: crypto.randomUUID(),
        title,
        icon,
        color,
        parentId,
        createdAt: Date.now(),
        memberIds: [],
        boardType: "sections",
      };
      if (parentId === null) {
        persist(item);
        return item;
      }
      return changeBranch(parentId, () => {
        const parent = readBoardItem(parentId);
        const path = getPinAncestry(parent, readBoardItem);
        if (!path.length || isTaskBoard(parent, path.length))
          throw new Error("This board cannot contain another section.");
        persist(item);
        return item;
      });
    },
    endBranch(id) {
      return changeBranch(id, () => {
        const item = readBoardItem(id);
        const path = getPinAncestry(item, readBoardItem);
        if (!path.length) throw new Error("This section is no longer available.");
        if (isTaskBoard(item, path.length)) return;
        if (readRecords(boardItemPrefix, isBoardItem).some((child) => child.parentId === id))
          throw new Error(
            "This branch already has sections. Open a section at the end of the branch.",
          );
        persist({ ...item, boardType: "tasks" });
      });
    },
    update(original, rawTitle, icon, color = original.color) {
      const title = validatePin(rawTitle, icon, color);
      const current = readBoardItem(original.id);
      assertUnchanged(original, current);
      persist({ ...current, title, icon, color });
    },
    addMembers(id, memberIds) {
      const current = readBoardItem(id);
      const roster = getAssignableMembers(current, readBoardItem);
      if (memberIds.some((id) => !roster.some((member) => member.id === id)))
        throw new Error("Choose members from the available roster.");
      persist({ ...current, memberIds: [...new Set([...getPinMemberIds(current), ...memberIds])] });
    },
    remove(original, confirmation) {
      if (confirmation !== "DELETE") throw new Error("Type DELETE exactly to delete this pin.");
      assertUnchanged(original, readBoardItem(original.id));
      const items = readRecords(boardItemPrefix, isBoardItem);
      const ids = collectPinIds(items, original.id);
      const tasks = readRecords(taskPrefix, isTask).filter((task) => ids.has(task.sectionId));
      const keys = [
        ...items.filter((item) => ids.has(item.id)).map((item) => boardItemPrefix + item.id),
        ...tasks.map((task) => taskPrefix + task.id),
      ];
      const snapshots = keys.map((key) => [key, localStorage.getItem(key)] as const);
      try {
        withTaskHistory(taskChange(tasks, []), () => {
          for (const key of keys) localStorage.removeItem(key);
        });
      } catch {
        try {
          for (const [key, value] of snapshots) {
            if (value !== null) localStorage.setItem(key, value);
          }
        } catch {
          get().load();
          useTaskStore.getState().load();
          throw new Error(
            "Delete was interrupted. Some data could not be restored. Reload the board to review it.",
          );
        }
        throw new Error(
          "Your browser could not delete this pin. No changes were saved. Please try again.",
        );
      }
      set({ items: items.filter((item) => !ids.has(item.id)) });
      useTaskStore.getState().load();
    },
  };
});

export function listenToBoardStorage() {
  return watchRecords(boardItemPrefix, useBoardStore.getState().load);
}
