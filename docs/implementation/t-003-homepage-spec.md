# T-003 Spec — Identity Shell Homepage

**Status:** APPROVED — ready for implementation  
**Branch:** `codex/homepage`  
**Spec References:** `BASELINE.md`, `docs/architecture/identity-federation-core.md`

---

## One-line scope

Replace `src/app/page.tsx` with a 3-state identity-aware shell. Move the existing harness page to `/internal`. No new Convex schema required.

---

## State machine

The homepage resolves one of three states on every load. No explicit sub-routes. Everything lives at `/`.

| State | Condition | What renders |
|---|---|---|
| 1 | Clerk session does not exist | Login screen |
| 2 | Clerk session exists, `getActiveProfile` returns null | Profile picker |
| 3 | Clerk session exists, `getActiveProfile` returns a profile | App launcher |

**Resolution order — source of truth rule:**
1. Check Clerk session first (client-side, instant)
2. Check `getActiveProfile` from Convex (authoritative)
3. Never derive state from JWT claims on the homepage — Convex is the authority

**Conflict rule:** if a JWT claim contains a `profileId` but `getActiveProfile` returns null or a different profile, **Convex wins**. The JWT is a carry mechanism, not the source of truth.

---

## State transitions

**State 1 → State 2:** User completes Clerk sign-in. Clerk session is established. Page re-renders automatically via `useAuth()`. No redirect needed.

**State 2 → State 3:** User clicks a profile card. `setActiveProfile` mutation runs. `getActiveProfile` query updates reactively. Page re-renders to State 3 automatically. No redirect needed.

**State 3 → State 2:** User clicks "Switch profile". Call `clearActiveProfile` mutation (new — see below). `getActiveProfile` returns null. Page re-renders to State 2.

**State 3 → State 1:** User clicks "Sign out" via Clerk `SignOutButton`. Session ends. Page re-renders to State 1.

**Session expiry:** Clerk handles this. When session expires, `useAuth()` returns `isSignedIn: false`. Page drops to State 1 naturally.

**Profile invalidated:** If `getActiveProfile` returns null because the active profile was archived or suspended, page drops to State 2. User must re-select.

---

## New Convex mutation required

Add to `convex/profiles.ts`:

```typescript
export const clearActiveProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await getUserForIdentity(ctx);
    const existing = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
```

No schema changes needed. `activeProfiles` table already exists.

---

## New Convex query required

Add to `convex/profiles.ts`:

```typescript
export const getAppsForActiveProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return [];
    const active = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .first();
    if (!active) return [];
    const profile = await ctx.db.get(active.profileId);
    if (!profile || profile.status !== "active") return [];
    // Phase 1: return same apps for all profiles
    // Phase 2: filter by profile permissions
    return [
      { id: "game", name: "Game", url: "https://game.zurot.org", description: "Play" },
      { id: "bbb", name: "BBB", url: "https://bbb.zurot.org", description: "Learn" },
      { id: "vibe", name: "Vibe", url: "https://vibe.zurot.org", description: "Create" },
    ];
  },
});
```

**Important:** return a typed array from Convex, not a hardcoded array in the component. The structure is what matters now. Phase 2 adds per-profile filtering without changing the component.

---

## UI blocks per state

**State 1 — Login screen:**
- ZurOt logo / wordmark centered
- Single line: "Your access point to all your apps"
- Clerk `<SignInButton mode="modal">` — one button only
- No navigation, no links, no marketing copy

**State 2 — Profile picker:**
- "Who's using ZurOt?" heading
- Grid of profile cards — each shows avatar initial, display name, handle
- Clicking a card calls `setActiveProfile` and triggers re-render to State 3
- If user has no profiles: show "No profiles yet" with a link to `/internal` to create one
- No "create profile" form on this screen — keep it clean

**State 3 — App launcher:**
- "Welcome, [displayName]" heading
- Profile badge top-right: avatar initial, handle, "Switch profile" link
- "Your Apps" section: grid of app cards from `getAppsForActiveProfile`
- Each app card: name, description, links to subdomain
- Sign out button

---

## Route for existing harness

Move current `src/app/page.tsx` content to `src/app/internal/page.tsx`. This preserves profile creation, the checklist, and archive functionality at `/internal`. Do not delete it — it is needed for development.

Add a note in `README.md` that `/internal` is the developer harness page.

---

## Files to change

| File | Action |
|---|---|
| `src/app/page.tsx` | Replace entirely with 3-state shell |
| `src/app/internal/page.tsx` | New file — move current page.tsx content here |
| `convex/profiles.ts` | Add `clearActiveProfile` mutation and `getAppsForActiveProfile` query |
| `README.md` | Add note about `/internal` route |

---

## Acceptance criteria

- State 1 renders when not signed in — only login button visible, no other content
- State 2 renders when signed in with no active profile — profile cards visible, clicking one transitions to State 3
- State 3 renders when active profile is set — app launcher visible with profile name and app cards
- "Switch profile" clears active profile and returns to State 2
- Sign out returns to State 1
- If active profile is archived or suspended, page drops to State 2 automatically
- `/internal` still works for profile creation and management
- Lint passes, build passes, smoke tests pass
- No hardcoded app list in the component — apps come from Convex query
