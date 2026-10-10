"""SQLite storage with short-lived connections and atomic field-level updates."""

import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from uuid import UUID

from todo_app.models import Todo


class SQLiteTodoRepository:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connection() as connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS todos (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    due_date TEXT,
                    is_completed INTEGER NOT NULL CHECK (is_completed IN (0, 1)),
                    created_at TEXT NOT NULL
                )
            """)

    @contextmanager
    def _connection(self):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    @staticmethod
    def _task(row: sqlite3.Row | None) -> Todo | None:
        return Todo.model_validate(dict(row)) if row is not None else None

    def list(self) -> list[Todo]:
        with self._connection() as connection:
            return [
                Todo.model_validate(dict(row)) for row in connection.execute("SELECT * FROM todos")
            ]

    def get(self, task_id: UUID) -> Todo | None:
        with self._connection() as connection:
            row = connection.execute("SELECT * FROM todos WHERE id = ?", (str(task_id),)).fetchone()
            return self._task(row)

    def add(self, task: Todo) -> None:
        values = task.model_dump(mode="json")
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO todos (id,title,description,due_date,is_completed,created_at) "
                "VALUES (:id,:title,:description,:due_date,:is_completed,:created_at)",
                values,
            )

    def update(self, task_id: UUID, changes: dict) -> Todo | None:
        # Column names come exclusively from this allowlist, never from request text.
        allowed = {"title", "description", "due_date", "is_completed"}
        if changes.keys() - allowed:
            raise ValueError("Unsupported task fields")
        with self._connection() as connection:
            if changes:
                assignments = ", ".join(f"{name} = ?" for name in changes)
                values = [
                    value.isoformat() if isinstance(value, date | datetime) else value
                    for value in changes.values()
                ]
                connection.execute(
                    f"UPDATE todos SET {assignments} WHERE id = ?", [*values, str(task_id)]
                )
            row = connection.execute("SELECT * FROM todos WHERE id = ?", (str(task_id),)).fetchone()
            return self._task(row)

    def delete(self, task_id: UUID) -> bool:
        with self._connection() as connection:
            return (
                connection.execute("DELETE FROM todos WHERE id = ?", (str(task_id),)).rowcount > 0
            )
