# ZurOt Execution Handoff – FINAL (Locked)

**Status:** APPROVED – NO FURTHER CHANGES

This document is the authoritative execution order for building ZurOt’s Identity Control Plane.
It supersedes all prior discussions, drafts, and feedback loops.

---

## Final Verdict

All reviewers (ChatGPT, Grok, Gemini, Claude) are aligned.
There is **no remaining architectural disagreement**.

**Decision is LOCKED:**

- Repository: **`zurot-hub`**
- Domain: **`hub.zurot.org`**
- Pattern: **Hub & Spoke (Federated Identity)**
- Database SSOT: **Convex**
- Auth Provider: **Clerk**
- Token Model: **OIDC (sub = profileId)**

This repository is **infrastructure**, not an app.

---

## What This Repo Is

`zurot-hub` is the **Identity Control Plane** for the entire ZurOt ecosystem.

It is the *only* system allowed to:
- Manage users
- Manage profiles (Netflix-style)
- Manage permissions
- Issue and revoke identity tokens

If identity logic exists anywhere else, it is a bug.

---

## What Lives Here (Non‑Negotiable)

This repo owns:
- Clerk authentication integration
- Convex schema and functions for:
  - users
  - profiles
  - permissions
  - activity feed metadata (fan‑out)
- Profile selection UI (Netflix model)
- Profile CRUD (create / edit / archive)
- OIDC Provider:
  - Token issuance (`sub = profileId`)
  - UserInfo endpoint
  - Back‑channel logout
- Global suspension and revocation logic

This repo **does NOT** contain:
- Lobby code
- Chat code
- Vibe code
- App‑specific databases

Apps are **dumb consumers**.

---

## Execution Order (MANDATORY)

1. Initialize repository `zurot-hub`
2. Implement **Phase 0 only**:
   - Convex schema
   - Clerk → Convex sync
   - Profile CRUD
   - Netflix‑style profile picker
3. Phase 0 must PASS:
   - Human can log in
   - Create multiple profiles
   - Switch profiles
   - State is consistent
4. Only after PASS → implement **Phase 1**:
   - OIDC provider
   - Token issuance (`sub = profileId`)
   - UserInfo endpoint
   - Back‑channel logout
5. Only after Phase 1 → federated apps may be built

Skipping phases is not allowed.

---

## Approved Repo Structure

```
zurot-hub/
├── app/                  # Next.js UI (hub.zurot.org)
│   ├── login/
│   ├── profiles/         # Netflix picker + CRUD
│   ├── settings/
│   └── admin/
│
├── convex/               # Single source of truth
│   ├── schema.ts
│   ├── users.ts
│   ├── profiles.ts
│   ├── permissions.ts
│   ├── activities.ts
│   └── http.ts           # OIDC / UserInfo / logout
│
├── lib/
│   ├── oidc/
│   ├── clerk.ts
│   └── tokens.ts
│
├── docs/                 # Frozen specs + execution packs
└── README.md             # Identity Authority warning
```

---

## Tooling Defaults

Unless explicitly changed:
- Frontend: Next.js (App Router)
- Backend: Convex
- Auth: Clerk
- OIDC: Convex HTTP actions
- Deployment: One logical service (`hub.zurot.org`)

---

## Harness Instructions

Input:
- `docs/app_spec.txt` (pointer spec → INDEX.md)

Harness behavior:
- Read `docs/INDEX.md`
- Respect document roles and phase gates
- Execute Phase 0 code pack
- Validate Phase 0
- Execute Phase 1 only if Phase 0 passes
- Stop immediately on failure
- Never invent identity logic

---

## Final Authority Statement

This document is the **final handoff**.

No new handoff is required.
No rewrites are allowed.

Execution begins now.

---

## Next Task (Single Step)

Create a new empty repository:

```
zurot-hub
```

Initialize git and commit **only** the `/docs` directory.

When complete, report:

> Repo initialized.

---

End of document.

