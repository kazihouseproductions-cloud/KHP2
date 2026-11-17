import {
  type BoardAction,
  type BoardHistory,
  createHistory,
  historyReducer,
} from "./board-model.ts";

export interface BoardDocument {
  id: string;
  title: string;
  history: BoardHistory;
  createdAt: number;
  updatedAt: number;
  sharedWithMe: boolean;
}
export interface BoardLibraryState {
  boards: BoardDocument[];
  activeId: string | null;
}
export type LibraryAction =
  | { type: "create"; id: string; now: number }
  | { type: "open"; id: string }
  | { type: "close" }
  | { type: "rename"; id: string; title: string; now: number }
  | { type: "edit"; id: string; action: BoardAction; now: number };

export function createLibrary(): BoardLibraryState {
  const now = Date.now();
  return {
    activeId: null,
    boards: [
      {
        id: "board-welcome",
        title: "Untitled board",
        history: createHistory(),
        createdAt: now,
        updatedAt: now,
        sharedWithMe: false,
      },
    ],
  };
}

export function libraryReducer(state: BoardLibraryState, action: LibraryAction): BoardLibraryState {
  if (action.type === "close") return { ...state, activeId: null };
  if (action.type === "open")
    return state.boards.some((board) => board.id === action.id)
      ? { ...state, activeId: action.id }
      : state;
  if (action.type === "create") {
    if (state.boards.some((board) => board.id === action.id)) return state;
    return {
      activeId: action.id,
      boards: [
        ...state.boards,
        {
          id: action.id,
          title: "Untitled board",
          history: { past: [], present: { items: [], connections: [] }, future: [] },
          createdAt: action.now,
          updatedAt: action.now,
          sharedWithMe: false,
        },
      ],
    };
  }
  const document = state.boards.find((board) => board.id === action.id);
  if (!document) return state;
  if (action.type === "rename") {
    const title = action.title.trim() || "Untitled board";
    if (title === document.title) return state;
    return {
      ...state,
      boards: state.boards.map((board) =>
        board.id === action.id ? { ...board, title, updatedAt: action.now } : board,
      ),
    };
  }
  const history = historyReducer(document.history, action.action);
  return history === document.history
    ? state
    : {
        ...state,
        boards: state.boards.map((board) =>
          board.id === action.id ? { ...board, history, updatedAt: action.now } : board,
        ),
      };
}

export function boardsInSection(
  boards: BoardDocument[],
  section: "mine" | "shared",
): BoardDocument[] {
  return boards.filter((board) =>
    section === "shared" ? board.sharedWithMe : !board.sharedWithMe,
  );
}

export function libraryImageSources(boards: BoardDocument[]): Set<string> {
  const sources = new Set<string>();
  for (const board of boards) {
    const { past, present, future } = board.history;
    for (const snapshot of [...past, present, ...future]) {
      for (const item of snapshot.items) {
        if (item.image) sources.add(item.image.src);
      }
    }
  }
  return sources;
}
