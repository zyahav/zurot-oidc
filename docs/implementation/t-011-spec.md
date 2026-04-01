# T-011 Spec — Account PIN Gate for Manage Profiles

**Status:** PLANNED
**Branch:** `codex/account-pin-gate`
**Spec References:** `docs/implementation/t-010-spec.md`, advisor discussions

---

## One-line scope

Replace the honest placeholder gate on `/profiles/manage` with a real account-level
4-digit PIN system. This is a parental boundary, not an authentication mechanism.
Clerk remains the sole identity authority. The PIN is an in-app access control layer.

---

## Mental model

This is Netflix's "Profile Lock" — not a login. The account owner sets a PIN that
children cannot guess. It prevents children from accessing profile management.
It does not verify identity. The user is already authenticated via Clerk.

---

## PIN storage

Add to Convex schema (`convex/schema.ts`):

```typescript
accountSettings: defineTable({
  userId: v.id("users"),
  ownerPinHash: v.optional(v.string()),  // SHA-256 of the 4-digit PIN
}).index("by_user", ["userId"]),
```

---

## Session unlock

After correct PIN entry, unlock the gate for 30 minutes without requiring re-entry.
Store the unlock expiry in React state (not sessionStorage — it persists across tabs
and would let a child switch tabs to bypass the gate).

```typescript
const [unlockedUntil, setUnlockedUntil] = useState<number | null>(null);
const isUnlocked = unlockedUntil !== null && Date.now() < unlockedUntil;
// On correct PIN: setUnlockedUntil(Date.now() + 30 * 60 * 1000);
```

---

## First-time setup flow

If `ownerPinHash` is null (no PIN set yet), the gate shows a setup screen:

1. "Set up a PIN to protect this area"
2. Enter 4-digit PIN
3. Confirm PIN
4. Save → unlocked immediately for 30 minutes

---

## Normal flow (PIN set)

1. User navigates to `/profiles/manage`
2. If `isUnlocked` → show dashboard directly
3. If not unlocked → show PIN entry keypad (same keypad component as profile PINs)
4. Correct PIN → unlock 30 minutes
5. Wrong PIN → inline error, max 5 attempts then 30s cooldown (same as profile PIN)

---

## Recovery flow (Forgot PIN)

1. User clicks "Forgot PIN?"
2. Server-side generates a 6-digit OTP (crypto.randomUUID based), stores SHA-256 hash
   in Convex with 10-minute TTL
3. Sends via **Resend** (new dependency — one API key in `.env.local`)
4. User enters OTP → verified server-side
5. On success → allow PIN reset (show setup flow)

This is the ONLY place OTP is used. It is recovery-only, not primary access.

---

## Files to change

| File | Action |
|---|---|
| `convex/schema.ts` | Add `accountSettings` table |
| `convex/profiles.ts` | Add `getOwnerPin`, `setOwnerPin`, `generateRecoveryOtp`, `verifyRecoveryOtp` |
| `src/app/profiles/manage/manage-dashboard.tsx` | Replace placeholder gate with PIN gate |
| `src/app/api/manage/send-recovery-otp/route.ts` | New — server-side OTP generation + Resend |
| `src/app/api/manage/verify-recovery-otp/route.ts` | New — OTP verification |
| `docs/setup/LOCAL_SETUP.md` | Add Resend API key setup |

---

## QA checks

- [ ] First visit with no PIN → setup flow appears
- [ ] Set PIN → dashboard unlocks immediately for 30 minutes
- [ ] Revisit within 30 minutes → no PIN prompt
- [ ] Revisit after 30 minutes → PIN prompt reappears
- [ ] Wrong PIN → error, 5 attempts max, cooldown
- [ ] "Forgot PIN?" → email arrives at account email
- [ ] Recovery OTP expires after 10 minutes
- [ ] Correct OTP → PIN reset flow
- [ ] Child cannot access manage even with browser tab switching
- [ ] `make qa-run2` → 14/14

---

## Definition of Done

Account owner can set a PIN, enter it daily with session unlock, and recover via email
if forgotten. Children cannot access Manage Profiles. No Clerk verification APIs used.
