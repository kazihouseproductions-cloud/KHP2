import { isBoardItem } from "@/lib/workspaces";
import { withInheritedMembers } from "@/lib/members";
import { readRecords } from "@/lib/local-records";

export const boardItemPrefix = "khp.board.v1.item.";

export function readBoardItems() {
  return withInheritedMembers(readRecords(boardItemPrefix, isBoardItem));
}

export function readBoardItem(id: string) {
  const value: unknown = JSON.parse(localStorage.getItem(boardItemPrefix + id) ?? "null");
  if (!isBoardItem(value) || value.id !== id) throw new Error("This pin is no longer available.");
  return value;
}
