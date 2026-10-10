"""FastAPI composition root, HTTP translation, and optional same-origin SPA serving."""

import logging
import os
import sqlite3
from collections.abc import Callable
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse

from todo_app.models import Todo, TodoCreate, TodoPatch
from todo_app.repository import SQLiteTodoRepository
from todo_app.service import TodoNotFound, TodoService, utc_now

logger = logging.getLogger(__name__)


def create_app(
    db_path: str | Path | None = None,
    clock: Callable[[], datetime] | None = None,
    static_dir: str | Path | None = None,
) -> FastAPI:
    """Create isolated application instances; open storage only during startup."""
    database = db_path if db_path is not None else os.getenv("TODO_DB_PATH", "data/todos.sqlite3")
    static_root = static_dir if static_dir is not None else os.getenv("TODO_STATIC_DIR")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.service = TodoService(SQLiteTodoRepository(database), clock or utc_now)
        yield

    app = FastAPI(title="Foci To-do API", version="1.0.0", lifespan=lifespan)

    @app.exception_handler(TodoNotFound)
    async def not_found(_request, _exception):
        return JSONResponse(status_code=404, content={"detail": "Task not found"})

    @app.exception_handler(sqlite3.Error)
    async def storage_error(_request, exception):
        logger.error("Task storage operation failed", exc_info=exception)
        return JSONResponse(
            status_code=503, content={"detail": "Task storage is temporarily unavailable"}
        )

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.post("/api/todos", response_model=Todo, status_code=201)
    def create_task(payload: TodoCreate, response: Response):
        task = app.state.service.create(payload)
        response.headers["Location"] = f"/api/todos/{task.id}"
        return task

    @app.get("/api/todos", response_model=list[Todo])
    def list_tasks():
        return app.state.service.repository.list()

    @app.get("/api/todos/{task_id}", response_model=Todo)
    def get_task(task_id: UUID):
        return app.state.service.get(task_id)

    @app.patch("/api/todos/{task_id}", response_model=Todo)
    def update_task(task_id: UUID, payload: TodoPatch):
        return app.state.service.update(task_id, payload)

    @app.delete("/api/todos/{task_id}", status_code=204)
    def delete_task(task_id: UUID):
        app.state.service.delete(task_id)
        return Response(status_code=204)

    if static_root:
        root = Path(static_root).resolve()

        @app.get("/{path:path}", include_in_schema=False)
        def frontend(path: str):
            if path == "api" or path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not found")
            candidate = (root / path).resolve()
            if not candidate.is_relative_to(root):
                raise HTTPException(status_code=404, detail="Not found")
            if candidate.is_file():
                return FileResponse(candidate)
            # Missing assets must not receive HTML with a misleading success status.
            if Path(path).suffix or not (root / "index.html").is_file():
                raise HTTPException(status_code=404, detail="Not found")
            return FileResponse(root / "index.html")

    return app


app = create_app()
