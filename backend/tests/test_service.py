from datetime import UTC, datetime
from uuid import UUID

import pytest

from todo_app.models import TodoCreate, TodoPatch
from todo_app.service import TodoNotFound, TodoService


class MemoryRepository:
    def __init__(self):
        self.tasks = {}

    def list(self):
        return list(self.tasks.values())

    def get(self, task_id):
        return self.tasks.get(task_id)

    def add(self, task):
        self.tasks[task.id] = task

    def update(self, task_id, changes):
        if task_id not in self.tasks:
            return None
        self.tasks[task_id] = self.tasks[task_id].model_copy(update=changes)
        return self.tasks[task_id]

    def delete(self, task_id):
        return self.tasks.pop(task_id, None) is not None


def test_task_lifecycle_preserves_identity_and_time():
    now = datetime(2026, 10, 10, 12, tzinfo=UTC)
    service = TodoService(MemoryRepository(), clock=lambda: now)
    task = service.create(TodoCreate(title="Draft", description="Notes", dueDate="2026-10-11"))
    assert isinstance(task.id, UUID)
    assert task.created_at == now
    updated = service.update(task.id, TodoPatch(title="Final", description=None, dueDate=None))
    assert updated.title == "Final"
    assert updated.description is None and updated.due_date is None
    for status in (True, True, False, False):
        updated = service.update(task.id, TodoPatch(isCompleted=status))
        assert updated.is_completed is status
        assert updated.created_at == now
    assert service.update(task.id, TodoPatch()) == updated
    assert service.get(task.id) == updated
    service.delete(task.id)
    for operation in (
        lambda: service.get(task.id),
        lambda: service.delete(task.id),
        lambda: service.update(task.id, TodoPatch()),
    ):
        with pytest.raises(TodoNotFound):
            operation()
