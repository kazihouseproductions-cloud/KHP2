import { useCallback, useEffect, useState } from "react";
import { initiallyUnread, isChatMessage, sampleMessages, type ChatMessage } from "@/lib/chat";
import { readRecords, watchRecords } from "@/lib/local-records";

export function useChatHistory(ownerId: string) {
  const prefix = `khp.chat.v1.${encodeURIComponent(ownerId)}.`;
  const [messages, setMessages] = useState(sampleMessages);
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

  function markRead(contactId: string) {
    if (!unread.includes(contactId)) return;
    setUnread((current) => current.filter((id) => id !== contactId));
    try {
      localStorage.setItem(`${prefix}read.${contactId}`, "1");
    } catch {
      setError("Read status could not be saved in this browser.");
    }
  }

  function send(contactId: string, text: string) {
    const body = text.trim();
    if (!body) return false;
    try {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        contactId,
        outgoing: true,
        body,
        createdAt: Date.now(),
      };
      localStorage.setItem(`${prefix}message.${message.id}`, JSON.stringify(message));
      setMessages((previous) => [...previous, message]);
      setError("");
      return true;
    } catch {
      setError("Your message could not be saved. Please try again.");
      return false;
    }
  }

  return { messages, unread, error, markRead, send };
}
