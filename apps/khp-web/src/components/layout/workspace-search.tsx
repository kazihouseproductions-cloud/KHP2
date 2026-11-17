import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { WorkspaceGlyph } from "@/components/ui/workspace-glyph";
import { memberTasksHref } from "@/lib/board-route";
import type { Member } from "@/lib/members";
import {
  matchSuggestions,
  workspaceSuggestions,
  type SearchSuggestion,
} from "@/lib/workspace-search";
import { nodeHref, type BoardItem } from "@/lib/workspaces";
import { useBoardViewStore } from "@/stores/board-view-store";

export type WorkspaceSearchProps = {
  byId: ReadonlyMap<string, BoardItem>;
  members: readonly Member[];
  boardHref: string;
  showMemberTasksLink: boolean;
};

export function WorkspaceSearch({
  byId,
  members,
  boardHref,
  showMemberTasksLink,
  onOpen,
}: WorkspaceSearchProps & { onOpen: () => void }) {
  const memberId = useBoardViewStore((state) => state.memberId);
  const selectMember = useBoardViewStore((state) => state.selectMember);
  const selected = members.find((member) => member.id === memberId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const container = useRef<HTMLDivElement>(null);
  const listId = useId();
  const suggestions = useMemo(() => workspaceSuggestions(byId, members), [byId, members]);
  const matches = useMemo(() => matchSuggestions(suggestions, query), [suggestions, query]);
  const activeId = open && matches[active] ? `${listId}-${active}` : undefined;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(-1);
  }, []);

  function start() {
    onOpen();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    window.addEventListener("hashchange", close);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      window.removeEventListener("hashchange", close);
    };
  }, [open, close]);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function choose(suggestion: SearchSuggestion) {
    close();
    document.getElementById("board-main")?.focus({ preventScroll: true });
    if (suggestion.kind === "node") {
      window.location.hash = nodeHref(suggestion.item);
    } else if (suggestion.member.id === memberId) {
      selectMember(null);
    } else {
      selectMember(suggestion.member.id);
      window.location.hash = boardHref;
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      start();
      if (matches.length) {
        const last = matches.length - 1;
        if (event.key === "ArrowDown") setActive(active >= last ? 0 : active + 1);
        else setActive(active <= 0 ? last : active - 1);
      }
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const suggestion = matches[Math.max(0, active)];
      if (suggestion) choose(suggestion);
    } else if (event.key === "Escape") {
      close();
    }
  }

  const tasksLink = selected && showMemberTasksLink;
  return (
    <div className="workspace-search" ref={container}>
      <div className="workspace-search-field">
        <input
          role="combobox"
          aria-label="Search nodes and members"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={activeId}
          autoComplete="off"
          placeholder={(!open && selected?.name) || "Search project, member etc..."}
          data-filtered={!open && selected ? true : undefined}
          value={query}
          onFocus={start}
          onClick={start}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            start();
            setQuery(event.target.value);
            setActive(-1);
          }}
        />
        {selected && (
          <button
            type="button"
            className="search-clear"
            aria-label={`Clear member filter for ${selected.name}`}
            onClick={() => {
              selectMember(null);
              close();
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {(open || tasksLink) && (
        <div className="workspace-search-popup">
          {open && (
            <>
              <div
                role="listbox"
                id={listId}
                aria-label="Search suggestions"
                className="workspace-search-list"
              >
                {matches.map((suggestion, index) => (
                  <button
                    key={
                      suggestion.kind === "node"
                        ? `node-${suggestion.item.id}`
                        : `member-${suggestion.member.id}`
                    }
                    role="option"
                    type="button"
                    tabIndex={-1}
                    id={`${listId}-${index}`}
                    aria-selected={index === active}
                    className="workspace-search-option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(suggestion)}
                  >
                    {suggestion.kind === "member" ? (
                      <MemberAvatar member={suggestion.member} />
                    ) : (
                      <span className="search-node-icon" style={{ color: suggestion.item.color }}>
                        <WorkspaceGlyph icon={suggestion.item.icon} size={19} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{suggestion.name}</span>
                      <span className="block break-words text-xs text-neutral-500">
                        {suggestion.detail}
                      </span>
                    </span>
                    {suggestion.kind === "member" && suggestion.member.id === memberId && (
                      <span className="ml-auto">
                        <span className="sr-only">Deselect member</span>
                        <Icon name="close" size={14} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {!matches.length && (
                <p role="status" className="px-4 py-3 text-sm text-neutral-500">
                  No matching nodes or members.
                </p>
              )}
            </>
          )}
          {tasksLink && (
            <a
              className="search-member-tasks"
              href={memberTasksHref(boardHref, selected.id)}
              onClick={close}
            >
              See All Tasks by {selected.name}
            </a>
          )}
        </div>
      )}
      <span className="sr-only" role="status">
        {selected ? `Pins not assigned to ${selected.name} are grayed out.` : "Showing all pins."}
      </span>
    </div>
  );
}
