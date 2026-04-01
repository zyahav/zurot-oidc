# Session State

**Read DEV_PROTOCOL.md first. Then read this file. Then read the spec.**

---

## Current state of main

- Branch: `main`
- HEAD: `285b437`
- QA: 14/14 passing
- Build: clean
- Smoke: all pass

---

## What was completed (do not re-do any of this)

| Task | What it did | Commit |
|---|---|---|
| T-009 | Profiles v2.2 adoption — schema, Convex queries, JWT, routes, full frontend | c5e33d1 |
| T-009 QA | Playwright suite — 14 tests covering all steps | ef469b5 |
| T-010 | Root `/` smart redirect, sign-out modal fix, manage gate honest placeholder | 849e785 |

---

## Next task: T-011 — Account PIN gate for Manage Profiles

**Branch to create:**
```bash
git checkout main
git pull origin main
git checkout -b codex/account-pin-gate
```

**Spec to read:** `docs/implementation/t-011-spec.md`

Read the entire spec before writing a single line of code.

---

## What T-011 builds

The Manage Profiles page currently has an honest placeholder gate ("Continue" button).
T-011 replaces it with a real 4-digit PIN system — the same mental model as Netflix
profile lock. This is a parental boundary, not authentication. Clerk remains the sole
identity authority.

**The flow:**
1. Account owner visits `/profiles/manage` for the first time → PIN setup screen
2. Owner sets a 4-digit PIN → stored hashed in Convex → unlocked for 30 minutes
3. Next visit after 30 minutes → enter PIN → unlocked again
4. Forgot PIN → "Forgot PIN?" → server-side OTP via Resend → reset PIN

---

## Files to change (from spec)

| File | Action |
|---|---|
| `convex/schema.ts` | Add `accountSettings` table |
| `convex/profiles.ts` | Add `getOwnerPin`, `setOwnerPin`, `generateRecoveryOtp`, `verifyRecoveryOtp` |
| `src/app/profiles/manage/manage-dashboard.tsx` | Replace placeholder gate with PIN gate |
| `src/app/api/manage/send-recovery-otp/route.ts` | New API route |
| `src/app/api/manage/verify-recovery-otp/route.ts` | New API route |
| `docs/setup/LOCAL_SETUP.md` | Add Resend API key instructions |

---

## QA checks before reporting done

Run each check and paste full output to PM. Wait for confirmation before proceeding.

```bash
make quality        # must show 0 errors
make qa-run2        # must show 14 passed
```

Manual QA (cannot be automated — do in browser and report result):
1. First visit → PIN setup screen appears
2. Set PIN → dashboard unlocks immediately
3. Navigate away and back within 30 min → no PIN prompt
4. Navigate away and back after 30 min → PIN prompt returns
5. Enter wrong PIN 5 times → cooldown triggers
6. "Forgot PIN?" → email arrives → enter OTP → PIN reset

---

## Important constraints

- Do not use any Clerk client-side verification APIs (`signIn.create`, `prepareVerification`, `attemptVerification`) — these do not work for re-authentication of already-signed-in users
- PIN is an in-app access control layer, not authentication
- Clerk stays the sole identity authority
- Session unlock is React state only — not sessionStorage (sessionStorage persists across tabs, a child could bypass it by switching tabs)
- Recovery OTP is for forgot-PIN only, never for primary gate access

