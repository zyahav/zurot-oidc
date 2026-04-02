# Session State

**Read DEV_PROTOCOL.md first. Then read this file.**

---

## Current state of main

- Branch: `main`
- HEAD: `8b0f781`
- QA: 14/14 passing
- Build: clean
- Smoke: all pass

---

## What was completed (do not re-do any of this)

| Task | What it did | Commit |
|---|---|---|
| T-001 to T-008 | Federation, auth, OIDC, first app | See TASKS.md |
| T-009 | Profiles v2.2 adoption — schema, Convex, JWT, routes, full frontend | c5e33d1 |
| T-009 QA | Playwright suite — 14 tests | ef469b5 |
| T-010 | Root `/` smart redirect, sign-out modal fix, manage gate honest placeholder | 849e785 |
| T-011 | Account PIN gate — setup, entry, 30min unlock, Resend recovery OTP | 8b0f781 |

---

## Known constraints (do not work around these)

- Owner PIN gate uses React state only — `unlockedUntil`. No sessionStorage. Resets on every page load.
- PIN entry keypad clicks race with React state updates in headless Playwright. The `ensureManageUnlocked` QA helper handles this — do not change it.
- Clerk email OTP (`signIn.create` / `emailAddress.prepareVerification`) does not work for re-authentication of signed-in users. Never use those for gate verification.
- Recovery OTP uses Resend. Requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env.local`.

---

## Next task

No task is currently planned. Await new spec from PM.

## Resume checklist

1. `git status` — confirm clean on `main`
2. `make dev` in one terminal
3. `make qa-run2` — confirm 14/14
4. Read new spec from PM before writing any code
