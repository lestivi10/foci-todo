# Implementation plan

## Goal and scope

Build a small, maintainable single-user to-do application for the Foci Solutions
take-home. Deliver every core requirement and all four optional enhancements:
filtering, sorting, validation, and Docker. Prioritize readable architecture and
behavioral tests while providing an accessible, responsive React interface.

SDD means specification-driven development here. Write behavior and API contracts
before implementation; use TDD for domain rules, HTTP behavior, and critical UI
interactions. Keep commits small and coherent, normally committing a passing
test/implementation slice after observing the test fail.

## Selected stack

- React + TypeScript + Vite for the SPA.
- FastAPI + Pydantic for the HTTP boundary and validation.
- SQLite through Python's standard library, behind a small repository interface.
- pytest for service/repository/API tests; Vitest + Testing Library for UI tests;
  Playwright for a small real-browser acceptance suite.
- Docker multi-stage build: compile the SPA, serve it and the API from one Python
  container, persist SQLite in a mounted volume.

SQLite supplies transactions and restart persistence without a database server.
Keep HTTP handlers thin, business rules in a service, and SQL in the repository.
Use synchronous operations for this modest workload. Avoid a generic ORM layer,
authentication, collaboration, recurring tasks, and unrelated feature expansion.

## Delivery sequence and commit checkpoints

1. Record specification, assumptions, API contract, and architecture decisions.
2. Bootstrap backend tooling; drive validation and task lifecycle with tests.
3. Add SQLite persistence and restart/transaction tests.
4. Expose API CRUD/status operations and error-contract tests.
5. Implement filtering/sorting with fixed-clock boundary and ordering tests.
6. Bootstrap the SPA and typed API boundary.
7. Implement creation, list/detail/edit/delete, completion, and error states with
   interaction tests; then filter/sort controls and responsive styling.
8. Exercise the complete workflow against the real API in a browser.
9. Add container packaging, persistent volume, CI, and reviewer documentation.
10. Run the final verification matrix, review the diff/history, and push.

The orchestrator owns integration, contracts, commits, and final verification.
Delegate backend and frontend implementation only after their shared contract
is written; delegate independent review to challenge edge cases. Agents must
stay within assigned files and report observed red/green tests.

## Behavioral decisions

- A single local user; no authentication. Bind local development to loopback.
- Server-generated UUID and UTC creation timestamp; clients cannot overwrite them.
- Trim titles, require 1–200 characters after trimming; description <= 5,000.
- Due dates are date-only ISO values; null clears an optional field on edit.
- PATCH preserves omitted fields and rejects null title/status and unknown fields.
- Complete/incomplete set an explicit boolean (idempotent), rather than toggle.
- Overdue means incomplete and due before today's UTC date; today is not overdue.
- Filter values: all, incomplete, completed, overdue.
- Sort values: createdAt, dueDate, title; direction: asc/desc. Missing due dates
  always last; deterministic ID tie-breaker. Default newest-created first.
- Invalid input returns 422; unknown valid IDs return 404; create 201;
  successful delete 204. No seeded user data.

## Verification and submission

Cover whitespace/limits, invalid/calendar dates, unknown IDs/fields, optional
field clearing, complete/incomplete repetition, persistence after reopen,
filter combinations and date boundaries, stable sorting, HTTP statuses, UI
loading/empty/failure states, keyboard interaction, and a real CRUD journey.

README will include native and Docker setup, test commands, architecture,
assumptions, tradeoffs, and an honest AI-assistance note. Commit history records
the actual development sequence; do not manufacture or backdate commits.

## Confirmed selections

- React/TypeScript SPA, FastAPI, and SQLite approved by the user.
- Public repository: https://github.com/lestivi10/foci-todo.
