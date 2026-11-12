import { useEffect, useId, useRef, useState } from "react";
import { Modal } from "@/components/common/modal";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { demoMembers, type DemoMember, findMemberTasks } from "@/lib/members";
import { boardItemHref } from "@/lib/workspaces";
import { useBoardStore } from "@/stores/board-store";
import { useBoardViewStore } from "@/stores/board-view-store";
import { listenToTaskStorage, useTaskStore } from "@/stores/task-store";

export function BoardMemberFilter() {
  const memberId = useBoardViewStore((state) => state.memberId);
  const selectMember = useBoardViewStore((state) => state.selectMember);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [taskMember, setTaskMember] = useState<DemoMember | null>(null);
  const tasksButton = useRef<HTMLButtonElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLElement>(null);
  const panelId = useId();
  const selected = demoMembers.find((member) => member.id === memberId);
  const visible = demoMembers.filter((member) =>
    member.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  useEffect(listenToTaskStorage, []);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !taskMember) {
        setOpen(false);
        mobileTrigger.current?.focus();
      }
    };
    const navigate = () => {
      setOpen(false);
      if (taskMember) {
        setTaskMember(null);
        requestAnimationFrame(() => document.getElementById("board-main")?.focus());
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("hashchange", navigate);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("hashchange", navigate);
    };
  }, [open, taskMember]);

  function choose(id: DemoMember["id"]) {
    selectMember(id === memberId ? null : id);
    setOpen(false);
    if (window.matchMedia("(max-width: 1100px)").matches) mobileTrigger.current?.focus();
  }

  function closeTasks() {
    setTaskMember(null);
    const compact = window.matchMedia("(max-width: 1100px)").matches;
    if (compact) setOpen(false);
    requestAnimationFrame(() => {
      if (compact) mobileTrigger.current?.focus();
      else tasksButton.current?.focus();
    });
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
          <header className="member-filter-heading">
            <h2>Search Tasks by Member</h2>
            {selected && (
              <button
                type="button"
                aria-label="Clear member filter"
                title="Show all pins"
                onClick={() => {
                  selectMember(null);
                  searchInput.current?.focus();
                }}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </header>
          <input
            ref={searchInput}
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
                onClick={() => choose(member.id)}
              >
                <MemberAvatar member={member} />
                <span>{member.name}</span>
                {memberId === member.id && <Icon name="check" size={16} />}
              </button>
            ))}
            {!visible.length && <p className="member-filter-empty">No matching members.</p>}
          </fieldset>
        </div>
        <button
          ref={tasksButton}
          type="button"
          className="member-tasks-button"
          disabled={!selected}
          onClick={() => {
            if (selected) setTaskMember(selected);
          }}
        >
          {selected ? `See All Tasks by ${selected.name}` : "Select a member to see tasks"}
        </button>
      </div>
      <p role="status" className="sr-only">
        {selected ? `Pins not assigned to ${selected.name} are grayed out.` : "Showing all pins."}
      </p>
      {taskMember && (
        <MemberTasks
          member={taskMember}
          onClose={closeTasks}
          onNavigate={() => {
            setTaskMember(null);
            requestAnimationFrame(() => document.getElementById("board-main")?.focus());
          }}
        />
      )}
    </aside>
  );
}

function MemberTasks({
  member,
  onClose,
  onNavigate,
}: {
  member: DemoMember;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const items = useBoardStore((state) => state.items);
  const allTasks = useTaskStore((state) => state.tasks);
  const tasks = findMemberTasks(allTasks, member.name);
  return (
    <Modal title={`Tasks for ${member.name}`} onClose={onClose}>
      <p className="mb-4 text-sm text-neutral-500">
        {tasks.length} {tasks.length === 1 ? "task" : "tasks"} assigned across this workspace.
      </p>
      {tasks.length ? (
        <ul className="member-task-list">
          {tasks.map((task) => {
            const href = boardItemHref(items, task.sectionId);
            const content = (
              <>
                <strong>{task.title}</strong>
                <span>
                  {task.status} ·{" "}
                  {items.find((item) => item.id === task.sectionId)?.title ?? "Board unavailable"}
                </span>
              </>
            );
            return (
              <li key={task.id}>
                {href ? (
                  <a href={href} onClick={onNavigate}>
                    {content}
                    <Icon name="chevron" size={16} />
                  </a>
                ) : (
                  <div className="member-task-unavailable">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="member-empty">No tasks are assigned to {member.name} yet.</p>
      )}
      <footer className="mt-5 flex justify-end">
        <button type="button" className="secondary-button" onClick={onClose}>
          Close
        </button>
      </footer>
    </Modal>
  );
}
