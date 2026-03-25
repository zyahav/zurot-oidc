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

## Completed Entry

- Task ID: `T-002`
- Date: `2026-03-24`
- Branch: `codex/smoke-tests`
- Commit SHA: `61c9101` (merged to `main`)
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

- Automated checks: CI run `23500082111` passed (`lint` and `build` green).
- Smoke checks: CI run `23500082111` smoke step passed; local `npm run smoke:oidc` and `make smoke-oidc` also passed all four endpoint checks.
- Failures found: initial smoke script relied on external running server; fixed with self-starting smoke runner.
- Fix commit(s): `6b36937`, `61d9578`.
- Final result: `PASS`
- Reviewer approval: PM + advisor verified; PR #12 CI green and merged.

---

## Completed Entry

- Task ID: `T-003`
- Date: `2026-03-24`
- Branch: `codex/homepage`
- Commit SHA: `66c9017` (merged to `main`)
- Spec References: `BASELINE.md`, `docs/implementation/t-003-homepage-spec.md`
- Scope: Replace homepage with 3-state identity shell and move harness to `/internal`.

### Required Automated Checks

- [x] `npm run lint`
- [x] `npm run build`

### Required Smoke Checks (T-003 Homepage)

- [x] Signed out renders State 1 (login-only shell)
- [x] Signed in + no active profile renders State 2 (profile picker)
- [x] Selecting a profile transitions State 2 → State 3
- [x] Switch profile transitions State 3 → State 2
- [x] `/internal` route still renders harness

### Results

- Automated checks: PR #13 CI run `23504247211` passed (`lint` and `build` green).
- Smoke checks: live verification confirmed State 2 rendering correctly with no profile, `/internal` available, and state machine behavior matches spec.
- Failures found: none after final implementation.
- Fix commit(s): `ec59f2d`.
- Final result: `PASS`
- Reviewer approval: advisor + PM verified implementation and approved merge.

---

## Completed Entry

- Task ID: `T-004`
- Date: `2026-03-24`
- Branch: `codex/profile-edit`
- Commit SHA: `1c65500` (merged to `main`)
- Spec References: `BASELINE.md`, `docs/implementation/t-004-profile-edit-spec.md`
- Scope: Add profile edit mutation and inline edit UI in `/internal`.

### Required Automated Checks

- [x] `npm run lint`
- [x] `npm run build`

### Required Smoke Checks (T-004 Profile Edit)

- [x] Edit button visible only for active profiles in `/internal`
- [x] Editing display name updates reactively
- [x] Editing avatar URL updates reactively
- [x] Empty display name is blocked (client + server)
- [x] Invalid avatar URL is blocked (client + server)
- [x] `make smoke-oidc` still passes

### Results

- Automated checks: PR #14 CI run `23507259902` passed (`lint` and `build` green).
- Smoke checks: local `make quality` passed, including profile edit behavior in `/internal` and baseline OIDC smoke checks.
- Failures found: none at merge closeout.
- Fix commit(s): `4871b4e`, `2ace254`, `e9192ed`.
- Final result: `PASS`
- Reviewer approval: PM + advisor approved closeout after CI green.

---

## Completed Entry

- Task ID: `T-005`
- Date: `2026-03-24`
- Branch: `codex/logout-strategy`
- Commit SHA: `27e4d95` (merged to `main`)
- Spec References: `BASELINE.md`, `docs/implementation/t-005-logout-spec.md`, `docs/implementation/t-005-logout-decisions.md`
- Scope: Harden logout and profile-switch behavior, including State 2 logout access and smoke checks.

### Required Automated Checks

- [x] `npm run lint`
- [x] `npm run build`

### Required Smoke Checks (T-005 Logout Strategy)

- [x] `GET /` returns 200
- [x] `GET /internal` returns 200
- [x] `GET /.well-known/openid-configuration` returns canonical endpoints
- [x] `GET /.well-known/jwks.json` returns keys
- [x] `POST /api/oauth/token` invalid request returns expected error
- [x] `GET /api/oauth/userinfo` without bearer returns expected error

### Results

- Automated checks: PR #15 CI green (`lint` and `build` passed).
- Smoke checks: local `make quality` passed with added `/` and `/internal` checks plus all OIDC baseline checks.
- Failures found: sync error flow was initially blocking; fixed by replacing blocking return with non-blocking dismissible warning. Redirect-following false-pass risk in smoke checks fixed by manual redirect mode.
- Fix commit(s): `29a5095`, `11d0421`, `6d54a3e`.
- Final result: `PASS`
- Reviewer approval: PM + advisor verification complete; approved for merge.

---

## Completed Entry

- Task ID: `T-006`
- Date: `2026-03-24`
- Branch: `codex/first-federated-app`
- Commit SHA: `8b25a1a` (merged to `main`)
- Spec References: `BASELINE.md`, `docs/implementation/t-006-first-federated-app-spec.md`
- Scope: Register first federated client and add idempotent client seed script/tooling.

### Required Automated Checks

- [x] `npm run lint`
- [x] `npm run build`

### Required Smoke Checks (T-006 First Federated App)

- [x] `make seed-clients` runs without error
- [x] `GET /` returns 200
- [x] `GET /internal` returns 200
- [x] `GET /.well-known/openid-configuration` returns canonical endpoints
- [x] `GET /.well-known/jwks.json` returns keys
- [x] `POST /api/oauth/token` invalid request returns expected error
- [x] `GET /api/oauth/userinfo` without bearer returns expected error

### Results

- Automated checks: PR #16 CI run `23520193158` passed (`lint` and `build` green).
- Smoke checks: local `make quality` passed; `make seed-clients` succeeded and smoke endpoints all passed.
- Failures found: initial seed execution failed in sandbox due network restriction; resolved by rerunning outside sandbox. No product code defects remained.
- Fix commit(s): `e7764c3`, `c81de58`.
- Final result: `PASS`
- Reviewer approval: PM + advisor validated token-contract evidence and approved merge.

#### Token Claim Evidence (Completed Flow)

- `iss`: `http://localhost:3000`
- `aud`: `mall-hebrew-adventures`
- `sub`: `profile_js71q9tyv7a18efcz8amqnf18n83kj18`
- `account_id`: `account_jx7cdeef3vfwczg4mchm2w70gs83kqmf`
- `name`: `Seed T006 1774401198`
- `preferred_username`: `seedt0061774401198`
- `token_type`: `Bearer`
- `expires_in`: `900`

---

## Completed Entry

- Task ID: `T-007`
- Date: `2026-03-25`
- Branch: `codex/game-translation`
- Commit SHA: `84f0d2a` (merged to `main`)
- Spec References: `docs/implementation/t-007-translation-engine-game-spec.md`
- Scope: Add game product translation mappings, explicit client mapping, and scope isolation enforcement.

### Required Automated Checks

- [x] `npm run lint`
- [x] `npm run build`

### Required Smoke Checks (T-007 Translation Engine)

- [x] 7 translation-engine test cases pass
- [x] `GET /` returns 200
- [x] `GET /internal` returns 200
- [x] `GET /.well-known/openid-configuration` returns canonical endpoints
- [x] `GET /.well-known/jwks.json` returns keys
- [x] `POST /api/oauth/token` invalid request returns expected error
- [x] `GET /api/oauth/userinfo` without bearer returns expected error

### Results

- Automated checks: PR #17 CI run `23530828381` passed (`lint` and `build` green).
- Smoke checks: local `make quality` passed; baseline smoke endpoints all green.
- Failures found: none.
- Fix commit(s): `cef3657`.
- Final result: `PASS`
- Reviewer approval: PM + advisor verification complete; approved for merge.
