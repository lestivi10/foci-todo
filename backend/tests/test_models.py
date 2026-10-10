import pytest
from pydantic import ValidationError

from todo_app.models import TodoCreate, TodoPatch


def test_creation_defaults_and_title_normalization():
    task = TodoCreate(title="  Read the brief  ")
    assert task.title == "Read the brief"
    assert task.description is None
    assert task.due_date is None
    assert task.is_completed is False


@pytest.mark.parametrize(
    "fields",
    [
        {"title": " "},
        {"title": "x" * 201},
        {"title": 42},
        {"description": "x" * 5001},
        {"dueDate": "2026-02-29"},
        {"dueDate": "2024-2-01"},
        {"dueDate": "2024-01-01T00:00:00Z"},
        {"dueDate": 123},
        {"isCompleted": "true"},
        {"isCompleted": 1},
        {"isCompleted": None},
        {"id": "override"},
        {"createdAt": "override"},
    ],
)
def test_invalid_creation(fields):
    with pytest.raises(ValidationError):
        TodoCreate.model_validate({"title": "Valid", **fields})


def test_calendar_date_and_null_optional_fields():
    task = TodoCreate(title="Leap", dueDate="2024-02-29")
    assert task.due_date.isoformat() == "2024-02-29"
    assert TodoPatch(description=None, dueDate=None).model_dump(exclude_unset=True) == {
        "description": None,
        "due_date": None,
    }
    assert TodoPatch().model_dump(exclude_unset=True) == {}


@pytest.mark.parametrize("fields", [{"title": None}, {"isCompleted": None}])
def test_patch_cannot_clear_required_fields(fields):
    with pytest.raises(ValidationError):
        TodoPatch.model_validate(fields)
