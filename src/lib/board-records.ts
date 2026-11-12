import { isBoardItem } from "@/lib/workspaces";

export const boardItemPrefix = "khp.board.v1.item.";

export function readBoardItem(id: string) {
  const value: unknown = JSON.parse(localStorage.getItem(boardItemPrefix + id) ?? "null");
  if (!isBoardItem(value) || value.id !== id) throw new Error("This pin is no longer available.");
  return value;
}
