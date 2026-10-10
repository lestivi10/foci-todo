"""Validated request contracts and immutable task snapshots."""

import re
from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StrictBool,
    StringConstraints,
    field_validator,
)


def parse_calendar_date(value: object) -> date | None:
    if value is None:
        return None
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Use a calendar date in YYYY-MM-DD format")
    return date.fromisoformat(value)


Title = Annotated[
    str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=200)
]
Description = Annotated[str, StringConstraints(strict=True, max_length=5000)]
CalendarDate = Annotated[date | None, BeforeValidator(parse_calendar_date)]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TodoCreate(RequestModel):
    title: Title
    description: Description | None = None
    due_date: CalendarDate = Field(default=None, alias="dueDate")
    is_completed: StrictBool = Field(default=False, alias="isCompleted")


class TodoPatch(RequestModel):
    title: Title | None = None
    description: Description | None = None
    due_date: CalendarDate = Field(default=None, alias="dueDate")
    is_completed: StrictBool | None = Field(default=None, alias="isCompleted")

    @field_validator("title", "is_completed", mode="before")
    @classmethod
    def reject_required_nulls(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class Todo(BaseModel):
    model_config = ConfigDict(populate_by_name=True, frozen=True)
    id: UUID
    title: str
    description: str | None
    due_date: date | None = Field(alias="dueDate")
    is_completed: bool = Field(alias="isCompleted")
    created_at: datetime = Field(alias="createdAt")
