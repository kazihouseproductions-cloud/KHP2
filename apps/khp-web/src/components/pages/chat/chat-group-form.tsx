import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import type { Member } from "@/lib/members";

export function ChatGroupForm({
  members,
  error,
  onBack,
  onCreate,
}: {
  members: readonly Member[];
  error: string;
  onBack: () => void;
  onCreate: (name: string, ids: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !name.trim() || !ids.length) return;
        setBusy(true);
        try {
          await onCreate(name, ids);
        } finally {
          setBusy(false);
        }
      }}
    >
      <header className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          disabled={busy}
          className="chat-control"
          aria-label="Back to chats"
          onClick={onBack}
        >
          <Icon name="back" size={18} />
        </button>
        <h2 className="text-lg font-semibold">New group</h2>
      </header>
      <label className="mx-4 mb-3 grid gap-1 text-sm font-medium">
        Group name
        <input
          ref={input}
          className="rounded-lg border border-neutral-200 px-3 py-2"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p className="px-4 text-xs font-semibold text-neutral-600">Add members</p>
      <fieldset aria-label="Add members" className="chat-thread-list">
        {members.map((member) => (
          <label key={member.id} className="chat-row cursor-pointer">
            <MemberAvatar member={member} />
            <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
            <input
              type="checkbox"
              checked={ids.includes(member.id)}
              onChange={(e) =>
                setIds(
                  e.target.checked ? [...ids, member.id] : ids.filter((id) => id !== member.id),
                )
              }
            />
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="px-4 py-1 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="border-t border-neutral-100 p-3">
        <button
          type="submit"
          disabled={busy || !name.trim() || !ids.length}
          className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          Create group
        </button>
      </div>
    </form>
  );
}
