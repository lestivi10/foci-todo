import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { api, type Todo } from "./api";
vi.mock("./api", () => ({
  api: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
const task: Todo = {
  id: "one",
  title: "Prepare notes",
  description: "Read the brief",
  dueDate: "2026-10-15",
  isCompleted: false,
  createdAt: "2026-10-10T12:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.list).mockResolvedValue([]);
});
it("shows loading, then a helpful empty state", async () => {
  render(<App />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(
    await screen.findByText("A clear page. A fresh start."),
  ).toBeInTheDocument();
});
it("validates blank titles, then creates a task with optional fields", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText("A clear page. A fresh start.");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(
    await screen.findByText("Enter a title for your task."),
  ).toBeInTheDocument();
  await user.type(screen.getByLabelText("Task title"), "  Prepare notes  ");
  await user.type(screen.getByLabelText("Description"), "Read the brief");
  vi.mocked(api.create).mockResolvedValue(task);
  vi.mocked(api.list).mockResolvedValue([task]);
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(
    await screen.findByRole("button", { name: "Prepare notes" }),
  ).toBeInTheDocument();
  expect(api.create).toHaveBeenCalledWith({
    title: "Prepare notes",
    description: "Read the brief",
    dueDate: null,
  });
  expect(screen.getByLabelText("Task title")).toHaveValue("");
});
it("preserves failed form values and allows retry", async () => {
  const user = userEvent.setup();
  vi.mocked(api.create).mockRejectedValue(new Error("Could not save."));
  render(<App />);
  await user.type(screen.getByLabelText("Task title"), "Keep my notes");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(await screen.findByText("Could not save.")).toBeInTheDocument();
  expect(screen.getByLabelText("Task title")).toHaveValue("Keep my notes");
});
it("retries list failures and sends selected filter and ordering", async () => {
  const user = userEvent.setup();
  vi.mocked(api.list).mockRejectedValueOnce(new Error("Offline"));
  render(<App />);
  await screen.findByText("Offline");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("A clear page. A fresh start.");
  await user.selectOptions(screen.getByLabelText("Show tasks"), "overdue");
  await user.selectOptions(screen.getByLabelText("Sort by"), "dueDate");
  await user.selectOptions(screen.getByLabelText("Sort direction"), "asc");
  await waitFor(() =>
    expect(api.list).toHaveBeenLastCalledWith({
      status: "overdue",
      sort: "dueDate",
      order: "asc",
    }),
  );
  expect(
    await screen.findByText("No tasks match this view."),
  ).toBeInTheDocument();
});
it("opens details, clears optional fields, and saves edits", async () => {
  const user = userEvent.setup();
  vi.mocked(api.list).mockResolvedValue([task]);
  vi.mocked(api.get).mockResolvedValue(task);
  vi.mocked(api.update).mockResolvedValue(task);
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Prepare notes" }),
  );
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  const title = screen.getByLabelText("Edit title");
  await user.clear(title);
  await user.type(title, "Updated notes");
  await user.clear(screen.getByLabelText("Edit description"));
  await user.clear(screen.getByLabelText("Edit due date"));
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(api.update).toHaveBeenCalledWith("one", {
      title: "Updated notes",
      description: null,
      dueDate: null,
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
it("sets completion explicitly and confirms deletion with cancellation", async () => {
  const user = userEvent.setup();
  vi.mocked(api.list).mockResolvedValue([task]);
  vi.mocked(api.update).mockResolvedValue({ ...task, isCompleted: true });
  vi.mocked(api.remove).mockResolvedValue(undefined);
  render(<App />);
  await user.click(
    await screen.findByRole("checkbox", {
      name: "Mark Prepare notes complete",
    }),
  );
  expect(api.update).toHaveBeenCalledWith("one", { isCompleted: true });
  await user.click(
    screen.getByRole("button", { name: "Delete Prepare notes" }),
  );
  await user.click(screen.getByRole("button", { name: "Keep task" }));
  expect(api.remove).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Delete Prepare notes" }),
  );
  await user.click(screen.getByRole("button", { name: "Delete task" }));
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith("one"));
});
it("prevents duplicate creation while a save is pending", async () => {
  const user = userEvent.setup();
  vi.mocked(api.create).mockReturnValue(new Promise(() => {}));
  render(<App />);
  await user.type(screen.getByLabelText("Task title"), "One task");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
  expect(api.create).toHaveBeenCalledTimes(1);
});

it("keeps a pending edit open and preserves the form if saving fails", async () => {
  const user = userEvent.setup();
  let rejectSave!: (error: Error) => void;
  vi.mocked(api.list).mockResolvedValue([task]);
  vi.mocked(api.get).mockResolvedValue(task);
  vi.mocked(api.update).mockReturnValue(
    new Promise((_, reject) => {
      rejectSave = reject;
    }),
  );
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Prepare notes" }),
  );
  const title = await screen.findByLabelText("Edit title");
  await user.clear(title);
  await user.type(title, "Unsaved changes");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  rejectSave(new Error("Save failed. Try again."));
  expect(
    await screen.findByText("Save failed. Try again."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Edit title")).toHaveValue("Unsaved changes");
  expect(screen.getByRole("button", { name: "Close dialog" })).toBeEnabled();
});

it("renders early calendar years without shifting them into the twentieth century", async () => {
  vi.mocked(api.list).mockResolvedValue([{ ...task, dueDate: "0099-01-01" }]);
  render(<App />);
  expect(await screen.findByText("Overdue · Jan 1, 99")).toBeInTheDocument();
});
