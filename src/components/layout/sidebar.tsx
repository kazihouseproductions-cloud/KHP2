import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import { ShellIcon } from "@/components/ui/shell-icon";
import { sections } from "@/lib/navigation";

export function Sidebar({
  active,
  open,
  onClose,
}: {
  active: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open && (
        <button
          className="mobile-scrim"
          type="button"
          aria-label="Dismiss navigation"
          onClick={onClose}
        />
      )}
      <aside
        id="main-sidebar"
        aria-label="Sidebar"
        className={`sidebar ${open ? "sidebar-open" : ""}`}
      >
        <button
          type="button"
          className="icon-action sidebar-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <div className="sidebar-heading">
          <ShellIcon name="workspace" size={25} />
          <span>Workspace</span>
        </div>
        <nav aria-label="Main navigation" className="nav-items">
          {sections.map(({ id, label }) => (
            <a
              key={id}
              href={id === "workspace" ? "#/" : `#/tool/${id}`}
              className="nav-link"
              aria-current={active === id ? "page" : undefined}
              onClick={onClose}
              title={id === "workspace" ? "Board" : label}
            >
              <ShellIcon name={id === "workspace" ? "board" : id} />
              <span>{id === "workspace" ? "Board" : label}</span>
            </a>
          ))}
        </nav>
        <div className="brand-link">
          <Image
            src="/design/kazi-house.png"
            alt="Kazi House Productions"
            width={77}
            height={67}
            priority
          />
        </div>
      </aside>
    </>
  );
}
