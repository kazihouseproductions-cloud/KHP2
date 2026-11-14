import { useCallback, useEffect, useState } from "react";
import { watchRecords } from "@/lib/local-records";
import { notifications } from "@/lib/notifications";

const initiallyUnread = notifications.filter((item) => !item.initiallyRead).map((item) => item.id);

export function useNotifications(memberId: string) {
  const prefix = `khp.notifications.v1.${encodeURIComponent(memberId)}.read.`;
  const [unreadIds, setUnreadIds] = useState(initiallyUnread);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    try {
      setUnreadIds(initiallyUnread.filter((id) => localStorage.getItem(prefix + id) !== "1"));
      setError("");
    } catch {
      setError("Your saved read status could not be loaded.");
    }
  }, [prefix]);

  useEffect(() => watchRecords(prefix, reload), [prefix, reload]);

  function markRead(ids: readonly string[]) {
    try {
      for (const id of ids) localStorage.setItem(prefix + id, "1");
      reload();
    } catch {
      reload();
      setError("Your read status could not be saved. Please try again.");
    }
  }

  return { unreadIds, markRead, error };
}
