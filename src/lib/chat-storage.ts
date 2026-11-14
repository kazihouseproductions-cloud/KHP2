import type { ChatGroup, ChatMessage, DraftAttachment } from "./chat";

let database: Promise<IDBDatabase> | undefined;

function openDatabase() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("khp-chat", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of ["messages", "groups"]) {
          db.createObjectStore(store, { keyPath: ["owner", "id"] }).createIndex("owner", "owner");
        }
        db.createObjectStore("files");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  }
  return database;
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function write(db: IDBDatabase, stores: string[], change: (tx: IDBTransaction) => void) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Chat save was interrupted."));
    try {
      change(tx);
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

export async function readChat(owner: string) {
  const db = await openDatabase();
  const tx = db.transaction(["messages", "groups"]);
  const [messages, groups] = await Promise.all([
    result<ChatMessage[]>(tx.objectStore("messages").index("owner").getAll(owner)),
    result<ChatGroup[]>(tx.objectStore("groups").index("owner").getAll(owner)),
  ]);
  return { messages, groups };
}

export async function saveGroup(owner: string, group: ChatGroup) {
  const db = await openDatabase();
  await write(db, ["groups"], (tx) => tx.objectStore("groups").add({ ...group, owner }));
}

export async function saveMessage(owner: string, message: ChatMessage, files: DraftAttachment[]) {
  const db = await openDatabase();
  await write(db, ["messages", "files"], (tx) => {
    tx.objectStore("messages").add({ ...message, owner });
    for (const { attachment, blob } of files) {
      tx.objectStore("files").add(blob, [owner, attachment.id]);
    }
  });
}

export async function readChatFile(owner: string, attachmentId: string): Promise<Blob> {
  const db = await openDatabase();
  const blob = await result(
    db.transaction("files").objectStore("files").get([owner, attachmentId]),
  );
  if (!(blob instanceof Blob)) throw new Error("This attachment is unavailable.");
  return blob;
}
