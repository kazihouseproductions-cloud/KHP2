import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/modal";
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
  status: TaskStatus;
  task?: Task;
  onClose: () => void;
};

export function TaskForm({ sectionId, status, task, onClose }: TaskFormProps) {
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
    <Modal title={task ? "Edit task" : "Add task"} onClose={onClose}>
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
        <label className="task-field">
          Date
          <input
            name="date"
            type="date"
            value={fields.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </label>
        <label className="task-field">
          Deadline
          <input
            name="deadline"
            type="date"
            min={fields.date || undefined}
            value={fields.deadline}
            onChange={(e) => update("deadline", e.target.value)}
          />
        </label>
        <label className="task-field">
          Assigned to
          <input
            name="assignedTo"
            maxLength={80}
            value={fields.assignedTo}
            onChange={(e) => update("assignedTo", e.target.value)}
          />
        </label>
        <label className="task-field">
          Assigned by
          <input
            name="assignedBy"
            maxLength={80}
            value={fields.assignedBy}
            onChange={(e) => update("assignedBy", e.target.value)}
          />
        </label>
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
        <footer className="col-span-2 mt-2 flex justify-end gap-2.5 border-t border-neutral-100 pt-4">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            {task ? "Save changes" : "Create task"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
