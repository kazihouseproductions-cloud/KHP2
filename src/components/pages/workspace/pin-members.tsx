import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/modal";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { useMemberDirectory } from "@/stores/member-store";
import { getPinMemberIds } from "@/lib/members";
import type { BoardItem } from "@/lib/workspaces";
import { useBoardStore } from "@/stores/board-store";

export function PinMembers({
  item,
  onAdd,
  onClose,
}: {
  item: BoardItem;
  onAdd: () => void;
  onClose: () => void;
}) {
  const directory = useMemberDirectory();
  const [search, setSearch] = useState("");
  const assigned = directory.filter((member) => getPinMemberIds(item).includes(member.id));
  const visible = assigned.filter((member) =>
    `${member.name} ${member.role} ${member.jobTitle ?? ""}`.toLowerCase().includes(search.toLowerCase().trim()),
  );
  return (
    <>
      <header className="pin-panel-heading">
        <div>
          <h2>
            Members <span className="member-count">{assigned.length}</span>
          </h2>
          <p>{item.title}</p>
        </div>
        <button type="button" className="icon-action" aria-label="Close members" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <input
        className="member-search"
        aria-label="Search assigned members"
        placeholder="Search members…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <ul className="member-list">
        {visible.map((member) => (
          <li key={member.id} className="member-row">
            <MemberAvatar member={member} />
            <span>
              <strong>{member.name}</strong>
              <small>{member.jobTitle ?? member.role}</small>
            </span>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p className="member-empty">
          {assigned.length ? "No matching members." : "No members assigned yet."}
        </p>
      )}
      <footer className="member-panel-footer">
        <button type="button" onClick={onAdd}>
          <Icon name="plus" size={15} /> Add Member
        </button>
      </footer>
    </>
  );
}

export function AddPinMembers({
  item,
  onClose,
  afterCreate = false,
}: {
  item: BoardItem;
  onClose: () => void;
  afterCreate?: boolean;
}) {
  const directory = useMemberDirectory();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const addMembers = useBoardStore((state) => state.addMembers);
  const items = useBoardStore((state) => state.items);
  const current = items.find((entry) => entry.id === item.id) ?? item;
  const assigned = getPinMemberIds(current);
  const pending = selected.filter((id) => !assigned.includes(id));
  const visible = directory.filter((member) =>
    `${member.name} ${member.role} ${member.jobTitle ?? ""}`.toLowerCase().includes(search.toLowerCase().trim()),
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!pending.length || saving) return;
    setSaving(true);
    try {
      await addMembers(item.id, pending);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add members.");
      setSaving(false);
    }
  }
  return (
    <Modal
      title={afterCreate ? "Add members" : "Add Member"}
      onClose={onClose}
      className="workspace-dialog"
    >
      <form onSubmit={submit}>
        <p className="mb-4 break-words text-sm text-neutral-600">
          Choose members for <strong>{current.title}</strong>.
          {current.parentId !== null &&
            " They will also appear in each parent section and the workspace."}
        </p>
        <input
          className="member-search"
          aria-label="Search members"
          placeholder="Search by name or role…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <fieldset className="member-picker">
          <legend className="sr-only">Select members</legend>
          {visible.map((member) => {
            const alreadyAssigned = assigned.includes(member.id);
            return (
              <label key={member.id} className="member-choice">
                <input
                  type="checkbox"
                  checked={alreadyAssigned || selected.includes(member.id)}
                  disabled={alreadyAssigned}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setSelected((ids) =>
                      checked ? [...ids, member.id] : ids.filter((id) => id !== member.id),
                    );
                  }}
                />
                <MemberAvatar member={member} />
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.jobTitle ?? member.role}</small>
                </span>
                {alreadyAssigned && <span className="member-assigned">Added</span>}
              </label>
            );
          })}
          {!visible.length && <p className="member-empty">No matching members.</p>}
        </fieldset>
        {error && (
          <p role="alert" className="my-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <footer className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <span className="text-xs text-neutral-500">{pending.length} selected</span>
          <div className="flex gap-2">
            <button type="button" className="secondary-button" onClick={onClose}>
              {afterCreate ? "Skip" : "Cancel"}
            </button>
            <button type="submit" className="primary-button" disabled={!pending.length || saving}>
              Add members
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
