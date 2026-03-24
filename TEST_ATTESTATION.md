# Test Attestation Log

Use this file as a strict audit log for each task.

## Entry Template

- Task ID:
- Date:
- Branch:
- Commit SHA:
- Spec References:
- Scope:

### Required Automated Checks

- [ ] `npm run lint`
- [ ] `npm run build`

### Required Smoke Checks (OIDC Baseline)

- [ ] `GET /.well-known/openid-configuration` returns canonical endpoints
- [ ] `GET /.well-known/jwks.json` returns keys
- [ ] `POST /api/oauth/token` invalid request returns expected error
- [ ] `GET /api/oauth/userinfo` without bearer returns expected error

### Results

- Automated checks:
- Smoke checks:
- Failures found:
- Fix commit(s):
- Final result: `PASS` or `FAIL`
- Reviewer approval:

---

## Completed Entry

- Task ID: `T-001`
- Date: `2026-03-24`
- Branch: `codex/ci-cd-bootstrap`
- Commit SHA: `c28573f` (merged to `main`)
- Spec References: `BASELINE.md`, `WORKFLOW.md`
- Scope: Set up minimal CI/CD pipeline for lint + build.

### Required Automated Checks

- [x] `npm run lint`
- [x] `npm run build`

### Required Smoke Checks (OIDC Baseline)

- [x] `GET /.well-known/openid-configuration` returns canonical endpoints
- [x] `GET /.well-known/jwks.json` returns keys
- [x] `POST /api/oauth/token` invalid request returns expected error
- [x] `GET /api/oauth/userinfo` without bearer returns expected error

### Results

- Automated checks: CI run `23500082111` passed (`lint` and `build` green).
- Smoke checks: Live onboarding and endpoint validation passed end-to-end (login, discovery, JWKS, token invalid request, userinfo unauthorized).
- Failures found: earlier CI runs failed due to missing GitHub secrets; resolved by documenting and applying secret setup.
- Fix commit(s): `cfd3d7c`, `a7f6bc3`, `c677f71`, `3d86842`, `60742e3`, `249d9ad`, `a209a78`, `9239d29`.
- Final result: `PASS`
- Reviewer approval: PM + advisor verified; live onboarding test passed.

---

## Current Prepared Entry

- Task ID: `T-002`
- Date: `2026-03-24`
- Branch: `codex/smoke-tests` (planned)
- Commit SHA: `TBD` (pending commit for T-002 branch)
- Spec References: `BASELINE.md`
- Scope: Add minimal smoke tests for OIDC contract.

### Required Automated Checks

- [x] `npm run lint`
- [x] `npm run build`

### Required Smoke Checks (OIDC Baseline)

- [x] `GET /.well-known/openid-configuration`
- [x] `GET /.well-known/jwks.json`
- [x] `POST /api/oauth/token` invalid request
- [x] `GET /api/oauth/userinfo` unauthorized

### Results

- Automated checks: local `npm run lint` and `npm run build` passed.
- Smoke checks: local `npm run smoke:oidc` and `make smoke-oidc` passed all four OIDC endpoint checks.
- Failures found: initial smoke script relied on external running server; fixed with self-starting smoke runner.
- Fix commit(s): pending branch commit.
- Final result: pending review
- Reviewer approval: pending
