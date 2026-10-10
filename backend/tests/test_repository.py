from datetime import UTC, datetime
from uuid import uuid4

from todo_app.models import TodoCreate, TodoPatch
from todo_app.repository import SQLiteTodoRepository
from todo_app.service import TodoService


def test_changes_persist_across_repository_instances(tmp_path):
    path = tmp_path / "nested" / "tasks.sqlite3"
    service = TodoService(SQLiteTodoRepository(path), lambda: datetime(2026, 10, 10, tzinfo=UTC))
    task = service.create(TodoCreate(title="O'Brien; DROP TABLE todos;", dueDate="2026-11-01"))
    removed = service.create(TodoCreate(title="Remove"))
    service.update(task.id, TodoPatch(description="Persist me", dueDate=None, isCompleted=True))
    service.delete(removed.id)
    reopened = SQLiteTodoRepository(path)
    stored = reopened.get(task.id)
    assert stored.title == task.title
    assert stored.description == "Persist me"
    assert stored.due_date is None
    assert stored.is_completed is True
    assert stored.created_at == task.created_at
    assert reopened.get(removed.id) is None
    assert reopened.list() == [stored]
    assert reopened.update(uuid4(), {}) is None
    assert reopened.delete(uuid4()) is False


def test_partial_updates_preserve_other_writers_changes(tmp_path):
    path = tmp_path / "tasks.sqlite3"
    first = TodoService(SQLiteTodoRepository(path))
    second = TodoService(SQLiteTodoRepository(path))
    task = first.create(TodoCreate(title="Original"))
    first.update(task.id, TodoPatch(title="Renamed"))
    second.update(task.id, TodoPatch(isCompleted=True))
    assert first.get(task.id).title == "Renamed"
    assert first.get(task.id).is_completed is True


def test_concurrent_field_updates_do_not_lose_changes(tmp_path):
    from concurrent.futures import ThreadPoolExecutor

    service = TodoService(SQLiteTodoRepository(tmp_path / "tasks.sqlite3"))
    task = service.create(TodoCreate(title="Original"))
    with ThreadPoolExecutor(max_workers=2) as pool:
        title = pool.submit(service.update, task.id, TodoPatch(title="Renamed"))
        status = pool.submit(service.update, task.id, TodoPatch(isCompleted=True))
        title.result()
        status.result()
    stored = service.get(task.id)
    assert stored.title == "Renamed"
    assert stored.is_completed is True
