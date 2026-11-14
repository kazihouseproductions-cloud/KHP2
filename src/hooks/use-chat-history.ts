import { useCallback, useEffect, useRef, useState } from "react";
import {
  initiallyUnread,
  isChatMessage,
  sampleMessages,
  type ChatMessage,
  type ChatDraft,
  type ChatGroup,
} from "@/lib/chat";
import { readChat, saveGroup, saveMessage } from "@/lib/chat-storage";
import { readRecords, watchRecords } from "@/lib/local-records";

export function useChatHistory(ownerId: string) {
  const prefix = `khp.chat.v1.${encodeURIComponent(ownerId)}.`;
  const [messages, setMessages] = useState(sampleMessages);
  const [stored, setStored] = useState<{ messages: ChatMessage[]; groups: ChatGroup[] }>({
    messages: [],
    groups: [],
  });
  const channel = useRef<BroadcastChannel | null>(null);
  const revision = useRef(0);
  const [unread, setUnread] = useState(initiallyUnread);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    try {
      setMessages([...sampleMessages, ...readRecords(`${prefix}message.`, isChatMessage)]);
      setUnread(initiallyUnread.filter((id) => !localStorage.getItem(`${prefix}read.${id}`)));
      setError("");
    } catch {
      setError("Saved chats could not be loaded from this browser.");
    }
  }, [prefix]);

  useEffect(() => watchRecords(prefix, reload), [prefix, reload]);

  const loadStored = useCallback(async () => {
    const version = ++revision.current;
    try {
      const snapshot = await readChat(ownerId);
      if (version === revision.current) setStored(snapshot);
    } catch {
      if (version === revision.current)
        setError("Groups and attachments could not be loaded from this browser.");
    }
  }, [ownerId]);

  useEffect(() => {
    void loadStored();
    const updates = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(prefix);
    channel.current = updates;
    if (updates) updates.onmessage = loadStored;
    return () => {
      revision.current++;
      updates?.close();
      channel.current = null;
    };
  }, [loadStored, prefix]);

  async function createGroup(name: string, selected: string[]) {
    const memberIds = [...new Set([ownerId, ...selected])];
    if (!name.trim() || memberIds.length < 2) return;
    const group: ChatGroup = {
      id: `group:${crypto.randomUUID()}`,
      name: name.trim(),
      memberIds,
      createdAt: Date.now(),
    };
    try {
      await saveGroup(ownerId, group);
      await loadStored();
      channel.current?.postMessage("update");
      setError("");
      return group.id;
    } catch {
      setError("Your group could not be saved. Please try again.");
    }
  }

  function markRead(contactId: string) {
    if (!unread.includes(contactId)) return;
    setUnread((current) => current.filter((id) => id !== contactId));
    try {
      localStorage.setItem(`${prefix}read.${contactId}`, "1");
    } catch {
      setError("Read status could not be saved in this browser.");
    }
  }

  async function send(contactId: string, draft: ChatDraft) {
    const body = draft.text.trim();
    if (!body && !draft.files.length) return false;
    try {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        contactId,
        outgoing: true,
        body,
        createdAt: Date.now(),
      };
      if (draft.files.length) {
        message.attachments = draft.files.map((file) => file.attachment);
        await saveMessage(ownerId, message, draft.files);
        await loadStored();
        channel.current?.postMessage("update");
      } else {
        localStorage.setItem(`${prefix}message.${message.id}`, JSON.stringify(message));
        reload();
      }
      setError("");
      return true;
    } catch {
      setError("Your message could not be saved. Please try again.");
      return false;
    }
  }

  return { messages, stored, unread, error, markRead, send, createGroup };
}
