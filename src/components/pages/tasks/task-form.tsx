import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/modal";
import type { DemoMember } from "@/lib/members";
import {
  newTaskFields,
  priorities,
  taskStatuses,
  type Task,
  type TaskFields,
  type TaskStatus,
} from "@/lib/tasks";
import { useTaskStore } from "@/stores/task-store";

type TaskFormProps = {
  sectionId: string;
  members: readonly DemoMember[];
  status: TaskStatus;
  task?: Task;
  onClose: () => void;
};

function TaskMemberSelect({
  name,
  members,
  value,
  onChange,
}: {
  name: "assignedTo" | "assignedBy";
  members: readonly DemoMember[];
  value: string;
  onChange: (name: "assignedTo" | "assignedBy", value: string) => void;
}) {
  const normalized = value.trim().toLowerCase();
  const match = members.find((member) => member.name.toLowerCase() === normalized);
  return (
    <label className="task-field max-[420px]:col-span-2">
      {name === "assignedTo" ? "Assigned to" : "Assigned by"}
      <select
        name={name}
        value={match?.name ?? value}
        onChange={(event) => onChange(name, event.target.value)}
      >
        <option value="">{members.length ? "None" : "No workspace members"}</option>
        {value && !match && (
          <option value={value} disabled>
            {value} (unavailable)
          </option>
        )}
        {members.map((member) => (
          <option key={member.id} value={member.name}>
            {member.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TaskForm({ sectionId, members, status, task, onClose }: TaskFormProps) {
  const [fields, setFields] = useState<TaskFields>(() => task ?? newTaskFields(status));
  const [error, setError] = useState("");
  const save = useTaskStore((state) => state.save);
  function update<K extends keyof TaskFields>(key: K, value: TaskFields[K]) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      save(sectionId, fields, task);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the task.");
    }
  }
  return (
    <Modal
      title={task ? "Edit task" : "Create task"}
      className="workspace-dialog"
      onClose={onClose}
    >
      <form className="grid grid-cols-2 gap-4" onSubmit={submit}>
        <label className="task-field col-span-2">
          Task title
          <input
            name="title"
            required
            maxLength={120}
            value={fields.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </label>
        <label className="task-field max-[420px]:col-span-2">
          Date
          <input
            name="date"
            type="date"
            value={fields.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </label>
        <label className="task-field max-[420px]:col-span-2">
          Deadline
          <input
            name="deadline"
            type="date"
            min={fields.date || undefined}
            value={fields.deadline}
            onChange={(e) => update("deadline", e.target.value)}
          />
        </label>
        <TaskMemberSelect
          name="assignedTo"
          members={members}
          value={fields.assignedTo}
          onChange={update}
        />
        <TaskMemberSelect
          name="assignedBy"
          members={members}
          value={fields.assignedBy}
          onChange={update}
        />
        <label className="task-field">
          Priority
          <select
            name="priority"
            value={fields.priority}
            onChange={(e) => update("priority", e.target.value as TaskFields["priority"])}
          >
            <option value="">None</option>
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
        <label className="task-field">
          Status
          <select
            name="status"
            value={fields.status}
            onChange={(e) => update("status", e.target.value as TaskStatus)}
          >
            {taskStatuses.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        {error && (
          <p className="col-span-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <footer className="col-span-2 mt-1 flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={!fields.title.trim()}>
            {task ? "Save changes" : "Create task"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
