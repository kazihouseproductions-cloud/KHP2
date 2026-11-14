import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { ChatAttachment } from "@/lib/chat";
import { readChatFile } from "@/lib/chat-storage";

export function ChatAttachmentView({
  owner,
  attachment,
  draftBlob,
}: {
  owner: string;
  attachment: ChatAttachment;
  draftBlob?: Blob;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const voice = attachment.kind === "voice";
  useEffect(() => {
    if (!voice) return;
    let active = true;
    let source = "";
    async function loadAudio() {
      try {
        const blob = draftBlob ?? (await readChatFile(owner, attachment.id));
        if (active) {
          source = URL.createObjectURL(blob);
          setUrl(source);
        }
      } catch {
        if (active) setError("This voice message could not be loaded.");
      }
    }
    void loadAudio();
    return () => {
      active = false;
      if (source) URL.revokeObjectURL(source);
    };
  }, [owner, attachment.id, draftBlob, voice]);

  async function download() {
    try {
      const blob = await readChatFile(owner, attachment.id);
      const href = URL.createObjectURL(blob.slice(0, blob.size, "application/octet-stream"));
      const link = document.createElement("a");
      link.href = href;
      link.download = attachment.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 30000);
      setError("");
    } catch {
      setError("This file could not be downloaded.");
    }
  }

  return (
    <div className="min-w-0 max-w-full">
      {voice ? (
        <div className="py-1">
          <span className="block text-xs font-medium">Voice message</span>
          {/* biome-ignore lint/a11y/useMediaCaption: User-recorded voice messages have no caption file. */}
          <audio
            aria-label="Voice message"
            controls
            src={url || undefined}
            preload="metadata"
            className="mt-1 h-9 w-56 max-w-full"
          />
        </div>
      ) : draftBlob ? (
        <span className="block truncate text-sm" title={attachment.name}>
          {attachment.name}
        </span>
      ) : (
        <button
          className="chat-download"
          type="button"
          aria-label={`Download ${attachment.name}`}
          onClick={download}
        >
          <Icon name="attachment" size={16} />
          <span className="min-w-0 break-all">{attachment.name}</span>
          <Icon name="download" size={16} />
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
