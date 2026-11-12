import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/common/modal";
import { Icon } from "@/components/ui/icon";
import { useBoardRoute } from "@/hooks/use-board-route";
import { resolveNodeRoute } from "@/lib/board-route";
import { type BoardItem, collectPinIds, indexBoardItems } from "@/lib/workspaces";
import { useBoardStore } from "@/stores/board-store";

export function DeletePinDialog({ item, onClose }: { item: BoardItem; onClose: () => void }) {
  const [step, setStep] = useState<"ask" | "verify">("ask");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const confirmationInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "verify") confirmationInput.current?.focus();
  }, [step]);
  const items = useBoardStore((state) => state.items);
  const remove = useBoardStore((state) => state.remove);
  const route = useBoardRoute();
  const nested = collectPinIds(items, item.id).size - 1;
  const parentHref = resolveNodeRoute(route, indexBoardItems(items).byId).find(
    (step) => step.item.id === item.id,
  )?.parentHref;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step !== "verify" || confirmation !== "DELETE") return;
    try {
      remove(item, confirmation);
      if (parentHref) window.location.hash = parentHref;
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this pin.");
    }
  }

  return (
    <Modal title={step === "ask" ? "Are you sure?" : "Type DELETE to delete"} onClose={onClose}>
      <div className="delete-pin-symbol">
        <Icon name="trash" size={25} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-neutral-600">
        Deleting <strong className="text-neutral-900">{item.title}</strong> will permanently remove
        this pin{nested > 0 ? `, ${nested} nested ${nested === 1 ? "pin" : "pins"},` : ""} and all
        tasks inside it. This cannot be undone.
      </p>
      {step === "ask" ? (
        <footer className="mt-6 flex justify-end gap-2.5">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="danger-button" onClick={() => setStep("verify")}>
            Yes, continue
          </button>
        </footer>
      ) : (
        <form onSubmit={submit} className="mt-5">
          <label className="block text-sm font-medium">
            Type <strong>DELETE</strong> to confirm
            <input
              ref={confirmationInput}
              autoComplete="off"
              spellCheck={false}
              aria-label="Type DELETE to confirm"
              className="member-search mt-2"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setError("");
              }}
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <footer className="mt-6 flex justify-end gap-2.5">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="danger-button" disabled={confirmation !== "DELETE"}>
              Delete permanently
            </button>
          </footer>
        </form>
      )}
    </Modal>
  );
}
