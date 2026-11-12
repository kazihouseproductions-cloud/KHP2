import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { memberTasksHref } from "@/lib/board-route";
import { demoMembers, type DemoMember } from "@/lib/members";
import { useBoardViewStore } from "@/stores/board-view-store";

export function BoardMemberFilter({ boardHref }: { boardHref: string }) {
  const memberId = useBoardViewStore((state) => state.memberId);
  const selectMember = useBoardViewStore((state) => state.selectMember);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLElement>(null);
  const panelId = useId();
  const selected = demoMembers.find((member) => member.id === memberId);
  const visible = demoMembers.filter((member) =>
    member.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        mobileTrigger.current?.focus();
      }
    };
    const navigate = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("hashchange", navigate);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("hashchange", navigate);
    };
  }, [open]);

  function choose(id: DemoMember["id"]) {
    selectMember(id === memberId ? null : id);
  }

  return (
    <aside
      ref={container}
      className="board-member-filter"
      aria-label="Board member filter"
      data-open={open || undefined}
    >
      <button
        ref={mobileTrigger}
        type="button"
        className="member-filter-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="people" size={18} />
        <span>{selected?.name ?? "Filter by member"}</span>
        <Icon name="arrowDown" size={14} />
      </button>
      <div id={panelId} className="member-filter-content">
        <div className="member-filter-card">
          <h2 className="member-filter-heading">Search Tasks by Member</h2>
          <input
            className="member-filter-search"
            type="search"
            aria-label="Search board members"
            placeholder="e.g. John Doe"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="member-filter-divider" />
          <fieldset className="member-filter-list" aria-label="Filter pins by member">
            {visible.map((member) => (
              <button
                key={member.id}
                type="button"
                className="member-filter-row"
                aria-pressed={memberId === member.id}
                title={memberId === member.id ? `Deselect ${member.name}` : undefined}
                onClick={() => choose(member.id)}
              >
                <MemberAvatar member={member} />
                <span>{member.name}</span>
                {memberId === member.id && <Icon name="close" size={16} />}
              </button>
            ))}
            {!visible.length && <p className="member-filter-empty">No matching members.</p>}
          </fieldset>
        </div>
        {selected && (
          <a className="member-tasks-button" href={memberTasksHref(boardHref, selected.id)}>
            See All Tasks by {selected.name}
          </a>
        )}
      </div>
      <p role="status" className="sr-only">
        {selected ? `Pins not assigned to ${selected.name} are grayed out.` : "Showing all pins."}
      </p>
    </aside>
  );
}
