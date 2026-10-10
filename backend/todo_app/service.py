"""Task operations independent of HTTP and the persistence implementation."""

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Literal, Protocol
from uuid import UUID, uuid4

from todo_app.models import Todo, TodoCreate, TodoPatch

Status = Literal["all", "incomplete", "completed", "overdue"]
Sort = Literal["createdAt", "dueDate", "title"]
Order = Literal["asc", "desc"]


class TodoRepository(Protocol):
    def list(self) -> list[Todo]: ...
    def get(self, task_id: UUID) -> Todo | None: ...
    def add(self, task: Todo) -> None: ...
    def update(self, task_id: UUID, changes: dict) -> Todo | None: ...
    def delete(self, task_id: UUID) -> bool: ...


class TodoNotFound(Exception):
    """The requested task does not exist."""


def utc_now() -> datetime:
    return datetime.now(UTC)


class TodoService:
    def __init__(self, repository: TodoRepository, clock: Callable[[], datetime] = utc_now):
        self.repository = repository
        self.clock = clock

    def create(self, payload: TodoCreate) -> Todo:
        task = Todo(id=uuid4(), created_at=self.clock(), **payload.model_dump())
        self.repository.add(task)
        return task

    def get(self, task_id: UUID) -> Todo:
        task = self.repository.get(task_id)
        if task is None:
            raise TodoNotFound
        return task

    def update(self, task_id: UUID, payload: TodoPatch) -> Todo:
        task = self.repository.update(task_id, payload.model_dump(exclude_unset=True))
        if task is None:
            raise TodoNotFound
        return task

    def delete(self, task_id: UUID) -> None:
        if not self.repository.delete(task_id):
            raise TodoNotFound

    def list(
        self, status: Status = "all", sort: Sort = "createdAt", order: Order = "desc"
    ) -> list[Todo]:
        today = self.clock().astimezone(UTC).date()
        tasks = self.repository.list()
        if status == "completed":
            tasks = [task for task in tasks if task.is_completed]
        elif status == "incomplete":
            tasks = [task for task in tasks if not task.is_completed]
        elif status == "overdue":
            tasks = [
                task
                for task in tasks
                if not task.is_completed and task.due_date is not None and task.due_date < today
            ]

        # Stable passes preserve ascending IDs for ties, regardless of primary direction.
        tasks.sort(key=lambda task: task.id)
        if sort == "title":
            tasks.sort(key=lambda task: task.title.casefold(), reverse=order == "desc")
        elif sort == "dueDate":
            tasks.sort(key=lambda task: task.due_date or date.max, reverse=order == "desc")
            tasks.sort(key=lambda task: task.due_date is None)
        else:
            tasks.sort(key=lambda task: task.created_at, reverse=order == "desc")
        return tasks
