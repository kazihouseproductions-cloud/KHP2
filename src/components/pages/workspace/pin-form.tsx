import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/modal";
import { Icon } from "@/components/ui/icon";
import { WorkspaceGlyph } from "@/components/ui/workspace-glyph";
import { type BoardItem, pinIcons, workspaceIcons, type WorkspaceIconId } from "@/lib/workspaces";
import { useBoardStore } from "@/stores/board-store";

export function PinForm({
  parentId,
  noun,
  item,
  onClose,
}: {
  parentId: string | null;
  noun: string;
  item?: BoardItem;
  onClose: () => void;
}) {
  const options = item || noun === "Project" || noun === "Section" ? pinIcons : workspaceIcons;
  const [title, setTitle] = useState(item?.title ?? "");
  const [icon, setIcon] = useState<WorkspaceIconId>(
    item?.icon ?? (options === pinIcons ? "cutter" : "ogopogo"),
  );
  const [error, setError] = useState("");
  const add = useBoardStore((s) => s.add);
  const update = useBoardStore((s) => s.update);

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (item) update(item, title, icon);
      else add(title, icon, parentId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the pin.");
    }
  }

  return (
    <Modal title={item ? "Edit Pin" : `Add ${noun}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-6">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Title</span>
          <input
            name="title"
            required
            maxLength={60}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setError("");
            }}
            placeholder={`${noun} title`}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-base"
          />
        </label>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Icon</legend>
          <div className="grid grid-cols-4 gap-2">
            {options.map((option) => (
              <label key={option.id} className="relative cursor-pointer">
                <input
                  className="peer sr-only"
                  type="radio"
                  name="icon"
                  value={option.id}
                  checked={icon === option.id}
                  onChange={() => setIcon(option.id)}
                />
                <span className="flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-brand transition-colors hover:border-brand/50 peer-checked:border-brand peer-checked:bg-brand/5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                  <WorkspaceGlyph icon={option.id} size={25} />
                  <span className="text-xs font-medium">{option.label}</span>
                </span>
                {icon === option.id && (
                  <span className="absolute right-1.5 top-1.5 text-brand">
                    <Icon name="check" size={12} />
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <footer className="flex justify-end gap-2.5 border-t border-neutral-100 pt-4">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            {item ? "Save changes" : `Create ${noun.toLowerCase()}`}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
