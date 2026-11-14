import { useEffect, useState } from "react";
import { dayKey } from "@/lib/calendar";

export function useToday() {
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const refresh = () => setToday(dayKey(new Date()));
    const tomorrow = new Date(`${today}T00:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const timer = window.setTimeout(refresh, Math.max(0, tomorrow.getTime() - Date.now()));
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [today]);
  return today;
}
