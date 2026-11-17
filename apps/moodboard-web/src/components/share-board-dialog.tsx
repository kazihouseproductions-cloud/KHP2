import { Mail, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ShareBoardDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Can edit");
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([]);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="share-board-dialog"
      aria-labelledby="share-board-heading"
      onCancel={onClose}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom)
        )
          onClose();
      }}
    >
      <header className="share-dialog-header">
        <Share2 size={18} />
        <div>
          <h2 id="share-board-heading">Share board</h2>
          <p>{title}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close sharing" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <p className="share-preview-notice">Sharing preview. Invitations are not sent.</p>
      <form
        className="share-invite-form"
        onSubmit={(event) => {
          event.preventDefault();
          const address = email.trim();
          if (!address) return;
          setInvites((current) => [
            ...current.filter((invite) => invite.email.toLowerCase() !== address.toLowerCase()),
            { email: address, role },
          ]);
          setEmail("");
        }}
      >
        <label className="invite-email">
          <Mail size={15} />
          <input
            aria-label="Invite email address"
            type="email"
            required
            placeholder="Add an email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <select
          aria-label="Invitation role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option>Can edit</option>
          <option>Can view</option>
        </select>
        <button type="submit" disabled={!email.trim()}>
          Preview invite
        </button>
      </form>
      <h3 className="share-people-heading">People with access</h3>
      <div className="share-person">
        <span className="share-person-avatar">Y</span>
        <span>You</span>
        <small>Owner</small>
      </div>
      {invites.map((invite) => (
        <div className="share-person" key={invite.email}>
          <span className="share-person-avatar">
            <Mail size={14} />
          </span>
          <span>
            {invite.email}
            <small>Not sent</small>
          </span>
          <small>{invite.role}</small>
        </div>
      ))}
      <p className="share-dialog-footnote">
        Board sharing will be available when accounts are connected.
      </p>
    </dialog>
  );
}
