# Session State

## Last Stable Point

- Branch: `codex/profiles-v2-adoption`
- Current HEAD commit: `c5e33d1`
- Previous main HEAD: `0057bad`
- Working tree at last check: clean

## Current Process Mode

- Operating model: baseline-first, spec-driven
- Workflow file: `WORKFLOW.md`
- Task source of truth: `TASKS.md`
- Test audit log: `TEST_ATTESTATION.md`

## What Was Completed This Session

Profiles v2.2 spec full adoption — 5 phases implemented and committed:

- Phase 1: Schema (activeProfiles + sessionId, profiles emoji/color/pinHash, appPermissions)
- Phase 2: Convex queries (all 9 mutations/queries rewritten, sessionId scoping via JWT template)
- Phase 3: JWT token contract (preferred_username computed, handle removed)
- Phase 4: Routes (/profiles, /profiles/manage, /portal, /launch/:appId)
- Phase 5: Full frontend (profile selection, PIN modal, management dashboard, portal hub, launch screen)

QA infrastructure added:
- playwright.config.ts, scripts/qa/global.setup.ts, scripts/qa/run2.spec.ts (14 tests)
- @clerk/testing properly integrated for headless Clerk auth
- Clerk JWT template updated: sessionId: {{session.id}} added

Clerk JWT note: sessionId claim added to Convex template in Clerk dashboard.
Code reads identity.sessionId ?? identity.sid, with tokenIdentifier fallback.

## Next Task — QA Stabilization (BLOCKED)

- ID: `T-009` (add to TASKS.md)
- Title: QA suite full-run stabilization — 3 intermittent failures
- Status: `BLOCKED`
- Branch: continue on `codex/profiles-v2-adoption`

### The 3 remaining failures (full-suite mode only, pass in isolation)

**Failure 1 — Test 6: PIN flow final navigation**
- After correct PIN following 30s cooldown, lands back at /profiles instead of /portal
- Root cause: Clerk token refreshes during 30s cooldown, new session JWT propagates to Convex
  after setActiveProfile has already written under the old tokenIdentifier
- Fix attempted: 6s wait + enterPortalViaProfileCard retry — still intermittent
- Real fix: ensure setActiveProfile and getActiveProfile always agree on sessionId key
  → Add a waitForConvexAuth() helper that polls getActiveProfile until non-null before asserting

**Failure 2 — Test 11: Silent auth (OIDC)**
- authCode is null — /test?code= never arrives, lands on /test without params
- Root cause: same session timing — when running after test 10 in full suite,
  the new beforeEach session hasn't propagated to Convex when authorize page runs
- Fix attempted: enter portal first to set active profile — still intermittent
- Real fix: same as above — wait for Convex subscription to confirm active profile
  before navigating to /oauth/authorize

**Failure 3 — Test 14: Management dashboard delete confirmation**
- "Yes, delete" button never appears after clicking "Delete Profile"
- Root cause: sidebar link click changes selectedProfile → useEffect resets
  showDeleteConfirm to false → click on Delete Profile fires but state resets immediately
- Fix attempted: wait for h1 heading change + 800ms — still intermittent
- Real fix: after clicking sidebar link, wait for React to fully settle by polling
  for the specific profile heading in the right panel before interacting

### Recommended approach for next session

1. Add a `waitForActiveProfile(page)` helper that polls until getActiveProfile returns
   a non-null value (via a small Convex-reading React component on the page, or
   by watching the portal content appear). Use this before every portal assertion.
2. For the delete confirmation: replace the sidebar link navigation with a direct
   URL navigation to `/profiles/manage/${profileId}` — this avoids the
   React state reset from selectedProfile changing.

## Resume Checklist (for new session)

1. `git status` — confirm clean on `codex/profiles-v2-adoption`
2. `make dev` in one terminal, confirm Ready
3. `make qa-run2` — confirm current pass count (target: 14/14)
4. Fix the 3 intermittent failures per recommendations above
5. When 14/14 stable: merge to main, update TASKS.md T-009 to DONE
