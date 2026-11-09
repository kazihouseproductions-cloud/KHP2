import { useSyncExternalStore } from "react";
import { boardLevels } from "@/lib/workspaces";

function subscribe(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

export function useBoardRoute() {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  const parts = hash.slice(1).split("/").filter(Boolean);
  if (parts[0] === "tool") return { section: parts[1], ids: [], invalid: parts.length !== 2 };
  const ids: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i] !== boardLevels[i / 2]?.segment || !parts[i + 1]) return { ids, invalid: true };
    ids.push(parts[i + 1]);
  }
  return { ids, invalid: false };
}
