from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from todo_app.main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(
        create_app(
            db_path=tmp_path / "tasks.sqlite3", clock=lambda: datetime(2026, 10, 10, 12, tzinfo=UTC)
        )
    ) as client:
        yield client


def test_http_lifecycle(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/todos").json() == []
    response = client.post("/api/todos", json={"title": "  Plan  ", "description": "Draft"})
    assert response.status_code == 201
    task = response.json()
    location = response.headers["location"]
    assert location == f"/api/todos/{task['id']}"
    assert task == {
        "id": task["id"],
        "title": "Plan",
        "description": "Draft",
        "dueDate": None,
        "isCompleted": False,
        "createdAt": "2026-10-10T12:00:00Z",
    }
    assert client.get(location).json() == task
    changed = client.patch(location, json={"description": None, "dueDate": "2026-10-12"}).json()
    assert changed["description"] is None
    assert changed["dueDate"] == "2026-10-12"
    assert changed["title"] == "Plan"
    for status in (True, True, False):
        updated = client.patch(location, json={"isCompleted": status})
        assert updated.status_code == 200
        assert updated.json()["isCompleted"] is status
        assert updated.json()["createdAt"] == task["createdAt"]
    assert client.patch(location, json={}).status_code == 200
    deleted = client.delete(location)
    assert deleted.status_code == 204 and deleted.content == b""
    assert client.get("/api/todos").json() == []
    for response in (
        client.get(location),
        client.delete(location),
        client.patch(location, json={}),
    ):
        assert response.status_code == 404
        assert response.json() == {"detail": "Task not found"}


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_invalid_and_missing_ids(client, method):
    kwargs = {"json": {}} if method == "patch" else {}
    assert getattr(client, method)("/api/todos/not-a-uuid", **kwargs).status_code == 422
    assert getattr(client, method)(f"/api/todos/{uuid4()}", **kwargs).status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"title": " "},
        {"title": None},
        {"dueDate": "2026-02-29"},
        {"isCompleted": "false"},
        {"isCompleted": None},
        {"createdAt": "2020-01-01"},
    ],
)
def test_invalid_writes_are_atomic(client, payload):
    task = client.post("/api/todos", json={"title": "Original"}).json()
    response = client.patch(f"/api/todos/{task['id']}", json=payload)
    assert response.status_code == 422
    assert "detail" in response.json()
    assert client.get(f"/api/todos/{task['id']}").json() == task
    response = client.post("/api/todos", json={"title": "Valid", **payload})
    assert response.status_code == 422
    assert len(client.get("/api/todos").json()) == 1


def test_unknown_api_route_is_not_spa(tmp_path):
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<h1>App shell</h1>")
    (static / "asset.js").write_text("console.log('asset')")
    with TestClient(create_app(db_path=tmp_path / "db", static_dir=static)) as client:
        assert client.get("/").text == "<h1>App shell</h1>"
        assert client.get("/tasks/123").text == "<h1>App shell</h1>"
        assert client.get("/asset.js").text == "console.log('asset')"
        assert client.get("/api/unknown").status_code == 404
        assert client.get("/api").status_code == 404
        assert client.get("/missing.js").status_code == 404


def test_validation_errors_identify_required_field(client):
    task = client.post("/api/todos", json={"title": "Keep"}).json()
    for field in ("title", "isCompleted"):
        response = client.patch(f"/api/todos/{task['id']}", json={field: None})
        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == ["body", field]


def test_database_failure_does_not_expose_internal_details(client, monkeypatch):
    import sqlite3

    def broken_list():
        raise sqlite3.OperationalError("private/path/database.sqlite3 is broken")

    monkeypatch.setattr(client.app.state.service.repository, "list", broken_list)
    response = client.get("/api/todos")
    assert response.status_code == 503
    assert response.json() == {"detail": "Task storage is temporarily unavailable"}
    assert "private/path" not in response.text


def test_application_restart_retains_mutations(tmp_path):
    path = tmp_path / "persisted.sqlite3"
    with TestClient(create_app(db_path=path)) as first:
        task = first.post("/api/todos", json={"title": "Persist"}).json()
        removed = first.post("/api/todos", json={"title": "Remove"}).json()
        first.patch(f"/api/todos/{task['id']}", json={"isCompleted": True, "description": "Saved"})
        first.delete(f"/api/todos/{removed['id']}")
    with TestClient(create_app(db_path=path)) as restarted:
        tasks = restarted.get("/api/todos").json()
        assert len(tasks) == 1
        assert tasks[0]["id"] == task["id"]
        assert tasks[0]["isCompleted"] is True
        assert tasks[0]["description"] == "Saved"
        assert tasks[0]["createdAt"] == task["createdAt"]
