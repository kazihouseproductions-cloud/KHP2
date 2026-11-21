import { Pencil, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import type { Layer } from "./types";

export default function LayerMenu({
  id,
  layer,
  trigger,
  clipCount,
  onRename,
  onDelete,
}: {
  id: string;
  layer?: Layer;
  trigger?: HTMLButtonElement;
  clipCount: number;
  onRename: (layer: Layer) => void;
  onDelete: (layer: Layer) => void;
}) {
  const menu = useRef<HTMLFieldSetElement>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el || !trigger) return;
    function position() {
      if (!el || !trigger || !el.matches(":popover-open")) return;
      const button = trigger.getBoundingClientRect(),
        box = el.getBoundingClientRect();
      const scale = box.width / el.offsetWidth;
      const left = Math.max(
        4,
        Math.min(button.left, window.innerWidth - box.width - 4),
      );
      const top =
        button.bottom + box.height + 4 <= window.innerHeight
          ? button.bottom + 3
          : Math.max(4, button.top - box.height - 3);
      el.style.left = `${left / scale}px`;
      el.style.top = `${top / scale}px`;
    }
    position();
    el.addEventListener("toggle", position);
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      el.removeEventListener("toggle", position);
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [trigger]);
  const protectedLayer = !layer || layer.id === "parent" || layer.locked;
  return (
    <>
      <fieldset
        ref={menu}
        id={id}
        popover="auto"
        className="sft-layer-menu"
        aria-label="Layer options"
      >
        <button
          type="button"
          disabled={!layer || layer.locked}
          onClick={() => {
            menu.current?.hidePopover();
            if (layer) onRename(layer);
          }}
        >
          <Pencil size={14} />
          Rename layer
        </button>
        <button
          type="button"
          className="sft-delete-action"
          disabled={protectedLayer}
          title={
            layer?.id === "parent"
              ? "The storyboard layer is permanent"
              : layer?.locked
                ? "Unlock this layer to delete it"
                : undefined
          }
          onClick={() => {
            menu.current?.hidePopover();
            confirmation.current?.showModal();
            cancel.current?.focus();
          }}
        >
          <Trash2 size={14} />
          Delete layer
        </button>
      </fieldset>
      <dialog
        ref={confirmation}
        className="sf-dialog sft-delete-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-impact`}
        onClose={() => {
          if (trigger?.isConnected) trigger.focus({ preventScroll: true });
        }}
      >
        <h2 id={`${id}-title`}>Delete “{layer?.name}”?</h2>
        <p id={`${id}-impact`}>
          {clipCount
            ? `This removes the layer, its ${clipCount === 1 ? "clip" : `${clipCount} clips`} and their feedback.`
            : "This removes the empty layer."}{" "}
          You can restore it from Checkpoints.
        </p>
        <div className="sft-dialog-actions">
          <button
            ref={cancel}
            type="button"
            onClick={() => confirmation.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sft-confirm-delete"
            disabled={protectedLayer}
            onClick={() => {
              confirmation.current?.close();
              if (layer && !protectedLayer) onDelete(layer);
            }}
          >
            Delete layer
          </button>
        </div>
      </dialog>
    </>
  );
}
