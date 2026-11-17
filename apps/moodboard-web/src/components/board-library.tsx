import { ArrowUpRight, FolderOpen, Plus, Rocket, Search, SquareDashed, Users } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { boundsOf, connectionGeometry } from "@/lib/board-geometry";
import { type BoardDocument, boardsInSection } from "@/lib/board-library";
import { type BoardItem, isItemVisible, itemRect } from "@/lib/board-model";
import { AppSwitcher } from "./board-controls";

export function BoardLibrary({
  boards,
  onCreate,
  onOpen,
}: {
  boards: BoardDocument[];
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [section, setSection] = useState<"mine" | "shared">("mine");
  const visibleBoards = useMemo(
    () =>
      boardsInSection(boards, section)
        .filter((board) =>
          board.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        )
        .sort((first, second) =>
          sort === "name"
            ? first.title.localeCompare(second.title)
            : second.updatedAt - first.updatedAt,
        ),
    [boards, query, sort, section],
  );
  return (
    <div className="library-shell">
      <aside className="library-sidebar">
        <div className="library-brand">
          <span className="moodboard-mark">
            <SquareDashed size={24} />
            <Rocket size={24} />
          </span>
          <span>Moodboard</span>
        </div>
        <p className="library-nav-label">WORKSPACE</p>
        <button
          type="button"
          className="library-nav-item"
          aria-current={section === "mine" ? "page" : undefined}
          onClick={() => {
            setSection("mine");
            setQuery("");
          }}
          title="My boards"
        >
          <FolderOpen size={18} />
          <span>My boards</span>
          <span className="library-board-count">{boardsInSection(boards, "mine").length}</span>
        </button>
        <button
          type="button"
          className="library-nav-item"
          aria-current={section === "shared" ? "page" : undefined}
          onClick={() => {
            setSection("shared");
            setQuery("");
          }}
          title="Shared with me"
        >
          <Users size={18} />
          <span>Shared with me</span>
          <span className="library-board-count">{boardsInSection(boards, "shared").length}</span>
        </button>
        <div className="library-brand-footer">
          <Image src="/brand/kazi-house.png" alt="Kazi House Productions" width={76} height={68} />
        </div>
      </aside>
      <main className="library-main">
        <header className="library-header">
          <div>
            <p className="library-eyebrow">A space for your next idea</p>
            <h1>Your boards</h1>
            <p className="library-description">Gather your ideas. See the bigger picture.</p>
          </div>
          <button type="button" className="new-board-button" onClick={onCreate}>
            <Plus size={18} />
            <span>New board</span>
          </button>
        </header>
        <div className="library-controls">
          <label className="board-search">
            <Search size={17} />
            <input
              aria-label="Search boards"
              placeholder="Search boards"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="board-sort">
            <span>Sort by</span>
            <select
              aria-label="Sort boards"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recent">Recently edited</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        <div className="library-section-heading">
          <h2>{section === "mine" ? "My boards" : "Shared with me"}</h2>
          <span>
            {visibleBoards.length} {visibleBoards.length === 1 ? "board" : "boards"}
          </span>
        </div>
        <div className="board-library-grid">
          {visibleBoards.map((board) => (
            <article className="library-board-card" key={board.id}>
              <button
                className="open-library-board"
                type="button"
                aria-label={`Open ${board.title}`}
                onClick={() => onOpen(board.id)}
              >
                <BoardThumbnail
                  items={board.history.present.items}
                  connections={board.history.present.connections}
                />
                <div className="library-board-details">
                  <div>
                    <h3>{board.title}</h3>
                    <p>
                      {board.history.present.items.length}{" "}
                      {board.history.present.items.length === 1 ? "item" : "items"}
                      <span>·</span>Edited{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Asia/Dhaka",
                      }).format(board.updatedAt)}
                    </p>
                  </div>
                  <ArrowUpRight size={17} />
                </div>
              </button>
            </article>
          ))}
          {!query && section === "mine" && (
            <button type="button" className="create-board-tile" onClick={onCreate}>
              <span className="create-board-icon">
                <Plus size={23} />
              </span>
              <strong>Create a new board</strong>
              <span>A blank canvas for your ideas</span>
            </button>
          )}
        </div>
        {!visibleBoards.length && query && (
          <div className="library-no-results">
            <Search size={30} />
            <h2>No boards found</h2>
            <p>Try a different name.</p>
            <button type="button" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        )}
        {!visibleBoards.length && !query && section === "shared" && (
          <div className="library-no-results">
            <Users size={30} />
            <h2>No shared boards yet</h2>
            <p>Boards shared with you will appear here.</p>
          </div>
        )}
      </main>
      <AppSwitcher />
    </div>
  );
}

function BoardThumbnail({
  items,
  connections,
}: {
  items: BoardItem[];
  connections: { id: string; from: string; to: string }[];
}) {
  const visible = items.filter((item) => isItemVisible(item, items));
  const bounds = boundsOf(visible);
  const box = bounds
    ? `${bounds.x - 70} ${bounds.y - 70} ${Math.max(bounds.width + 140, 500)} ${Math.max(bounds.height + 140, 300)}`
    : "0 0 500 300";
  return (
    <div className="board-thumbnail">
      <svg viewBox={box} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        {connections.map((edge) => {
          const from = visible.find((item) => item.id === edge.from);
          const to = visible.find((item) => item.id === edge.to);
          return from && to ? (
            <path
              key={edge.id}
              d={connectionGeometry(from, to).path}
              stroke="#ae87c7"
              strokeWidth={2}
              fill="none"
            />
          ) : null;
        })}
        {visible.map((item) => {
          const rect = itemRect(item);
          return (
            <g
              key={item.id}
              transform={`rotate(${item.rotation} ${rect.x + rect.width / 2} ${rect.y + rect.height / 2})`}
            >
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={0}
                fill={
                  item.kind === "sticky"
                    ? item.color
                    : item.kind === "collection"
                      ? "#f3e7fa"
                      : "#fff"
                }
                stroke={item.kind === "sticky" ? "#e2d475" : "#ded5e6"}
                strokeWidth={1.5}
              />
              {item.kind === "image" && item.image && (
                <image
                  href={item.image.src}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {item.kind !== "image" && (
                <text x={rect.x + 13} y={rect.y + 26} fontSize={12} fill="#786d80">
                  {item.kind === "sticky"
                    ? item.text.slice(0, 28)
                    : item.kind === "comment"
                      ? `${item.messages.length} comments`
                      : item.title}
                </text>
              )}
              {item.kind === "link" && (
                <text x={rect.x + 13} y={rect.y + 52} fontSize={10} fill="#9b8aa7">
                  {item.url.slice(0, 30)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {!visible.length && <span className="empty-board-thumbnail">Your next idea starts here</span>}
    </div>
  );
}
