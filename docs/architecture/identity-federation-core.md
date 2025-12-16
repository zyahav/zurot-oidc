# ZurOt – Core Identity & Federation Spec (Frozen)

**Status:** FROZEN · NON‑NEGOTIABLE

This document defines the **invariants** of the ZurOt platform identity system.
It is the constitutional layer. It does **not** describe implementation steps, phases, or tutorials.

If a future system contradicts anything in this document, the system is wrong — not this spec.

---

## 1. Purpose

ZurOt is a federated, multi‑app platform that supports multiple acting identities per human.

This document defines:
- What identity *is* in ZurOt
- What every app may assume
- What is never allowed to change

---

## 2. Canonical Mental Model

### User (Human)
- A real person
- Authenticated via Clerk
- Exists once globally

### Profile (Acting Identity)
- The **only** entity that can act
- Represents *who the user is acting as*
- Examples: Parent, Teacher, Student, Org, Admin
- Owned by exactly one User

**All actions in ZurOt occur as a Profile.**

### App (Consumer)
- A standalone application
- Never owns users or profiles
- Consumes identity via federation

---

## 3. Source of Truth

**Convex is the single source of truth** for:
- Profiles
- Profile status (active / suspended / archived)
- Profile roles and permissions
- Feed aggregation metadata

Apps may have their own databases, but **never for identity**.

---

## 4. The Netflix Principle

ZurOt follows the *Netflix identity model*:

- A User logs in
- A User selects a Profile
- The selected Profile becomes the acting identity

Profile selection is:
- Explicit
- Mandatory
- Singular (one active profile at a time)

---

## 5. Identity Federation Rule

ZurOt acts as an **OIDC Identity Provider**.

All apps authenticate via OIDC.

Apps do **not**:
- Authenticate humans
- Manage profiles
- Talk to Clerk directly

---

## 6. OIDC Invariants (Critical)

### Subject Mapping

The OIDC `sub` claim **MUST equal the Profile ID**.

- `sub = profileId`
- `sub ≠ userId`

This guarantees profile isolation across all apps, including OSS tools.

### User Context

The underlying human identity (`userId`) may exist **only** inside a custom claim for internal auditing.

Apps must not rely on it.

---

## 7. Profile Ownership Rule

Every resource in every app:
- Is owned by exactly one `profileId`
- Must never be owned by a user, email, or session

If a system stores data against a userId, it violates this spec.

---

## 8. Permissions Rule

- Permissions are profile‑scoped
- Defined centrally
- Apps enforce permissions locally
- Critical actions may be re‑validated centrally

Roles are descriptive.
Permissions are authoritative.

---

## 9. Feed Architecture Rule

ZurOt uses **fan‑out on write** for all feeds.

- Apps emit activity metadata
- The Hub aggregates
- The Feed never queries apps

This is mandatory.

---

## 10. App Isolation Rule

Each app:
- Has its own repo
- Has its own deployment
- Has its own database

Failure of one app must not affect identity or other apps.

---

## 11. Profile Lifecycle Rule

Profiles may be:
- Active
- Suspended
- Archived / Deleted

Profile deletion:
- Does not delete the User
- Does not implicitly delete historical content

---

## 12. Non‑Negotiable Constraints

The following are **never allowed**:

- Using Clerk userId as `sub`
- Apps creating or modifying profiles
- Apps owning identity data
- Implicit profile switching
- Multiple active profiles

---

## 13. Scope Exclusions

This document intentionally does **not** define:
- UI layouts
- API endpoints
- Database schemas
- Phases or timelines

Those belong in implementation guides.

---

## 14. Final Statement

This document is frozen.

Future work may extend the platform, but must not violate these rules.

**ZurOt identity begins and ends here.**

---

End of Core Spec.

