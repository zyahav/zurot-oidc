# ZurOt Strict Delivery Workflow

This is the mandatory delivery flow for all work in this repository.

## 1) Plan

- Define scope in one sentence.
- Link the governing spec(s): architecture docs + `BASELINE.md`.
- Create or update exactly one task row in `TASKS.md`.
- Set task status to `PLANNED`.

## 2) Test Attestation Before Development

- Open `TEST_ATTESTATION.md`.
- Add the task ID, current commit SHA, and required checks.
- Mark expected checks for this task (automated + manual smoke).
- Do not start coding before this section is prepared.

## 3) Develop

- Create a feature branch from `main` with prefix `codex/`.
- Implement only what is in the task row scope.
- Keep changes minimal and reversible.
- Update task status to `IN_PROGRESS`.

## 4) Verify

- Run required automated checks.
- Run required smoke checks.
- Record all outputs and pass/fail in `TEST_ATTESTATION.md`.
- If any check fails, task status becomes `BLOCKED` until fixed.

## 5) Approve

- Verify Definition of Done (below).
- Update task status to `APPROVED`.
- Merge only after approval.

## 6) Handoff

- Update `SESSION_STATE.md` with:
  - what was completed,
  - exact commit/branch,
  - next single task.
- Keep handoff short and unambiguous.

## Task Status Values (Only These)

- `PLANNED`
- `IN_PROGRESS`
- `BLOCKED`
- `READY_FOR_REVIEW`
- `APPROVED`
- `DONE`

## Definition of Ready

- Task has one-line scope.
- Task has spec reference.
- Task has explicit acceptance checks.
- Task row exists in `TASKS.md`.

## Definition of Done

- Scope delivered.
- Required checks passed and recorded in `TEST_ATTESTATION.md`.
- `TASKS.md` status is `DONE`.
- `SESSION_STATE.md` updated.

