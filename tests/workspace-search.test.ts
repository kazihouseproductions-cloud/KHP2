import assert from "node:assert/strict";
import { test } from "node:test";
import { previewMember } from "../src/lib/members.ts";
import { matchSuggestions, workspaceSuggestions } from "../src/lib/workspace-search.ts";
import { indexBoardItems, type BoardItem } from "../src/lib/workspaces.ts";

test("search keeps same-name sections and members distinct and skips unreachable nodes", () => {
  function node(id: string, title: string, parentId: string | null): BoardItem {
    return { id, title, parentId, icon: "office", createdAt: 1 };
  }
  const { byId } = indexBoardItems([
    node("studio", "Studio", null),
    node("school", "School", null),
    node("studio-art", "Art", "studio"),
    node("school-art", "Art", "school"),
    node("earth", "Earth", null),
    node("orphan", "Art", "missing"),
    node("cycle", "Art", "cycle"),
  ]);
  const suggestions = workspaceSuggestions(byId, [{ ...previewMember, name: "Art" }]);
  const matches = matchSuggestions(suggestions, "  ArT ");
  assert.deepEqual(
    matches.map((match) => match.detail),
    ["Member · Project Manager", "Section · School", "Section · Studio", "Workspace"],
  );
  assert.deepEqual(
    matches.filter((match) => match.kind === "node").map((match) => match.item.id),
    ["school-art", "studio-art", "earth"],
  );
});
