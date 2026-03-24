# ZurOt Flat Task List

Single source of task truth. Keep this list flat and ordered.

| ID | Task | Status | Spec Reference | Required Checks | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| T-001 | Set up CI/CD pipeline (lint + build on push/PR) | DONE | BASELINE.md, WORKFLOW.md | `npm run lint`, `npm run build` in CI | Team | `codex/ci-cd-bootstrap` | Completed via PR #11; CI run `23500082111` green (lint + build) |
| T-002 | Add minimal smoke tests for OIDC contract | DONE | BASELINE.md | Discovery, JWKS, token invalid request, userinfo unauthorized | Team | `codex/smoke-tests` | Completed via PR #12; CI green (lint + build + smoke) |
| T-003 | Replace harness homepage with real product homepage | DONE | BASELINE.md, docs/implementation/t-003-homepage-spec.md | `npm run lint`, `npm run build`, homepage smoke | Team | `codex/homepage` | Completed via PR #13; CI run `23504247211` green (lint + build) |
| T-004 | Implement profile edit (mutation + UI) | DONE | docs/implementation/t-004-profile-edit-spec.md | CRUD smoke + lint/build | Team | `codex/profile-edit` | Completed via PR #14; CI run `23507259902` green (lint + build) |
| T-005 | Implement logout/session strategy for federation | DONE | docs/implementation/t-005-logout-spec.md, docs/implementation/t-005-logout-decisions.md | logout flow smoke + lint/build | Team | `codex/logout-strategy` | Completed via PR #15; CI green (lint + build) |
| T-006 | Integrate first federated app end-to-end | PLANNED | docs/integration/federated-app-integration-guide.md | full auth/logout smoke + lint/build | Team | `codex/first-federated-app` | Validate real consumer behavior |
