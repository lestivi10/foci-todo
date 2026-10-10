# Development record

This record summarizes observed development checkpoints. Git commits contain
passing feature slices rather than intentionally broken intermediate states.

## Specification

- Wrote PLAN.md and SPEC.md before implementation.
- An independent agent reviewed validation, null-versus-omitted updates, UTC
  overdue boundaries, null-last sorting, persistence, and test coverage.
- User confirmed React/TypeScript, FastAPI, SQLite, and a public GitHub repository.
- Delegated backend and frontend to agents with separate file ownership and a
  shared API contract. The coordinating agent owns integration and commits.

## Verification

Implementation test results and any limitations are recorded below as work lands.

### Backend slices

- Schemas/service: observed two missing-module failures, then 18 passing tests.
- SQLite repository: observed missing repository failure, then 20 passing tests.
- HTTP API: wrote API tests before implementation; 31 passing after routes and
  static serving. Required-null validation errors identify the affected field.
- Filters/sorting: observed nine failures (missing service list and ignored API
  filters), then 40 passing tests after implementation.
- Added regression coverage for application restart, storage failure sanitization,
  concurrent field updates, and null errors; 44 tests pass. These added checks
  verified existing behavior rather than manufacturing a red phase.
- Ruff checks and formatting pass. Runtime dependency audit found no known
  vulnerabilities. Starlette emits one upstream deprecation warning for its
  still-supported HTTPX test adapter.

### Frontend and independent review

- API client and UI tests initially failed on missing modules; API boundary then
  passed four tests, and full UI implementation passed 11 tests.
- Independent review identified two defects: early calendar years displayed in
  the twentieth century, and edit dialogs could close while saving. Added two
  failing regression tests, fixed both, and observed 13 passing frontend tests.
- Browser accessibility checks exposed insufficient muted-text contrast; colors
  were adjusted and the checks passed.
- Upgraded Vitest after npm audit identified advisories; npm audit now reports
  zero known vulnerabilities, including development dependencies.
- TypeScript checking, production build, and Prettier check pass.
- Desktop/mobile browser CRUD and accessibility suite: four tests passed against
  the real API, including optional-field clearing and keyboard focus restoration.
- Visual inspection also identified populated-list mobile overflow with long
  descriptions; added an explicit populated-page width regression.
- The expanded width check failed on desktop and mobile. Constraining both the
  workspace and task-list grid tracks fixed the overflow; both viewport checks
  and their accessibility/focus checks then passed.

### Packaging

- Built the multi-stage Docker image successfully and validated Compose config.
- Container smoke test passed: served the compiled SPA and health endpoint,
  created and completed a task, replaced the container with the same volume,
  verified the exact persisted record, deleted it, and cleaned up test resources.
- CI runs the backend checks, frontend checks/build, browser journeys, and container
  smoke test in separate jobs.
