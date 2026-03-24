# ZurOt Flat Task List

Single source of task truth. Keep this list flat and ordered.

| ID | Task | Status | Spec Reference | Required Checks | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| T-001 | Set up CI/CD pipeline (lint + build on push/PR) | DONE | BASELINE.md, WORKFLOW.md | `npm run lint`, `npm run build` in CI | Team | `codex/ci-cd-bootstrap` | Completed via PR #11; CI run `23500082111` green (lint + build) |
| T-002 | Add minimal smoke tests for OIDC contract | DONE | BASELINE.md | Discovery, JWKS, token invalid request, userinfo unauthorized | Team | `codex/smoke-tests` | Completed via PR #12; CI green (lint + build + smoke) |
| T-003 | Replace harness homepage with real product homepage | PLANNED | BASELINE.md, docs/integration/federated-app-integration-guide.md | `npm run lint`, `npm run build`, homepage smoke | Team | `codex/homepage` | Keep OIDC test page available internally |
| T-004 | Implement profile edit (mutation + UI) | PLANNED | docs/implementation/phase-0-hub-profile-authority.md | CRUD smoke + lint/build | Team | `codex/profile-edit` | Create/archive already exists |
| T-005 | Implement logout/session strategy for federation | PLANNED | docs/implementation/phase-1/oidc-provider-implementation-pack.md, BASELINE.md | logout flow smoke + lint/build | Team | `codex/logout-strategy` | Must complete before first federated app |
| T-006 | Integrate first federated app end-to-end | PLANNED | docs/integration/federated-app-integration-guide.md | full auth/logout smoke + lint/build | Team | `codex/first-federated-app` | Validate real consumer behavior |
