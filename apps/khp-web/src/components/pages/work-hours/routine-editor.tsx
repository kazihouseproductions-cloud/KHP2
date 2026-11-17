import { useState, type FormEvent } from "react";
import { RoutineFields } from "./routine-fields";
import { Modal } from "@/components/common/modal";
import type { Member } from "@/lib/members";
import { type MemberRoutine, sampleWeek, type Shift, type Weekday } from "@/lib/work-hours";
import { useWorkHoursStore } from "@/stores/work-hours-store";

export function RoutineEditor({
  member,
  original,
  onClose,
}: {
  member: Member;
  original?: MemberRoutine;
  onClose: () => void;
}) {
  const initialDays = original?.days ?? sampleWeek;
  const [days, setDays] = useState(initialDays);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = useWorkHoursStore((state) => state.save);
  function update(day: Weekday, shift: Shift | null) {
    setDays((previous) => ({ ...previous, [day]: shift }));
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await save(member.id, days, original);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this routine.");
      setSaving(false);
    }
  }
  return (
    <Modal
      title={`Edit routine for ${member.name}`}
      className="workspace-dialog w-[min(560px,calc(100vw-32px))]"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <RoutineFields days={days} initialDays={initialDays} onChange={update} />
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <footer className="mt-5 flex justify-end gap-2">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="primary-button">
            Save routine
          </button>
        </footer>
      </form>
    </Modal>
  );
}
