# Task: First end-to-end app-access journey (family-zero slice)

Status: approved for implementation. Scope is frozen — do not expand.
Architect notes by Claude, 2026-07-19. Execute exactly this; deferred items go to docs/decisions.md only.

## Goal
Implement the minimal app-access model so one real journey can be tested:
profile sees app card per policy -> student requests access -> owner approves ->
student's next OIDC token actually carries devices scopes -> app opens ->
decline/revoke genuinely blocks backend access.

## Context (verified in this repo)
- App lists are currently duplicated:
  - `src/lib/app-catalog.ts` (5 demo apps, drives portal UI)
  - `AVAILABLE_APPS` inside `convex/profiles.ts` (orphaned; delete it)
- Per-profile disable toggles live in the `appPermissions` table (convex/profiles.ts:
  getDisabledApps / disableApp / enableApp) and manage-dashboard.tsx.
- Scopes are embedded in tokens AT ISSUANCE in
  `src/app/api/oauth/token/route.ts` via `translatePersonaToScopes(role, product)`
  from `src/lib/translation-engine.ts`.
- `translatePersonaToScopes` already accepts an optional `overrides?: ScopeOverride[]`
  parameter that nothing passes yet. THIS is the enforcement hook. Do not invent
  a parallel mechanism.
- Student persona currently has `devices: []` in PERSONA_SCOPE_DEFAULTS — keep it.
  Approval grants scopes ONLY via a per-profile override; revoking removes the
  override, returning the student to empty scopes (genuinely blocked by
  devices.zurot.org, which enforces devices:* scopes on every API call).

## Scope — implement exactly these 10 items

1. **Canonical catalog.** Extend `src/lib/app-catalog.ts` so each app has:
   `id`, `name`, `emoji`, `description`, `launchUrl` (absolute URLs allowed),
   and `access: Record<Role, "included" | "requestable" | "hidden">`.
   Make kid-learning fields (`subject`, `ageRange`, `lessonCount`) optional and
   guard the app detail page for apps that lack them. Add the Device Manager entry:
   id `devices`, launchUrl `https://devices.zurot.org`, external link (plain
   anchor, target _blank), access: parent=included, teacher=included,
   student=requestable. Delete `AVAILABLE_APPS` and `getAppsForActiveProfile`'s
   dependency on it from `convex/profiles.ts` (rewrite it against the catalog
   policy or remove it if unused).

2. **Access requests table** in `convex/schema.ts`:
   `accessRequests: { profileId, productKey, requestType: "product_access" | "add_device",
   status: "pending" | "approved" | "declined", requestedAt, reviewedAt?,
   reviewedBy?, reviewNote? }` with index by_profile and by_status.
   Implement ONLY `product_access` in the UI; `add_device` exists in schema only.

3. **Convex functions**: `requestAccess` (rejects if an active pending/approved
   request exists for same profile+productKey), `listPendingRequests` (owner only),
   `reviewRequest` (approve/decline, owner only, records reviewedAt/By/Note),
   `revokeAccess` (sets an approved request back to declined/revoked state).

4. **Portal card states** in `src/app/portal/page.tsx` (+ app detail page), computed
   from catalog policy x request status, exactly:
   included -> Open app; requestable+none -> Request access;
   requestable+pending -> Pending approval (disabled);
   requestable+approved -> Open app; requestable+declined -> Request declined;
   hidden -> card not rendered. The existing per-profile disable toggle remains
   as an additional override (disabled = not rendered).

5. **Request UX**: on submit, immediately show "Request received — we'll update
   you when it has been reviewed." Then the card shows Pending approval.
   Duplicate submission must be impossible (server-side check, not only UI).

6. **Approvals UI**: minimal "Requests" section in
   `src/app/profiles/manage/manage-dashboard.tsx` (owner-gated like the rest of
   Manage), listing pending requests with Approve / Decline + optional note,
   and showing approved ones with a Revoke action.

7. **ENFORCEMENT (the critical item).** When a request is approved, persist a
   scope override for that profile+product (either a new `scopeOverrides` table
   or derive it from the approved accessRequest at token time — pick the simpler,
   document the choice). In `src/app/api/oauth/token/route.ts`, load the
   profile's overrides from Convex and pass them as the third argument to
   `translatePersonaToScopes(persona, product, overrides)`. Approved student
   override for `devices` = ["devices:view", "devices:manage", "devices:command"].
   On decline/revoke the override must be removed. Card visibility and token
   scopes must derive from the SAME stored state.

8. **Token freshness**: approval takes effect on the next token issuance.
   Document this in the task's DONE notes; ensure the portal launch always runs
   a fresh OIDC authorization (it does today — verify, don't cache).

9. **Tests**: extend `src/lib/translation-engine.test.ts` — override grants
   student devices scopes; no override = []; revoked = []. Add a Convex-side
   test or assertion for duplicate-request rejection if the repo has a pattern
   for it; otherwise enforce in code and note it.

10. **docs/decisions.md** (short, no architecture): deferred intentionally —
    household device ownership, device assignment vs ownership, granular device
    scopes, publication lifecycle, credits/entitlements, student Coach product,
    org administration. Reason: no family-zero journey validated yet.

## Out of scope (do NOT build)
Granular scopes (devices:view_assigned etc.), publication lifecycle
(draft/pilot/published), entitlements, credits, household ownership rewrite,
add_device request UI, Coach product, role changes in PERSONA_SCOPE_DEFAULTS.

## Working rules
- Branch from a clean committed state: `feat/app-access-requests`.
- Small commits per scope item. No deploy. Run existing tests
  (`node --test src/lib/translation-engine.test.ts`) before finishing.
- If a scope item conflicts with reality in the code, STOP and write the
  conflict into this file under "## Blockers" instead of improvising.

## Family-zero acceptance checklist (run manually after implementation)
1. Sign in as parent -> Device Manager appears -> opens devices.zurot.org via OIDC.
2. Sign in as teacher -> same.
3. Sign in as student -> card shows "Request access".
4. Submit request -> "Request received" -> card shows "Pending approval".
5. Try to submit again -> impossible (also via direct mutation call).
6. Owner approves in Manage Profiles.
7. Student refreshes -> card shows "Open app".
8. Student opens app -> OIDC flow -> token contains devices:view/manage/command.
9. Pair a real Android phone from that session.
10. Send one harmless observable command (e.g. status report / ring).
11. Phone executes it.
12. Owner revokes access.
13. Student's next launch is rejected by devices.zurot.org (backend, not just UI).
14. Parent/teacher access unaffected throughout.

11. **Owner PIN gate on adult profiles.** Creating a profile with role parent or
    teacher (or changing an existing profile's role to one of these) requires
    owner PIN verification, using the existing owner PIN mechanism
    (getOwnerPin / accountSettings.ownerPinHash in convex/profiles.ts).
    Enforce server-side in createProfile/updateProfile mutations (accept a pin
    argument and verify), not only in the UI. Student profiles remain free to
    create with no PIN. If no owner PIN is set yet, prompt to set one first
    (setOwnerPin flow already exists).

Note: docs/decisions.md already exists and is written by the architect.
Do NOT rewrite or expand it — item 10 is satisfied; leave the file as-is.
