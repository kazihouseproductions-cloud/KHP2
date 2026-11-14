import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/common/modal";
import { saveProfilePassword, watchProfilePassword } from "@/lib/profile-password";

function PasswordForm({
  existing,
  onClose,
  onSaved,
}: {
  existing: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    const next = String(fields.get("new") ?? "");
    if (next !== fields.get("confirm")) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveProfilePassword(String(fields.get("current") ?? ""), next, existing);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the password.");
      setSaving(false);
    }
  }
  return (
    <Modal
      title={existing ? "Change password" : "Set password"}
      onClose={onClose}
      className="workspace-dialog"
    >
      <form onSubmit={submit} className="grid gap-4">
        <p className="text-sm text-neutral-600">
          This password is saved for your local profile in this browser.
        </p>
        {existing && (
          <label className="task-field">
            Current password
            <input required type="password" name="current" autoComplete="current-password" />
          </label>
        )}
        <label className="task-field">
          New password
          <input required type="password" name="new" autoComplete="new-password" />
        </label>
        <label className="task-field">
          Confirm new password
          <input required type="password" name="confirm" autoComplete="new-password" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <footer className="flex justify-end gap-2">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            Save password
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function ProfilePassword() {
  const [exists, setExists] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => watchProfilePassword(setExists), []);
  return (
    <>
      <button
        type="button"
        className="secondary-button"
        disabled={exists === null}
        onClick={() => {
          setSaved(false);
          setEditing(exists);
        }}
      >
        {exists ? "Change password" : "Set password"}
      </button>
      <span role="status" className="text-sm text-neutral-600">
        {saved && "Password saved."}
      </span>
      {editing !== null && (
        <PasswordForm
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setExists(true);
            setSaved(true);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
