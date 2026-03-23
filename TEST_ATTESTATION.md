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

## Current Prepared Entry

- Task ID: `T-001`
- Date: `2026-03-23`
- Branch: `codex/ci-cd-bootstrap` (planned)
- Commit SHA: `TBD`
- Spec References: `BASELINE.md`, `WORKFLOW.md`
- Scope: Set up minimal CI/CD pipeline for lint + build.

### Required Automated Checks

- [ ] `npm run lint`
- [ ] `npm run build`

### Required Smoke Checks (OIDC Baseline)

- [ ] `GET /.well-known/openid-configuration` returns canonical endpoints
- [ ] `GET /.well-known/jwks.json` returns keys
- [ ] `POST /api/oauth/token` invalid request returns expected error
- [ ] `GET /api/oauth/userinfo` without bearer returns expected error

### Results

- Automated checks: pending
- Smoke checks: pending
- Failures found: pending
- Fix commit(s): pending
- Final result: pending
- Reviewer approval: pending

