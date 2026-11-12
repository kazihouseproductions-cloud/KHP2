import { create } from "zustand";
import { readRecords, watchRecords } from "@/lib/local-records";
import { defaultMemberIds, demoMembers, getPinMemberIds } from "@/lib/members";
import { isTask } from "@/lib/tasks";
import {
  type BoardItem,
  collectPinIds,
  isBoardItem,
  pinIcons,
  type WorkspaceIconId,
} from "@/lib/workspaces";
import { useTaskStore } from "@/stores/task-store";

const prefix = "khp.board.v1.item.";
const taskPrefix = "khp.board.v1.task.";

function readItem(id: string) {
  const value: unknown = JSON.parse(localStorage.getItem(prefix + id) ?? "null");
  if (!isBoardItem(value) || value.id !== id) throw new Error("This pin is no longer available.");
  return value;
}

function assertUnchanged(original: BoardItem, current: BoardItem) {
  if (
    original.title !== current.title ||
    original.icon !== current.icon ||
    original.parentId !== current.parentId
  )
    throw new Error(
      "This pin changed in another tab. Close and reopen it to use the latest version.",
    );
}

function validatedTitle(rawTitle: string, icon: WorkspaceIconId) {
  const title = rawTitle.trim();
  if (!title || title.length > 60) throw new Error("Enter a title between 1 and 60 characters.");
  if (!pinIcons.some((option) => option.id === icon)) throw new Error("Choose a valid pin icon.");
  return title;
}

type BoardStore = {
  items: BoardItem[];
  ready: boolean;
  load: () => void;
  add: (title: string, icon: WorkspaceIconId, parentId: string | null) => void;
  update: (original: BoardItem, title: string, icon: WorkspaceIconId) => void;
  addMembers: (id: string, memberIds: string[]) => void;
  remove: (original: BoardItem, confirmation: string) => void;
};

export const useBoardStore = create<BoardStore>((set, get) => {
  function persist(item: BoardItem) {
    try {
      localStorage.setItem(prefix + item.id, JSON.stringify(item));
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
        set({ items: readRecords(prefix, isBoardItem), ready: true });
      } catch {
        set({ ready: true });
      }
    },
    add: (rawTitle, icon, parentId) => {
      const title = validatedTitle(rawTitle, icon);
      const item: BoardItem = {
        id: crypto.randomUUID(),
        title,
        icon,
        parentId,
        createdAt: Date.now(),
        memberIds: [...defaultMemberIds],
      };
      persist(item);
    },
    update(original, rawTitle, icon) {
      const title = validatedTitle(rawTitle, icon);
      const current = readItem(original.id);
      assertUnchanged(original, current);
      persist({ ...current, title, icon });
    },
    addMembers(id, memberIds) {
      if (memberIds.some((memberId) => !demoMembers.some((member) => member.id === memberId)))
        throw new Error("Choose members from the sample roster.");
      const current = readItem(id);
      persist({ ...current, memberIds: [...new Set([...getPinMemberIds(current), ...memberIds])] });
    },
    remove(original, confirmation) {
      if (confirmation !== "DELETE") throw new Error("Type DELETE exactly to delete this pin.");
      assertUnchanged(original, readItem(original.id));
      const items = readRecords(prefix, isBoardItem);
      const ids = collectPinIds(items, original.id);
      const tasks = readRecords(taskPrefix, isTask).filter((task) => ids.has(task.sectionId));
      const keys = [
        ...items.filter((item) => ids.has(item.id)).map((item) => prefix + item.id),
        ...tasks.map((task) => taskPrefix + task.id),
      ];
      const snapshots = keys.map((key) => [key, localStorage.getItem(key)] as const);
      try {
        for (const key of keys) localStorage.removeItem(key);
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
  return watchRecords(prefix, useBoardStore.getState().load);
}
