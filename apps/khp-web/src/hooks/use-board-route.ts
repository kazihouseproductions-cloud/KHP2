import { useSyncExternalStore } from "react";
import { parseBoardRoute } from "@/lib/board-route";

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
  return parseBoardRoute(hash);
}
