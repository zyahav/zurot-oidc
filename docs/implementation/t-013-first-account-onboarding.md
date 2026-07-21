# T-013 — First-account owner onboarding

**Status:** IN_PROGRESS  
**Branch:** `codex/first-account-onboarding`  
**Authorized:** Zuriel, 2026-07-21

## Scope

Repair the live first-account deadlock so a newly authenticated account creates its
account-owner PIN and first adult profile together before entering the normal
Netflix-style profile chooser.

## Verified production failures

1. An empty account hides **Manage Profiles**.
2. Creating a Parent or Teacher profile requires an owner PIN that the user has no
   route to create.
3. Creating a Student first exposes **Manage Profiles**, but the dashboard query
   throws because no adult owner profile exists.
4. The profile form exposes a raw Convex server error to the user.

## Contract

- Clerk remains the account authentication authority.
- The owner PIN remains an in-app parental boundary, not authentication.
- An account without an adult profile and without an owner PIN is placed into a
  guided owner-setup screen.
- One Convex mutation atomically creates the account PIN and first Adult profile.
  It must also recover student-only accounts produced by the old flow.
- The public profile vocabulary is Adult and Kid. Existing internal Parent/Teacher
  roles remain compatible underneath so current OIDC and app authorization behavior
  is preserved; newly created Adult profiles use the established Parent policy.
- Bootstrap is rejected once an owner PIN or adult profile exists.
- Normal Student creation, profile switching, profile PINs, OIDC, and TV behavior
  remain unchanged.
- Management-only queries must not crash before bootstrap is complete.
- Public UI errors must be concise and must not expose Convex request IDs, source
  paths, or stack traces.

## Acceptance checks

- Empty account sees owner setup instead of an unguided empty chooser.
- Student-only legacy account sees the same recovery setup.
- Valid setup creates exactly one adult profile and one owner PIN atomically.
- Repeated or conflicting bootstrap attempts fail closed.
- After setup, the standard profile chooser renders and the owner profile can enter
  the portal.
- `/profiles/manage` no longer issues the adult-only request query before an adult
  profile exists.
- Existing Student profile creation and profile switching continue to work.
- Unit/Convex tests, lint, and production build pass.
- Production retest succeeds with the authorized test account.

## Files in scope

- `convex/profiles.ts`
- `convex/profiles.test.ts`
- `package.json`
- `src/app/profiles/page.tsx`
- `src/app/profiles/manage/manage-dashboard.tsx`
- `src/components/zurot/owner-onboarding.tsx`
- `src/components/zurot/add-profile-modal.tsx`
- `src/lib/profile-ui.ts`
- `scripts/qa/run2.spec.ts`
- `scripts/qa/run2-e2e.mjs`
- task, attestation, and session evidence documents
