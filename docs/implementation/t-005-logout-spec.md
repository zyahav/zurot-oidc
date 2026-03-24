# T-005 Spec — Logout and Session Strategy

**Status:** APPROVED — ready for implementation  
**Branch:** `codex/logout-strategy`  
**Spec References:** `BASELINE.md`, `docs/implementation/t-005-logout-decisions.md`, `docs/architecture/identity-federation-core.md`

**Read first:** `docs/implementation/t-005-logout-decisions.md` — all architecture decisions are documented there and must be understood before coding.

---

## One-line scope

Implement two distinct session flows — full logout and profile switch — with correct behavior per the architecture decisions. No token revocation. No new schema. No federated app changes.

---

## Two flows to implement

### Flow 1 — Full logout

**Trigger:** User clicks "Sign out" button  
**What happens:**
1. Clerk `SignOutButton` ends the Clerk session
2. Convex queries stop automatically (no auth)
3. Homepage drops to State 1 (unauthenticated) via `useAuth()` reactive update
4. Active profile in Convex is NOT explicitly cleared — it persists for the next login session

**Why active profile is NOT cleared on logout:**  
When the user logs back in, they may want to continue with the same profile. Clearing it on logout would force re-selection every time. The profile selection on re-login is handled by the homepage State 2 flow if no active profile is found, or by auto-proceeding to State 3 if one is still set.

**Implementation:** The `SignOutButton` from Clerk already handles this entirely. No new code needed on the homepage — it already uses `SignOutButton` in the App Launcher (State 3). Verify this is wired correctly.

---

### Flow 2 — Profile switch

**Trigger:** User clicks "Switch profile" in the App Launcher  
**What happens:**
1. `clearActiveProfile` mutation runs in Convex
2. Clerk session remains active — user stays authenticated
3. Homepage drops to State 2 (profile picker) via Convex reactive update
4. Previously issued OIDC tokens remain valid until their natural 15-minute expiry
5. New tokens issued after profile re-selection will reflect the newly selected profile

**Token behavior note:** Tokens are not invalidated on profile switch. They age out naturally. This is an intentional Phase 0 tradeoff — acceptable because no federated apps exist yet.

**Implementation:** `clearActiveProfile` already exists in `convex/profiles.ts`. The homepage already calls it via the "Switch profile" button in the App Launcher. Verify this is wired correctly and the UI transitions as expected.

---

## What this task actually does

Both flows are already partially implemented from T-003. This task's job is to:

1. **Verify** both flows work end-to-end with correct behavior
2. **Harden** edge cases that may not be handled
3. **Document** the behavior explicitly in code comments
4. **Test** both flows in the smoke test suite

This is NOT a large implementation task — it is a verification, hardening, and documentation task.

---

## Edge cases to verify and handle

### Edge case 1 — Sign out with no active profile
User is in State 2 (authenticated, no profile) and signs out.  
Expected: `SignOutButton` works the same — Clerk session ends, homepage drops to State 1.  
Action: Verify `SignOutButton` is accessible from State 2, not just State 3.  
Current state: The `SignOutButton` is only in the App Launcher (State 3). **This is a gap — add it to State 2 as well.**

### Edge case 2 — Profile switch clears an already-null active profile
User somehow triggers `clearActiveProfile` when no active profile is set.  
Expected: No error — mutation is idempotent.  
Action: Verify `clearActiveProfile` handles this gracefully (it already does — it checks for existing record before deleting).

### Edge case 3 — Clerk session expires mid-session
User is in State 3 with an active profile. Clerk session expires.  
Expected: `useAuth()` detects session expiry, homepage drops to State 1.  
Action: No code change needed — Clerk handles this. Verify behavior manually.

### Edge case 4 — Convex loses active profile record
Active profile exists in Clerk session context but `getActiveProfile` returns null (e.g. profile was archived by admin).  
Expected: Homepage drops to State 2 automatically.  
Action: Already handled in `getActiveProfile` query — it returns null if profile is not active. Verify this triggers State 2 correctly.

---

## Sign out button gap — fix required

**Current state:** `SignOutButton` only appears in State 3 (App Launcher).  
**Required state:** `SignOutButton` must also appear in State 2 (Profile Picker).

Add a minimal sign out option to the Profile Picker state in `src/app/page.tsx`. It does not need to be prominent — a small "Sign out" link in the corner is sufficient. The user must always be able to exit the session from any authenticated state.

---

## Smoke test additions

Add these checks to `scripts/smoke/oidc-smoke.mjs`:

1. `GET /` returns 200 (homepage loads without error in unauthenticated state)
2. `GET /internal` returns 200 (harness page loads)

These are lightweight — just HTTP status checks, not full auth flow tests. Full auth flow smoke testing requires a real session and belongs to a later phase.

---

## Files to change

| File | Action |
|---|---|
| `src/app/page.tsx` | Add `SignOutButton` to State 2 (Profile Picker) |
| `scripts/smoke/oidc-smoke.mjs` | Add homepage and internal page smoke checks |

No Convex changes. No schema changes. No homepage architecture changes.

---

## Acceptance criteria

- Full logout from State 3 ends Clerk session and returns to State 1 ✓
- Full logout from State 2 ends Clerk session and returns to State 1 ✓ (gap fix)
- Profile switch clears active profile in Convex and returns to State 2 ✓
- Profile switch does not end Clerk session ✓
- `clearActiveProfile` is idempotent — no error when called with no active profile ✓
- Homepage smoke check passes (GET / returns 200) ✓
- Internal page smoke check passes (GET /internal returns 200) ✓
- Lint passes, build passes, all smoke tests pass ✓

---

## Logout availability rule (Phase 0)

The user must be able to perform full logout from any authenticated UI state. This includes:
- State 2 (profile picker)
- State 3 (app launcher)

Logout must not depend on having an active profile selected. This is a non-negotiable UX rule — a user must never be trapped in an authenticated state with no exit.

---

## Post-logout behavior contract

On logout, the system must:
- End the Clerk session
- Clear all authenticated UI state
- Render the homepage in State 1 (signed out)

No client-side cached state should persist after logout. The homepage derives its state fresh from Clerk and Convex on every render — it does not remember previous state.
