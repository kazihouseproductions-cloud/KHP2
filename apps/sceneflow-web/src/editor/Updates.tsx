import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Funnel,
  Layers3,
  ListFilter,
  MessageSquare,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useId, useState } from "react";
import type { Activity } from "./types";

const actionIcons = {
  Created: Layers3,
  Uploaded: Upload,
  Deleted: Trash2,
  Edited: Pencil,
  Propagated: Layers3,
  Feedback: MessageSquare,
  Done: Check,
  Approved: Star,
  Reopened: RotateCcw,
};
function category(tag: string, message: string) {
  if (tag === "Layer" && /^added/i.test(message)) return "Created";
  if (tag === "Snap All") return "Propagated";
  if (/revert|reopen/i.test(tag)) return "Reopened";
  if (/approv/i.test(tag)) return "Approved";
  if (/done|resolved/i.test(tag)) return "Done";
  if (/delete|remov/i.test(tag)) return "Deleted";
  if (/feedback|repl|draw|comment/i.test(tag)) return "Feedback";
  if (/upload|import/i.test(tag)) return "Uploaded";
  if (/creat|add layer/i.test(tag)) return "Created";
  if (/propagat|magnet|rearrang/i.test(tag)) return "Propagated";
  return "Edited";
}
export default function Updates({
  items,
  author,
  open,
}: {
  items: Activity[];
  author: string;
  open: (a: Activity) => void;
}) {
  const [mine, setMine] = useState("all"),
    [who, setWho] = useState(""),
    [period, setPeriod] = useState("0"),
    [tags, setTags] = useState<string[]>([]),
    [page, setPage] = useState(0),
    [expanded, setExpanded] = useState(true);
  const people = [...new Set(items.map((a) => a.author))].sort();
  const filterId = useId();
  const hasFilters =
    mine !== "all" || !!who || period !== "0" || tags.length > 0;
  function clearFilters() {
    setMine("all");
    setWho("");
    setPeriod("0");
    setTags([]);
    setPage(0);
  }
  const filtered = items.filter(
    (a) =>
      (mine === "all" || author === a.author) &&
      (!who || a.author === who) &&
      (!Number(period) ||
        Date.now() - a.created <= Number(period) * 86400000) &&
      (!tags.length || tags.includes(category(a.action, a.message))),
  );
  const pageSize = 11,
    pages = Math.ceil(filtered.length / pageSize),
    current = Math.min(page, Math.max(0, pages - 1));
  return (
    <aside className="sf-updates" aria-label="Activity log">
      <section className="sf-filter-card" aria-label="Activity filters">
        <button
          type="button"
          className="sf-filter-title"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={filterId}
        >
          <span>
            <Funnel size={14} /> Filter
          </span>
          <ChevronDown size={16} />
        </button>
        <div className="sf-filter-fields" id={filterId} hidden={!expanded}>
          <label>
            Visibility
            <select
              aria-label="Visibility"
              value={mine}
              onChange={(e) => {
                setMine(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All updates</option>
              <option value="mine">My updates</option>
            </select>
          </label>
          <fieldset>
            <legend>Action</legend>
            <div className="sf-action-options">
              {Object.keys(actionIcons).map((tag) => (
                <label key={tag}>
                  <input
                    type="checkbox"
                    checked={tags.includes(tag)}
                    onChange={() => {
                      setPage(0);
                      setTags((list) =>
                        list.includes(tag)
                          ? list.filter((t) => t !== tag)
                          : [...list, tag],
                      );
                    }}
                  />
                  {tag}
                </label>
              ))}
              <button
                type="button"
                className="sf-all-actions"
                aria-pressed={!tags.length}
                onClick={() => {
                  setTags([]);
                  setPage(0);
                }}
              >
                All actions
              </button>
            </div>
          </fieldset>
          <div className="sf-filter-pair">
            <label>
              Updated
              <select
                aria-label="Updated"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(0);
                }}
              >
                <option value="0">Any time</option>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <label>
              Updated by
              <select
                aria-label="Updated by"
                value={who}
                onChange={(e) => {
                  setWho(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Anyone</option>
                {people.map((person) => (
                  <option key={person}>{person}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>
      <div className="sf-updates-heading">
        <h2>Updates</h2>
        <span>{filtered.length}</span>
        {hasFilters && (
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      {filtered.length > 0 && (
        <div className="sf-pagination">
          <span aria-live="polite">
            {current * pageSize + 1}–
            {Math.min(filtered.length, (current + 1) * pageSize)} of{" "}
            {filtered.length} updates
          </span>
          <button
            type="button"
            aria-label="Previous updates"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            aria-label="Next updates"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      <div
        className="sf-log"
        key={JSON.stringify([current, mine, who, period, tags])}
      >
        {filtered
          .slice(current * pageSize, (current + 1) * pageSize)
          .map((item) => {
            const Icon = actionIcons[category(item.action, item.message)];
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => open(item)}
                disabled={!item.clipId && !item.feedbackId}
              >
                <span className="sf-log-icon">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span>
                  <b>{item.author}</b> {item.message}
                  <time dateTime={new Date(item.created).toISOString()}>
                    {new Date(item.created).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </span>
              </button>
            );
          })}
      </div>
      {!filtered.length && (
        <div className="sf-aside-empty">
          {items.length ? <SlidersHorizontal /> : <ListFilter />}
          <strong>
            {items.length ? "No matching updates" : "No updates yet"}
          </strong>
          <p>
            {items.length
              ? "Adjust the filters to see more activity."
              : "Clip edits and feedback will appear here."}
          </p>
        </div>
      )}
    </aside>
  );
}
