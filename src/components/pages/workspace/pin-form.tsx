import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/modal";
import { PinColorPicker } from "@/components/ui/pin-color-picker";
import { WorkspaceGlyph } from "@/components/ui/workspace-glyph";
import { getCatalogIcon } from "@/lib/catalog-icons";
import { type BoardItem, defaultPinColor, pinIcons, type WorkspaceIconId } from "@/lib/workspaces";
import { useBoardStore } from "@/stores/board-store";
import { AddPinMembers } from "./pin-members";
import { WorkspaceIconPicker } from "./workspace-icon-picker";

export function PinForm({
  parentId,
  item,
  onClose,
}: {
  parentId: string | null;
  item?: BoardItem;
  onClose: () => void;
}) {
  const noun = parentId === null ? "Workspace" : "Section";
  const [title, setTitle] = useState(item?.title ?? "");
  const [icon, setIcon] = useState<WorkspaceIconId>(item?.icon ?? "core:interface-folder");
  const [color, setColor] = useState(item?.color);
  const displayColor = color ?? (icon.startsWith("core:") ? defaultPinColor : "#7024d4");
  const previewStyle = { color: displayColor };
  const [picking, setPicking] = useState(false);
  const [created, setCreated] = useState<BoardItem | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const add = useBoardStore((state) => state.add);
  const update = useBoardStore((state) => state.update);
  const iconLabel =
    getCatalogIcon(icon)?.label ?? pinIcons.find((entry) => entry.id === icon)?.label;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (item) {
        update(item, title, icon, color);
        onClose();
      } else {
        setCreated(await add(title, icon, parentId, displayColor));
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : `Unable to save the ${noun.toLowerCase()}.`,
      );
    } finally {
      setSaving(false);
    }
  }

  if (created) return <AddPinMembers item={created} onClose={onClose} afterCreate />;

  return (
    <>
      <Modal
        title={`${item ? "Edit" : "Create"} ${noun.toLowerCase()}`}
        onClose={onClose}
        className="workspace-dialog"
      >
        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Title</span>
            <input
              name="title"
              className="workspace-field w-full"
              placeholder={`${noun} title`}
              style={previewStyle}
              required
              maxLength={60}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError("");
              }}
            />
          </label>
          <div>
            <span className="mb-2 block text-sm font-medium">Icon</span>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`Select icon, current icon: ${iconLabel}`}
              className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 p-2 pr-3 text-sm hover:bg-neutral-50"
              onClick={() => setPicking(true)}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-md bg-white"
                style={previewStyle}
              >
                <WorkspaceGlyph icon={icon} size={22} />
              </span>
              <span className="flex-1 text-left">{iconLabel}</span>
              <span className="shrink-0 text-xs font-medium text-neutral-600">Select icon</span>
            </button>
          </div>
          <PinColorPicker color={displayColor} onChange={setColor} />
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <footer className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving || !title.trim()}>
              {item ? "Save changes" : `Create ${noun.toLowerCase()}`}
            </button>
          </footer>
        </form>
      </Modal>
      {picking && (
        <WorkspaceIconPicker
          selected={icon}
          onClose={() => setPicking(false)}
          onSelect={(id) => {
            setIcon(id);
            setPicking(false);
          }}
        />
      )}
    </>
  );
}
