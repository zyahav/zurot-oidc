# Session State

## Last Stable Point

- Branch: `main`
- Current HEAD commit: `ddeee48`
- T-001 merge commit: `c28573f`
- Baseline stabilization commit: `fc2ada5`
- Working tree at last check: clean

## Current Process Mode

- Operating model: baseline-first, spec-driven
- Workflow file: `WORKFLOW.md`
- Task source of truth: `TASKS.md`
- Test audit log: `TEST_ATTESTATION.md`

## Next Task

- ID: `T-002`
- Title: Add minimal smoke tests for OIDC contract
- Status: `PLANNED`
- Next action: create `codex/smoke-tests` branch and implement smoke checks for discovery, JWKS, token invalid request, and userinfo unauthorized.

## Resume Checklist (for new session)

- Confirm `git status` is clean
- Confirm active task row in `TASKS.md`
- Confirm attestation entry is prepared in `TEST_ATTESTATION.md`
- Start implementation only after those checks
