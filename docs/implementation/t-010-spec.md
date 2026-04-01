# T-010 Spec — Root Route, Sign-Out Redirect, and Manage Gate

**Status:** APPROVED — ready for implementation
**Branch:** `codex/root-signout-gate`
**Spec References:** `zurot_profiles_spec_v2.2`, `docs/implementation/t-003-homepage-spec.md`

---

## One-line scope

Restore the root `/` route as a smart redirect, fix sign-out to use a hard redirect,
and wire the Manage Profiles password gate to verify against the actual Clerk account password.

---

## Background — why these three issues exist together

The v2.2 profiles adoption (Phase 4) removed `src/app/page.tsx` as part of replacing
old routes. But `/` was not an old route — it was a live route from T-003 that needed
to be preserved and updated. Its removal left the root as a 404.

The sign-out redirect uses a Clerk soft navigation, which means the page does not fully
remount after sign-out. React state is preserved, so the sign-out confirmation modal
remains open after the user signs back in.

The Manage Profiles password gate compares against `NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD`
(a static env var), not the user's actual Clerk account password. This contradicts the
spec which explicitly states "in production this is the Clerk account password."

---

## Fix 1 — Restore `/` as a smart redirect

### What it does

`/` is the root entry point. It resolves auth state and redirects — no content of its own.

| Condition | Redirects to |
|---|---|
| No Clerk session | `/profiles` — which shows the sign-in button |
| Clerk session exists, no active profile | `/profiles` |
| Clerk session exists, active profile set | `/portal` |

This is a pure redirect page. It shows a brief loading state while Convex resolves.

### Implementation

Create `src/app/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function RootPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const activeProfile = useQuery(api.profiles.getActiveProfile, {});

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.replace("/profiles");
      return;
    }
    // Wait for Convex to resolve
    if (activeProfile === undefined) return;
    if (activeProfile === null) {
      window.location.replace("/profiles");
    } else {
      window.location.replace("/portal");
    }
  }, [isLoaded, isSignedIn, activeProfile]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
      Loading…
    </main>
  );
}
```

**Rules:**
- Use `window.location.replace()` not `router.push()` — replace so the root is not in browser history
- Show a minimal loading state — no branding, no content, no flash
- No `<Suspense>` boundary needed — Convex returns `undefined` while loading, which is handled

### Routes table addition

Add to Section 13 of the v2.2 spec routes table:

| Route | Screen | Requires | Notes |
|---|---|---|---|
| `/` | Smart redirect | None | Redirects to /profiles or /portal based on auth + active profile state |

---

## Fix 2 — Sign-out hard redirect

### What the bug is

`confirmSignOut` calls `signOut({ redirectUrl: "/profiles" })`. Clerk performs this as a
client-side soft navigation — the Next.js router pushes to `/profiles` without destroying
the React component tree. The sign-out confirmation modal's `showSignOutModal` state
remains `true` because the component did not remount.

### What the fix is

Set `showSignOutModal` to `false` before calling `signOut`, AND use `window.location.href`
for the post-sign-out redirect to guarantee a full page remount.

**In `src/app/profiles/page.tsx`:**

```typescript
const confirmSignOut = async () => {
  setShowSignOutModal(false);   // close modal before any async work
  setSignOutBusy(true);
  try {
    await signOut();
    window.location.href = "/profiles";  // hard redirect — full remount
  } finally {
    setSignOutBusy(false);
  }
};
```

**In `src/app/profiles/manage/manage-dashboard.tsx`:**

```typescript
const confirmSignOut = async () => {
  setShowSignOutModal(false);   // close modal before any async work
  setSignOutBusy(true);
  try {
    await signOut();
    window.location.href = "/profiles";  // hard redirect — full remount
  } finally {
    setSignOutBusy(false);
  }
};
```

**Rules:**
- Always close the modal (`setShowSignOutModal(false)`) as the first line — before any await
- Do not pass `redirectUrl` to `signOut()` — handle the redirect manually with `window.location.href`
- The redirect target is always `/profiles`

---

## Fix 3 — Manage Profiles gate uses email verification code

### Context

The gate must verify the account owner before allowing access to profile settings,
PIN controls, and deletion. The original spec said "Clerk account password" but
the ZurOt.org Clerk instance uses email code as the primary authentication method
(not password). Accounts created via email OTP have `passwordEnabled: false` — there
is no password to verify.

The gate therefore uses Clerk's email verification code flow. This matches how the
user actually authenticates and requires no new dependency.

### Gate states

The gate has three states:

| State | What the user sees |
|---|---|
| `idle` | "Send verification code" button + explanation |
| `code_sent` | 6-digit code input + "Verify" button + "Resend" link |
| `error` | Inline error message, input stays visible |

### UX flow

1. User clicks "Manage Profiles" on the profile selection screen
2. Gate renders — shows their masked email and a "Send code" button
3. User clicks "Send code" → Clerk sends a 6-digit OTP to their email
4. User enters the code → gate verifies via Clerk
5. On success → gate unlocks for this browser session (sessionStorage)
6. On failure → inline error, user can retry

### Implementation

**State additions in `manage-dashboard.tsx`:**

```typescript
// Replace passwordInput state with:
const [gateState, setGateState] = useState<"idle" | "sending" | "code_sent" | "verifying">("idle");
const [codeInput, setCodeInput] = useState("");
const [gateError, setGateError] = useState<string | null>(null);
```

**Imports to add:**
```typescript
import { useSignIn, useUser } from "@clerk/nextjs";
// inside component:
const { signIn, setActive } = useSignIn();
const { user } = useUser();
```

**Send code handler:**
```typescript
const sendGateCode = async () => {
  if (!signIn || !user) return;
  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) { setGateError("No email on account."); return; }

  setGateState("sending");
  setGateError(null);
  try {
    await signIn.create({ strategy: "email_code", identifier: email });
    setGateState("code_sent");
  } catch {
    setGateError("Could not send code. Please try again.");
    setGateState("idle");
  }
};
```

**Verify code handler:**
```typescript
const verifyGateCode = async (event: FormEvent) => {
  event.preventDefault();
  if (!signIn) return;

  setGateState("verifying");
  setGateError(null);
  try {
    const result = await signIn.attemptFirstFactor({
      strategy: "email_code",
      code: codeInput,
    });
    if (result.status === "complete") {
      // Do NOT call setActive() — we only needed to verify identity,
      // not switch the session.
      sessionStorage.setItem(MANAGE_GATE_SESSION_KEY, "1");
      setIsUnlocked(true);
      setCodeInput("");
    } else {
      setGateError("Incorrect code. Please try again.");
      setGateState("code_sent");
    }
  } catch {
    setGateError("Incorrect code. Please try again.");
    setGateState("code_sent");
  }
};
```

**Gate UI — replace the form with:**
```tsx
{gateState === "idle" || gateState === "sending" ? (
  <div className="mt-5 space-y-3">
    <p className="text-sm text-zinc-400">
      A verification code will be sent to{" "}
      <span className="text-zinc-200">{user?.primaryEmailAddress?.emailAddress}</span>
    </p>
    {gateError ? <p className="text-sm text-red-400">{gateError}</p> : null}
    <div className="flex items-center justify-end gap-3">
      <button type="button" onClick={() => router.push("/profiles")}
        className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200">
        Cancel
      </button>
      <button type="button" onClick={() => void sendGateCode()}
        disabled={gateState === "sending"}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60">
        {gateState === "sending" ? "Sending..." : "Send code"}
      </button>
    </div>
  </div>
) : (
  <form onSubmit={verifyGateCode} className="mt-5 space-y-3">
    <p className="text-sm text-zinc-400">
      Code sent to{" "}
      <span className="text-zinc-200">{user?.primaryEmailAddress?.emailAddress}</span>
    </p>
    <input
      type="text" inputMode="numeric" maxLength={6}
      value={codeInput} onChange={e => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
      className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 tracking-widest"
      placeholder="000000" autoFocus required
    />
    {gateError ? <p className="text-sm text-red-400">{gateError}</p> : null}
    <div className="flex items-center justify-between">
      <button type="button" onClick={() => void sendGateCode()}
        className="text-xs text-zinc-500 underline hover:text-zinc-300">
        Resend code
      </button>
      <div className="flex gap-3">
        <button type="button" onClick={() => { setGateState("idle"); setCodeInput(""); setGateError(null); }}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200">
          Cancel
        </button>
        <button type="submit" disabled={gateState === "verifying" || codeInput.length < 6}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60">
          {gateState === "verifying" ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  </form>
)}
```

**Remove from the file:**
- `const MANAGE_PASSWORD = process.env.NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD;`
- The old `unlockGate` function entirely
- The old `passwordInput` state
- `useSignIn` import if already present with old usage

**Remove from `.env.local` and `docs/setup/LOCAL_SETUP.md`:**
- `NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD` — no longer needed

---

## Files to change

| File | Action |
|---|---|
| `src/app/page.tsx` | Create — smart redirect page |
| `src/app/profiles/page.tsx` | Fix `confirmSignOut` |
| `src/app/profiles/manage/manage-dashboard.tsx` | Fix `confirmSignOut` + replace `unlockGate` |
| `docs/setup/LOCAL_SETUP.md` | Remove `NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD` from Section 9b |
| `.env.local` | Remove `NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD` |

---

## QA checks

Before committing:

- [ ] `http://localhost:3000/` redirects to `/profiles` when not signed in
- [ ] `http://localhost:3000/` redirects to `/portal` when signed in with active profile
- [ ] `http://localhost:3000/` redirects to `/profiles` when signed in but no active profile
- [ ] Sign out → confirm → sign back in → sign-out modal is NOT visible
- [ ] Manage Profiles gate shows masked email and "Send code" button
- [ ] Clicking "Send code" delivers OTP to email (check inbox)
- [ ] Correct code unlocks the dashboard
- [ ] Wrong code shows inline error and stays on code input
- [ ] "Resend code" sends a new code without losing state
- [ ] `npm run lint` — 0 errors
- [ ] `make qa-run2` — 14/14 passing

---

## Definition of Done

All QA checks above pass. `NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD` removed from all files.
Root `/` never returns 404. Sign-out modal never persists after sign-in.
