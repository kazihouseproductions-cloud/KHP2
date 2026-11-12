import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { WorkspaceGlyph } from "@/components/ui/workspace-glyph";
import { demoMembers, pinMatchesMember } from "@/lib/members";
import type { BoardItem } from "@/lib/workspaces";
import { useBoardViewStore } from "@/stores/board-view-store";
import { DeletePinDialog } from "./delete-pin-dialog";
import { PinForm } from "./pin-form";
import { AddPinMembers, PinMembers } from "./pin-members";
import { PinPopover } from "./pin-popover";

export function BoardPin({
  item,
  href,
  label = `Open ${item.title}`,
}: {
  item: BoardItem;
  href: string;
  label?: string;
}) {
  const memberId = useBoardViewStore((state) => state.memberId);
  const dimmed = !pinMatchesMember(item, memberId);
  const member = demoMembers.find((entry) => entry.id === memberId);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [panel, setPanel] = useState<"menu" | "members" | null>(null);
  const [modal, setModal] = useState<{ action: "add" | "edit" | "delete"; item: BoardItem } | null>(
    null,
  );
  const closePanel = useCallback(() => setPanel(null), []);
  const closeModal = useCallback(() => {
    const returnTarget = trigger.current;
    setModal(null);
    // The board stays inert until the native modal has closed during unmount.
    requestAnimationFrame(() => {
      if (returnTarget?.isConnected) returnTarget.focus();
      else document.getElementById("board-main")?.focus();
    });
  }, []);
  useEffect(() => {
    const close = () => {
      setPanel(null);
      setModal(null);
    };
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);
  function openModal(action: "add" | "edit" | "delete") {
    setPanel(null);
    setModal({ action, item });
  }
  return (
    <div
      className="board-pin-wrap"
      data-active={panel !== null || modal !== null || undefined}
      data-member-dimmed={dimmed || undefined}
    >
      <a
        href={href}
        draggable={false}
        aria-label={label}
        aria-description={dimmed ? `Not assigned to ${member?.name}` : undefined}
        className="board-pin group"
        style={{ color: item.color }}
        data-catalog-icon={item.icon.startsWith("core:") || undefined}
      >
        <span className="pin-face pin-image">
          <WorkspaceGlyph icon={item.icon} />
        </span>
        <span className="pin-face pin-caption">
          <span>{item.title}</span>
        </span>
      </a>
      <button
        ref={trigger}
        type="button"
        className="pin-options"
        aria-label={`Options for ${item.title}`}
        aria-haspopup={panel === "members" ? "dialog" : "menu"}
        aria-expanded={panel !== null}
        aria-controls={panel ? id : undefined}
        onClick={() => setPanel((value) => (value ? null : "menu"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setPanel("menu");
          }
        }}
      >
        <Image src="/design/pin-options.svg" alt="" width={14} height={14} unoptimized />
      </button>
      {panel && trigger.current && (
        <PinPopover
          key={panel}
          id={id}
          anchor={trigger.current}
          label={panel === "menu" ? `Actions for ${item.title}` : `Members of ${item.title}`}
          menu={panel === "menu"}
          onClose={closePanel}
        >
          {panel === "menu" ? (
            <>
              <button type="button" role="menuitem" onClick={() => openModal("add")}>
                <Icon name="plus" size={17} />
                Add Member
              </button>
              <button type="button" role="menuitem" onClick={() => setPanel("members")}>
                <Icon name="people" size={17} />
                Members
              </button>
              <button type="button" role="menuitem" onClick={() => openModal("edit")}>
                <Icon name="edit" size={17} />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="pin-menu-delete"
                onClick={() => openModal("delete")}
              >
                <Icon name="trash" size={17} />
                Delete
              </button>
            </>
          ) : (
            <PinMembers
              item={item}
              onAdd={() => openModal("add")}
              onClose={() => {
                closePanel();
                trigger.current?.focus();
              }}
            />
          )}
        </PinPopover>
      )}
      {modal &&
        createPortal(
          modal.action === "edit" ? (
            <PinForm item={modal.item} parentId={modal.item.parentId} onClose={closeModal} />
          ) : modal.action === "add" ? (
            <AddPinMembers item={modal.item} onClose={closeModal} />
          ) : (
            <DeletePinDialog item={modal.item} onClose={closeModal} />
          ),
          document.body,
        )}
    </div>
  );
}

export function AddPin({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="add-pin">
      <Icon name="plus" size={26} />
      <span>{label}</span>
    </button>
  );
}
