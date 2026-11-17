export function readRecords<T extends { id: string; createdAt: number }>(
  prefix: string,
  validate: (value: unknown) => value is T,
): T[] {
  const records: T[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      if (validate(value) && key === prefix + value.id) records.push(value);
    } catch {
      // Keep other records available if one stored entry is unreadable.
    }
  }
  return records.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export function watchRecords(prefix: string, reload: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && (event.key === null || event.key.startsWith(prefix)))
      reload();
  };
  window.addEventListener("storage", onStorage);
  reload();
  return () => window.removeEventListener("storage", onStorage);
}
