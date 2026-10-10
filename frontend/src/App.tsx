import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ListQuery, type Todo } from "./api";
import { Modal } from "./Modal";
import { TaskForm } from "./TaskForm";
import "./styles.css";
const initialQuery: ListQuery = {
  status: "all",
  sort: "createdAt",
  order: "desc",
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
function dateLabel(date: string) {
  // Calendar dates deliberately stay out of the local timezone conversion path.
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
export default function App() {
  const [query, setQuery] = useState(initialQuery);
  const [tasks, setTasks] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Todo | null>(null);
  const [detailError, setDetailError] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [detailRevision, setDetailRevision] = useState(0);
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const mutationLock = useRef(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api
      .list(query)
      .then((items) => {
        if (current) setTasks(items);
      })
      .catch((cause) => {
        if (current) setError(message(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [query, revision]);
  useEffect(() => {
    if (!selectedId) return;
    let current = true;
    setSelected(null);
    setDetailError("");
    api
      .get(selectedId)
      .then((item) => {
        if (current) setSelected(item);
      })
      .catch((cause) => {
        if (current) setDetailError(message(cause));
      });
    return () => {
      current = false;
    };
  }, [selectedId, detailRevision]);
  async function complete(task: Todo) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPendingId(task.id);
    setError("");
    try {
      await api.update(task.id, { isCompleted: !task.isCompleted });
      setNotice(
        task.isCompleted
          ? "Task marked incomplete."
          : "Task completed. Nicely done.",
      );
      refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      mutationLock.current = false;
      setPendingId(null);
    }
  }
  async function remove() {
    if (!deleting || mutationLock.current) return;
    mutationLock.current = true;
    setPendingId(deleting.id);
    setDeleteError("");
    try {
      await api.remove(deleting.id);
      setDeleting(null);
      setNotice("Task deleted.");
      refresh();
    } catch (cause) {
      setDeleteError(message(cause));
    } finally {
      mutationLock.current = false;
      setPendingId(null);
    }
  }
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Daylist home">
          <span className="brand-symbol" aria-hidden="true">
            ✓
          </span>
          daylist<span className="brand-dot">.</span>
        </a>
        <span className="header-note">A little more clarity, every day.</span>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
          <h1>Your day, a little clearer.</h1>
          <p>Big plans or small steps. Give them a place to begin.</p>
        </section>
        <div className="workspace">
          <aside className="composer panel">
            <div className="section-kicker">01 / CAPTURE</div>
            <h2>One thing at a time.</h2>
            <p className="muted">Get it out of your head and onto your list.</p>
            <TaskForm
              onSave={async (input) => {
                await api.create(input);
                setNotice("Task added to your list.");
                refresh();
              }}
            />
            <p className="composer-footnote">
              Small steps still move you forward.
            </p>
          </aside>
          <section className="tasks-section" aria-labelledby="tasks-heading">
            <div className="list-heading">
              <div>
                <div className="section-kicker">02 / MAKE PROGRESS</div>
                <h2 id="tasks-heading">
                  Your tasks{" "}
                  <span
                    className="count"
                    aria-label={`${tasks.length} tasks in this view`}
                  >
                    {loading || error ? "—" : tasks.length}
                  </span>
                </h2>
              </div>
            </div>
            <div className="toolbar">
              <div>
                <label htmlFor="status">Show tasks</label>
                <select
                  id="status"
                  value={query.status}
                  onChange={(e) =>
                    setQuery({
                      ...query,
                      status: e.target.value as ListQuery["status"],
                    })
                  }
                >
                  <option value="all">All tasks</option>
                  <option value="incomplete">Incomplete</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div>
                <label htmlFor="sort">Sort by</label>
                <select
                  id="sort"
                  value={query.sort}
                  onChange={(e) =>
                    setQuery({
                      ...query,
                      sort: e.target.value as ListQuery["sort"],
                    })
                  }
                >
                  <option value="createdAt">Created date</option>
                  <option value="dueDate">Due date</option>
                  <option value="title">Title</option>
                </select>
              </div>
              <div>
                <label htmlFor="order">Sort direction</label>
                <select
                  id="order"
                  value={query.order}
                  onChange={(e) =>
                    setQuery({
                      ...query,
                      order: e.target.value as ListQuery["order"],
                    })
                  }
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
            <div className="live-notice" aria-live="polite">
              {notice}
            </div>
            {error && (
              <div className="error-box" role="alert">
                <p>{error}</p>
                <button className="secondary" onClick={refresh}>
                  Try again
                </button>
              </div>
            )}
            {loading ? (
              <div className="empty-state" role="status">
                Loading your tasks…
              </div>
            ) : (
              !error &&
              (tasks.length ? (
                <ul className="task-list">
                  {tasks.map((task) => {
                    const overdue =
                      !task.isCompleted &&
                      task.dueDate !== null &&
                      task.dueDate < new Date().toISOString().slice(0, 10);
                    return (
                      <li
                        className={`task-card ${task.isCompleted ? "is-complete" : ""}`}
                        key={task.id}
                      >
                        <input
                          type="checkbox"
                          className="task-check"
                          checked={task.isCompleted}
                          disabled={pendingId !== null}
                          aria-label={`Mark ${task.title} ${task.isCompleted ? "incomplete" : "complete"}`}
                          onChange={() => void complete(task)}
                        />
                        <div className="task-content">
                          <button
                            className="task-title"
                            onClick={() => setSelectedId(task.id)}
                          >
                            {task.title}
                          </button>
                          {task.description && (
                            <p className="task-preview">{task.description}</p>
                          )}
                          <div className="task-meta">
                            <span
                              className={`status-pill ${task.isCompleted ? "done" : ""}`}
                            >
                              {task.isCompleted ? "Completed" : "Incomplete"}
                            </span>
                            <span className={overdue ? "overdue" : ""}>
                              {task.dueDate
                                ? `${overdue ? "Overdue · " : "Due "}${dateLabel(task.dueDate)}`
                                : "No due date"}
                            </span>
                          </div>
                        </div>
                        <button
                          className="delete-button"
                          disabled={pendingId !== null}
                          aria-label={`Delete ${task.title}`}
                          onClick={() => {
                            setDeleting(task);
                            setDeleteError("");
                          }}
                        >
                          Delete
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="empty-state">
                  <div className="empty-symbol" aria-hidden="true">
                    ✓
                  </div>
                  <h3>
                    {query.status === "all"
                      ? "A clear page. A fresh start."
                      : "No tasks match this view."}
                  </h3>
                  <p>
                    {query.status === "all"
                      ? "Add your first task and take it from there."
                      : "Try another filter, or enjoy a little breathing room."}
                  </p>
                </div>
              ))
            )}
            <p className="list-footnote">
              {query.status === "overdue"
                ? "Overdue means incomplete and due before today (UTC)."
                : "Click a task title to see details or make changes."}
            </p>
          </section>
        </div>
      </main>
      <footer>
        Less noise. More doing.<span>DAYLIST</span>
      </footer>
      {selectedId && (
        <Modal
          title="Task details"
          busy={editPending}
          onClose={() => setSelectedId(null)}
        >
          {detailError ? (
            <div role="alert">
              <p>{detailError}</p>
              <button onClick={() => setDetailRevision((value) => value + 1)}>
                Try again
              </button>
            </div>
          ) : selected ? (
            <>
              <div className="detail-meta">
                <span>{selected.isCompleted ? "Completed" : "Incomplete"}</span>
                <span>
                  Created {new Date(selected.createdAt).toLocaleString()}
                </span>
                <small className="task-id">ID: {selected.id}</small>
              </div>
              <TaskForm
                key={selected.id}
                task={selected}
                onPendingChange={setEditPending}
                onCancel={() => setSelectedId(null)}
                onSave={async (input) => {
                  await api.update(selected.id, input);
                  setSelectedId(null);
                  setNotice("Task updated.");
                  refresh();
                }}
              />
            </>
          ) : (
            <p role="status">Loading task details…</p>
          )}
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete this task?"
          busy={pendingId !== null}
          onClose={() => setDeleting(null)}
        >
          <p className="delete-copy">
            “{deleting.title}” will be permanently removed.
          </p>
          {deleteError && (
            <p role="alert" className="error">
              {deleteError}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary"
              disabled={pendingId !== null}
              onClick={() => setDeleting(null)}
            >
              Keep task
            </button>
            <button
              className="danger"
              disabled={pendingId !== null}
              onClick={() => void remove()}
            >
              {pendingId ? "Deleting…" : "Delete task"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
