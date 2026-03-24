# T-005 Pre-Spec Architecture Decisions

This document captures the architecture decisions made before writing the T-005 spec.
It must be read before implementation begins.

---

## Question 1 — Phase 0 Scope

**Decision:** Three flows only.

1. Full sign out → end Clerk session → homepage returns to State 1 (unauthenticated)
2. Profile switch → clear active profile in Convex → homepage returns to State 2 (authenticated, no profile)
3. Token expiry → let normal auth recovery handle it, no custom machinery

**Out of scope for Phase 0:**
- Back-channel logout notifications to federated apps
- Forced logout across devices
- Revocation lists or session tracking

**Critical distinction:** Profile switch and logout are NOT the same event.
- Logout ends the Clerk session. User must re-authenticate from scratch.
- Profile switch keeps the Clerk session alive. User is still authenticated, just needs to re-select a profile.
- These must be implemented as separate flows, not aliases of each other.

---

## Question 2 — JWT Lifecycle

**Decision:** Token expiry is sufficient for Phase 0. No server-side revocation.

### JWT Lifecycle (Phase 0)

- Tokens are RS256 signed with 15-minute expiry
- No server-side revocation is implemented
- Logout does not invalidate issued tokens immediately
- Maximum exposure window = token expiry duration (15 minutes)

This is an intentional tradeoff for Phase 0 and will be revisited when federated apps are introduced (T-006).

**Why this is safe for Phase 0:**
- No federated apps exist yet — no downstream token propagation risk
- Convex still enforces real state regardless of token validity:
  - Archived profile → rejected at query time
  - Invalid ownership → rejected at mutation time
- This protects the system even without revocation

**Future note:** When T-006 introduces the first federated app, JWT revocation strategy must be revisited.

---

## Question 3 — Multi-tab behavior

**Decision:** Solved by architecture. No additional implementation needed.

### Multi-tab behavior (Phase 0)

- Authentication state is synchronized across tabs via Clerk
- Profile state is synchronized across tabs via Convex real-time subscriptions
- No manual cross-tab synchronization is implemented
- Developers MUST NOT implement additional tab synchronization mechanisms

**Timing model:**
- Updates are eventually consistent, not instantaneous
- A short delay between tabs is expected and acceptable
- This is intentional and derives from using reactive state systems

**Why this works:**
- Clerk session polling handles auth state sync across tabs automatically
- Convex subscriptions push profile state changes to all active clients automatically
- The homepage state machine reacts to both, so tabs self-correct without extra code

---

## Question 4 — Profile switch vs logout

*(To be decided)*

---

## Question 5 — Source of truth on logout

*(To be decided)*

## Question 4 — Profile switch vs logout

**Decision:** Two separate flows with different semantics. Tokens are not invalidated on profile switch — they age out naturally.

### Profile switch behavior
- Calls `clearActiveProfile` in Convex
- Clerk session remains active
- Homepage returns to State 2 (authenticated, no profile selected)
- Previously issued OIDC tokens remain valid until their natural 15-minute expiry
- Those tokens may represent the previous profile context — this is acceptable for Phase 0
- New tokens issued after re-authentication will reflect the newly selected profile

### Full logout behavior
- Calls Clerk `SignOutButton`
- Clerk session ends completely
- Convex queries stop (no auth)
- Homepage returns to State 1 (unauthenticated)
- Previously issued tokens remain valid until expiry (consistent with Q2 decision)

**The key rule:** We do not invalidate tokens — we let them age out.

**Why profile context drift is acceptable for Phase 0:**
- No federated apps exist yet to consume stale tokens
- When federated apps arrive (T-006), this tradeoff must be revisited

## Question 5 — Source of truth on logout

**Decision:** Clerk owns authentication. Convex owns profile state. The client derives from both and never leads.

### Source of truth (Phase 0)

- Clerk is the authoritative source for authentication state
- Convex is the authoritative source for profile state
- The client derives state from both and never acts as a source of truth

**Conflict resolution rules:**
- If Clerk session is absent → user is treated as logged out, regardless of Convex state
- If Clerk session exists but no active profile in Convex → user must select a profile
- Client-side cached state must never be used to infer authentication or profile state

**User sync behavior:**
- On authentication, the system ensures the user exists in Convex via `upsertUserFromClerk`
- Missing user records in Convex are automatically created during this process
- This pattern heals state instead of failing

**One sentence that defines everything:**
"Clerk tells us who you are. Convex tells us who you are acting as. The client only listens."

---

## Architecture complete

All five questions are answered. This document is the foundation for the T-005 spec.
