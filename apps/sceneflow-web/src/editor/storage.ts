import type { Project } from "./types";

export type Checkpoint = {
  id: string;
  reason: string;
  created: number;
  project: Project;
};
export type Saved = {
  revision: number;
  project: Project;
  checkpoints: Checkpoint[];
};
let opening: Promise<IDBDatabase> | undefined;
const urls = new Map<string, Promise<string>>();

function database() {
  if (!opening)
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sceneflow-workspace", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("project");
        request.result.createObjectStore("media");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = undefined;
        };
        resolve(db);
      };
      request.onerror = () => {
        opening = undefined;
        reject(request.error);
      };
    });
  return opening;
}
export async function loadWorkspace(): Promise<Saved | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("project")
      .objectStore("project")
      .get("workspace");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveWorkspace(
  state: Saved,
  expected: number,
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("project", "readwrite"),
      table = tx.objectStore("project");
    const req = table.get("workspace");
    let conflict = false;
    req.onsuccess = () => {
      if ((req.result?.revision ?? 0) !== expected) {
        conflict = true;
        tx.abort();
        return;
      }
      table.put(state, "workspace");
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        conflict
          ? new Error(
              "Another tab saved a change. Reload this tab to open that revision.",
            )
          : (tx.error ?? new Error("Local save failed.")),
      );
  });
}
export async function saveMediaBatch(blobs: Blob[]): Promise<string[]> {
  const db = await database();
  const ids = blobs.map(() => crypto.randomUUID());
  return new Promise((resolve, reject) => {
    const tx = db.transaction("media", "readwrite");
    blobs.forEach((blob, i) => {
      tx.objectStore("media").add(blob, ids[i]);
    });
    tx.oncomplete = () => resolve(ids);
    tx.onabort = () =>
      reject(
        tx.error ?? new Error("Could not store the media in this browser."),
      );
  });
}
export async function saveMedia(blob: Blob) {
  return (await saveMediaBatch([blob]))[0];
}
export async function discardMediaBatch(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("media", "readwrite");
    for (const id of ids) tx.objectStore("media").delete(id);
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("Could not discard the incomplete import."));
  });
  for (const id of ids) {
    const url = urls.get(id);
    urls.delete(id);
    if (url) URL.revokeObjectURL(await url);
  }
}
export async function mediaUrl(id: string): Promise<string> {
  const cached = urls.get(id);
  if (cached) return cached;
  const pending = database().then(
    (db) =>
      new Promise<string>((resolve, reject) => {
        const req = db.transaction("media").objectStore("media").get(id);
        req.onsuccess = () =>
          req.result instanceof Blob
            ? resolve(URL.createObjectURL(req.result))
            : reject(new Error("Media is missing from this browser."));
        req.onerror = () => reject(req.error);
      }),
  );
  urls.set(id, pending);
  try {
    return await pending;
  } catch (error) {
    urls.delete(id);
    throw error;
  }
}
