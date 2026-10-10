import { useState, type FormEvent } from "react";
import type { Todo, TodoInput } from "./api";
interface Props {
  task?: Todo;
  onSave: (input: TodoInput) => Promise<void>;
  onCancel?: () => void;
}
export function TaskForm({ task, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const prefix = task ? "edit" : "create";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!title.trim()) {
      setError("Enter a title for your task.");
      return;
    }
    if (title.trim().length > 200) {
      setError("Keep your title to 200 characters or fewer.");
      return;
    }
    if (description.length > 5000) {
      setError("Keep your description to 5,000 characters or fewer.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        description: description || null,
        dueDate: dueDate || null,
      });
      if (!task) {
        setTitle("");
        setDescription("");
        setDueDate("");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={pending}>
        <label htmlFor={`${prefix}-title`}>
          {task ? "Edit title" : "Task title"}
        </label>
        <input
          id={`${prefix}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What would you like to get done?"
          aria-required="true"
          aria-describedby={error ? `${prefix}-error` : undefined}
        />
        <label htmlFor={`${prefix}-description`}>
          {task ? "Edit description" : "Description"}{" "}
          <span className="optional">optional</span>
        </label>
        <textarea
          aria-label={task ? "Edit description" : "Description"}
          id={`${prefix}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A few details to help you along…"
          rows={3}
        />
        <label htmlFor={`${prefix}-due`}>
          {task ? "Edit due date" : "Due date"}{" "}
          <span className="optional">optional</span>
        </label>
        <input
          aria-label={task ? "Edit due date" : "Due date"}
          id={`${prefix}-due`}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        {error && (
          <p id={`${prefix}-error`} role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          {onCancel && (
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="primary">
            {pending
              ? task
                ? "Saving…"
                : "Adding…"
              : task
                ? "Save changes"
                : "Add task"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
