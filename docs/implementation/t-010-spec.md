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

## Fix 3 — Manage Profiles password gate uses Clerk

### What the bug is

The gate compares `passwordInput !== NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD`. This is a
static env var, not the user's real Clerk account password. The spec (Section 10) states:
"In production this is the Clerk account password."

### What the fix is

Use Clerk's `useSignIn` hook to attempt password verification without creating a new session.

**In `src/app/profiles/manage/manage-dashboard.tsx`:**

Add imports:
```typescript
import { SignInButton, useAuth, useClerk, useSignIn, useUser } from "@clerk/nextjs";
```

Add hooks inside the component:
```typescript
const { signIn } = useSignIn();
const { user } = useUser();
```

Replace `unlockGate` with:
```typescript
const unlockGate = async (event: FormEvent) => {
  event.preventDefault();
  setGateError(null);

  if (!signIn || !user) {
    setGateError("Authentication unavailable. Please refresh the page.");
    return;
  }

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) {
    setGateError("No email address found on this account.");
    return;
  }

  try {
    const result = await signIn.create({
      strategy: "password",
      identifier: email,
      password: passwordInput,
    });

    if (result.status === "complete") {
      // Password verified — do NOT activate the resulting session.
      // We only needed to confirm the password was correct.
      sessionStorage.setItem(MANAGE_GATE_SESSION_KEY, "1");
      setIsUnlocked(true);
      setPasswordInput("");
    } else {
      setGateError("Incorrect account password.");
    }
  } catch {
    setGateError("Incorrect account password.");
  }
};
```

Remove these lines from the top of the file:
```typescript
// REMOVE:
const MANAGE_PASSWORD = process.env.NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD;
```

Remove `NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD` from `.env.local` and from `docs/setup/LOCAL_SETUP.md`
Section 9b. It is no longer needed.

**Important:** `signIn.create()` with `strategy: "password"` creates a sign-in attempt
object. When `status === "complete"` it means the password is correct. Do NOT call
`setActive()` on the result — that would switch the active Clerk session, which is not
what we want. We only use this API to verify the password.

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
- [ ] Manage Profiles gate accepts real Clerk account password
- [ ] Manage Profiles gate rejects wrong password with inline error
- [ ] `npm run lint` — 0 errors
- [ ] `make qa-run2` — 14/14 passing

---

## Definition of Done

All QA checks above pass. `NEXT_PUBLIC_ZUROT_MANAGE_PASSWORD` removed from all files.
Root `/` never returns 404. Sign-out modal never persists after sign-in.
