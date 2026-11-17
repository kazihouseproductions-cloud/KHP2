import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { prepareAttachment, type ChatDraft } from "@/lib/chat";
import { ChatAttachmentView } from "./chat-attachment";
import { VoiceRecorder } from "./voice-recorder";

export type ComposerProps = {
  owner: string;
  draft: ChatDraft;
  sending: boolean;
  onDraft: (change: (draft: ChatDraft) => ChatDraft) => void;
  onSend: () => Promise<void>;
};

export function ChatComposer({
  name,
  owner,
  draft,
  onDraft,
  onSend,
  sending,
}: ComposerProps & { name: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [recording, setRecording] = useState(false);
  const canSend = !recording && !sending && (!!draft.text.trim() || draft.files.length > 0);

  return (
    <form
      className="chat-composer"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canSend) return;
        await onSend();
        editor.current?.focus();
      }}
    >
      {draft.files.length > 0 && (
        <ul className="chat-draft-files">
          {draft.files.map(({ attachment, blob }) => (
            <li key={attachment.id} className="flex items-center justify-between gap-2">
              <ChatAttachmentView owner={owner} attachment={attachment} draftBlob={blob} />
              <button
                type="button"
                disabled={sending}
                aria-label={`Remove ${attachment.name}`}
                className="chat-control"
                onClick={() =>
                  onDraft((current) => ({
                    ...current,
                    files: current.files.filter((f) => f.attachment.id !== attachment.id),
                  }))
                }
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        aria-label="Choose files"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [], (file) => prepareAttachment(file));
          onDraft((current) => ({ ...current, files: [...current.files, ...files] }));
          e.target.value = "";
        }}
      />
      {!recording && (
        <button
          type="button"
          title="Attach files"
          aria-label="Attach files"
          className="chat-control"
          disabled={sending}
          onClick={() => picker.current?.click()}
        >
          <Icon name="attachment" size={19} />
        </button>
      )}
      <VoiceRecorder
        disabled={sending}
        onBusy={setRecording}
        onRecord={(file) => {
          const audio = prepareAttachment(file, "voice");
          onDraft((current) => ({ ...current, files: [...current.files, audio] }));
        }}
      />
      {!recording && (
        <>
          <textarea
            ref={editor}
            rows={1}
            disabled={sending}
            aria-label={`Message to ${name}`}
            placeholder="Write a message…"
            value={draft.text}
            onChange={(event) => {
              const text = event.target.value;
              onDraft((current) => ({ ...current, text }));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            aria-label="Send message"
            title="Send message"
            disabled={!canSend}
            className="chat-send"
          >
            <Icon name="send" size={18} />
          </button>
        </>
      )}
    </form>
  );
}
