import { useState } from "react";
import { Modal } from "@/components/common/modal";
import { Icon } from "@/components/ui/icon";
import { WorkspaceGlyph } from "@/components/ui/workspace-glyph";
import { catalogIcons, type CatalogIconId, iconCategories } from "@/lib/catalog-icons";
import type { WorkspaceIconId } from "@/lib/workspaces";

const pageSize = 40;

export function WorkspaceIconPicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: WorkspaceIconId;
  onSelect: (icon: CatalogIconId) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const words = query
    .toLowerCase()
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  const matches = catalogIcons.filter(
    (icon) =>
      (!category || icon.category === category) &&
      words.every((word) => icon.searchText.includes(word)),
  );
  const first = page * pageSize;
  const visible = matches.slice(first, first + pageSize);

  return (
    <Modal title="Select icon" onClose={onClose} className="workspace-dialog workspace-icon-picker">
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          className="workspace-field min-w-32 flex-1"
          aria-label="Search icons"
          placeholder="Search icons…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
        <select
          className="workspace-field max-w-full"
          aria-label="Icon category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(0);
          }}
        >
          <option value="">All categories</option>
          {Object.entries(iconCategories).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {visible.length ? (
        <ul aria-label="Icons" className="grid grid-cols-5 gap-1 sm:grid-cols-8">
          {visible.map((icon) => (
            <li key={icon.id}>
              <button
                type="button"
                title={icon.label}
                aria-label={icon.label}
                aria-pressed={selected === icon.id}
                className="grid h-10 w-full place-items-center rounded-md text-neutral-800 hover:bg-neutral-100 aria-pressed:bg-neutral-900 aria-pressed:text-white sm:h-12"
                onClick={() => onSelect(icon.id)}
              >
                <WorkspaceGlyph icon={icon.id} size={22} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-neutral-500">No icons match your search.</p>
      )}
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
        <a
          href="https://www.streamlinehq.com/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Icons by Streamline
        </a>
        <div className="flex items-center gap-1">
          <span aria-live="polite" className="mr-1 tabular-nums">
            {matches.length
              ? `${first + 1}–${first + visible.length} of ${matches.length.toLocaleString("en-US")}`
              : "0 icons"}
          </span>
          <button
            type="button"
            aria-label="Previous icons"
            className="icon-page-button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <span className="rotate-180">
              <Icon name="chevron" size={15} />
            </span>
          </button>
          <button
            type="button"
            aria-label="Next icons"
            className="icon-page-button"
            disabled={first + pageSize >= matches.length}
            onClick={() => setPage(page + 1)}
          >
            <Icon name="chevron" size={15} />
          </button>
        </div>
      </footer>
    </Modal>
  );
}
