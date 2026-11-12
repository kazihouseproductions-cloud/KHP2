import { type ReactNode, useLayoutEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";

export function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>("input")?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`form-dialog ${className}`}
      onCancel={onClose}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        // Let an open popover handle the first backdrop press.
        if (event.currentTarget.querySelector(":popover-open")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <header className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-[23px] font-semibold tracking-tight">{title}</h2>
        <button type="button" className="icon-action" aria-label="Close dialog" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
