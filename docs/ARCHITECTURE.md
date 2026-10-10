# Architecture decisions

## A small web application with a durable local store

The primary interface is a React SPA written in TypeScript. FastAPI supplies a
JSON API; SQLite stores tasks in a local file. These choices fit the author's
preferred technologies and keep the application's operational requirements small.
SQLite avoids a separate database service while giving atomic writes and durable
storage. Python's standard sqlite3 module is sufficient for one resource.

```text
React components → typed API client → FastAPI routes
                                          ↓
                                     task service
                                          ↓
                                 repository interface
                                          ↓
                                  SQLite repository
```

Routes handle HTTP concerns, schemas validate the boundary, the service owns task
behavior, and the repository owns SQL and connection lifetimes. Dependencies are
assembled by an application factory. A controllable clock makes overdue rules
testable. The repository interface is specific to tasks, not a generic data
framework. Neither the service nor SQL layer needs React or browser knowledge.

## Deployment and development

In development, Vite proxies /api to FastAPI. The production container builds the
SPA and serves its assets and the API from the same origin, avoiding unnecessary
CORS configuration. A named volume persists the SQLite database independently
of the container. The application is intended for local single-user use; it does
not implement authentication or multi-user isolation.

## Dates and updates

Due dates are calendar dates. They are never converted into local timestamp
offsets for display. Creation timestamps are UTC instants. Overdue uses the UTC
calendar date so API and UI agree on one documented policy. A future multi-user
version would likely need a per-user timezone policy.

PATCH expresses partial changes, including explicit null for clearing optional
fields. Completion is assigned as a boolean so retrying a request cannot toggle
a task back accidentally. The server owns identity and creation timestamps.

## Testing and specification

The specification in SPEC.md defines observable behavior before implementation.
Tests exercise that behavior at the narrowest useful boundary: service rules,
real SQLite persistence, HTTP contracts, UI interactions, and a small browser
acceptance suite. Database tests use isolated temporary files; browser tests use
their own database. Network calls are replaced at the UI test boundary, but
end-to-end tests run the real frontend and backend together.

For TDD slices, observe a meaningful failing test, implement the behavior, then
refactor and commit when checks pass. Keep a brief record of actual checks in
DEVELOPMENT.md. Avoid tests that simply restate component internals or assert
private implementation details.

## Deliberate limits

No authentication, real-time synchronization, recurring tasks, pagination, or
generic infrastructure. Listing a personal to-do collection in memory is an
acceptable scope tradeoff. SQLite fits this workload; scaling to shared hosting
would require revisiting authorization, migrations, write contention, backups,
and deployment configuration. These are not prerequisites for this assignment.
