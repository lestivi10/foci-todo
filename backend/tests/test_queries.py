from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from todo_app.main import create_app
from todo_app.models import Todo
from todo_app.repository import SQLiteTodoRepository
from todo_app.service import TodoService


@pytest.fixture
def service(tmp_path):
    repository = SQLiteTodoRepository(tmp_path / "tasks.sqlite3")
    now = datetime(2026, 10, 10, 12, tzinfo=UTC)
    fixtures = [
        (1, "alpha", "2026-10-09", False),
        (2, "ALPHA", "2026-10-10", False),
        (3, "Beta", "2026-10-08", True),
        (4, "Zulu", "2026-10-11", False),
        (5, "Undated", None, False),
        (6, "Alpha", "2026-10-09", False),
    ]
    for number, title, due, completed in fixtures:
        repository.add(
            Todo(
                id=UUID(int=number),
                title=title,
                description=None,
                due_date=due,
                is_completed=completed,
                created_at=now + timedelta(minutes=number // 2),
            )
        )
    return TodoService(repository, lambda: now)


def ids(tasks):
    return [task.id.int for task in tasks]


def test_filter_boundaries(service):
    assert set(ids(service.list(status="overdue"))) == {1, 6}
    assert set(ids(service.list(status="completed"))) == {3}
    assert set(ids(service.list(status="incomplete"))) == {1, 2, 4, 5, 6}
    assert set(ids(service.list())) == {1, 2, 3, 4, 5, 6}


@pytest.mark.parametrize(
    ("sort", "order", "expected"),
    [
        ("title", "asc", [1, 2, 6, 3, 5, 4]),
        ("title", "desc", [4, 5, 3, 1, 2, 6]),
        ("dueDate", "asc", [3, 1, 6, 2, 4, 5]),
        ("dueDate", "desc", [4, 2, 1, 6, 3, 5]),
        ("createdAt", "asc", [1, 2, 3, 4, 5, 6]),
        ("createdAt", "desc", [6, 4, 5, 2, 3, 1]),
    ],
)
def test_sort_with_deterministic_ties(service, sort, order, expected):
    assert ids(service.list(sort=sort, order=order)) == expected


def test_filters_compose_with_sorting(service):
    assert ids(service.list(status="incomplete", sort="dueDate", order="desc")) == [4, 2, 1, 6, 5]


def test_http_query_contract(tmp_path):
    with TestClient(
        create_app(db_path=tmp_path / "db", clock=lambda: datetime(2026, 10, 10, tzinfo=UTC))
    ) as client:
        client.post("/api/todos", json={"title": "Old", "dueDate": "2026-10-09"})
        client.post("/api/todos", json={"title": "Today", "dueDate": "2026-10-10"})
        response = client.get("/api/todos?status=overdue&sort=title&order=asc")
        assert response.status_code == 200
        assert [task["title"] for task in response.json()] == ["Old"]
        for query in ("status=bad", "sort=bad", "order=bad"):
            assert client.get(f"/api/todos?{query}").status_code == 422
