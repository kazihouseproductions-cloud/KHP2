import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/modal";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { demoMembers, getPinMemberIds } from "@/lib/members";
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
  const [search, setSearch] = useState("");
  const assigned = demoMembers.filter((member) => getPinMemberIds(item).includes(member.id));
  const visible = assigned.filter((member) =>
    `${member.name} ${member.role}`.toLowerCase().includes(search.toLowerCase().trim()),
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
              <small>{member.role}</small>
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
        <span>Sample members</span>
        <button type="button" onClick={onAdd}>
          <Icon name="plus" size={15} /> Add Member
        </button>
      </footer>
    </>
  );
}

export function AddPinMembers({ item, onClose }: { item: BoardItem; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const addMembers = useBoardStore((state) => state.addMembers);
  const current =
    useBoardStore((state) => state.items.find((entry) => entry.id === item.id)) ?? item;
  const assigned = getPinMemberIds(current);
  const visible = demoMembers.filter((member) =>
    `${member.name} ${member.role}`.toLowerCase().includes(search.toLowerCase().trim()),
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected.length) return;
    try {
      addMembers(item.id, selected);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add members.");
    }
  }
  return (
    <Modal title="Add Member" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-4 text-sm text-neutral-600">
          Assign sample members to <strong className="text-neutral-900">{current.title}</strong>.
        </p>
        <input
          className="member-search"
          aria-label="Search sample members"
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
                  onChange={(event) =>
                    setSelected((ids) =>
                      event.target.checked
                        ? [...ids, member.id]
                        : ids.filter((id) => id !== member.id),
                    )
                  }
                />
                <MemberAvatar member={member} />
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
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
          <span className="text-xs text-neutral-500">{selected.length} selected</span>
          <div className="flex gap-2">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={!selected.length}>
              Add members
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
