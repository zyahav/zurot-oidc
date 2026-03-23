# ZurOt Documentation Index

**Purpose:** Single source of truth for how to read, use, and execute the ZurOt documentation set.

This file exists to **prevent misinterpretation by humans or LLM-based harnesses**.
If there is any conflict between documents, this index defines the resolution order.

---

## 1. Current Working Mode (Baseline-First)

Current development is **baseline-first on `main`**.

- Active implementation contract is defined in `BASELINE.md`
- Delivery process is defined in `WORKFLOW.md`
- Flat task tracking is in `TASKS.md`
- Test audit trail is in `TEST_ATTESTATION.md`
- Session handoff state is in `SESSION_STATE.md`
- New work starts from fresh feature branches off `main`
- Merge back to `main` only after baseline gates pass (`lint`, `build`, smoke checks)

This replaces old harness-first execution as the default day-to-day workflow.

---

## 2. Document Roles (Non-Negotiable)

Each document in this repository has a **specific role**. Documents must not be used outside their role.

### A. Architecture (Immutable)

**Path:** `docs/architecture/identity-federation-core.md`

- Defines platform identity invariants
- Acts as constitutional law
- Must never be implemented, modified, or reinterpreted
- Read-only for humans and agents

If any implementation contradicts this document, the implementation is wrong.

---

### B. Implementation Guides (Human + Agent Guidance)

#### Phase 0 Guide

**Path:** `docs/implementation/phase-0-hub-profile-authority.md`

- Defines what must be built first
- Describes scope and sequencing
- Human-readable execution intent
- Not executable code

This guide explains **what to build**, not how.

---

### C. Executable Code Packs (Harness Targets)

#### Phase 0 Code Pack

**Path:** `docs/implementation/phase-0/convex-identity-code-pack.md`

- Canonical Convex schema and mutations
- Deterministic and testable
- Intended for harness execution
- Must not be modified by interpretation

If Phase 0 fails here, execution must stop.

---

### D. Phase 1 – Authentication Layer

#### OIDC Implementation Pack

**Path:** `docs/implementation/phase-1/oidc-provider-implementation-pack.md`

- Defines full OIDC provider behavior
- Depends on Phase 0 passing
- Must not be executed until identity substrate exists

Execution before Phase 0 completion is invalid.

---

### E. Integration Rules (Future Apps)

**Path:** `docs/integration/federated-app-integration-guide.md`

- Rules for all federated apps
- Defines what apps may and may not do
- Not executable
- Must be enforced contractually

---

## 3. Authority and Execution Order (Mandatory)

When defining implementation behavior, follow this authority order:

1. `docs/architecture/identity-federation-core.md` (immutable constraints)
2. `BASELINE.md` (active implementation contract on `main`)
3. Implementation guides and packs under `docs/implementation/`
4. Integration guide under `docs/integration/`

If any legacy document conflicts with the current baseline contract, update the legacy document; do not silently diverge in code.

Execution sequencing remains:

1. Respect architecture constraints
2. Implement and verify against `BASELINE.md`
3. Deliver features in small branches from `main`
4. Promote back to `main` only with passing gates

---

## 4. Phase Gating Rules

- Phase 0 must PASS before Phase 1
- Phase 1 must PASS before any app integration
- A failed phase blocks all subsequent work

Harnesses must enforce gating strictly.

---

## 5. Modification Rules

- Architecture docs are frozen
- Code packs change only through explicit revision
- Guides may evolve, but must not violate architecture

Unauthorized modification is considered a failure.

---

## 6. Final Authority Statement

This INDEX file is authoritative for:
- Document usage
- Execution order
- Phase gating

If uncertainty exists, follow this file literally.

---

End of Index.
