import type { Member } from "./members";
import { getPinAncestry, type BoardItem } from "./workspaces";

export type SearchSuggestion =
  | { kind: "node"; item: BoardItem; name: string; detail: string }
  | { kind: "member"; member: Member; name: string; detail: string };

export function workspaceSuggestions(
  byId: ReadonlyMap<string, BoardItem>,
  members: readonly Member[],
) {
  const suggestions: SearchSuggestion[] = [];
  for (const item of byId.values()) {
    const path = getPinAncestry(item, (id) => byId.get(id));
    if (!path.length) continue;
    const parentPath = path
      .slice(0, -1)
      .map((parent) => parent.title)
      .join(" / ");
    suggestions.push({
      kind: "node",
      item,
      name: item.title,
      detail: parentPath ? `Section · ${parentPath}` : "Workspace",
    });
  }
  for (const member of members) {
    suggestions.push({
      kind: "member",
      member,
      name: member.name,
      detail: member.jobTitle ? `Member · ${member.jobTitle}` : "Member",
    });
  }
  return suggestions.sort(
    (a, b) => a.name.localeCompare(b.name) || a.detail.localeCompare(b.detail),
  );
}

export function matchSuggestions(suggestions: SearchSuggestion[], input: string) {
  const query = input.trim().toLowerCase();
  if (!query) return suggestions;
  const prefixes: SearchSuggestion[] = [];
  const others: SearchSuggestion[] = [];
  for (const suggestion of suggestions) {
    const name = suggestion.name.toLowerCase();
    if (name.startsWith(query)) prefixes.push(suggestion);
    else if (name.includes(query)) others.push(suggestion);
  }
  return prefixes.concat(others);
}
