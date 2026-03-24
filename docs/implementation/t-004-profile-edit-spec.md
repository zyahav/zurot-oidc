# T-004 Spec — Profile Edit

**Status:** APPROVED — ready for implementation  
**Branch:** `codex/profile-edit`  
**Spec References:** `BASELINE.md`, `docs/implementation/phase-0-hub-profile-authority.md`

---

## One-line scope

Add profile edit capability: a new `editProfile` Convex mutation and an edit UI in `/internal`. No schema changes required. No changes to the homepage shell.

---

## What is missing today

The Phase 0 guide defines Profile CRUD as: Create, Edit, Archive. Create and Archive are implemented. Edit is missing. This task closes that gap.

---

## What can be edited

Per `docs/implementation/phase-0-hub-profile-authority.md` Section 4:

- `displayName` — editable
- `avatarUrl` — editable (optional field, already in schema)

**Not editable:**
- `handle` — unique identifier, changing it would break references
- `role` — sensitive, should require a separate admin flow in future
- `status` — controlled by archive/restore, not edit
- `userId` — ownership is immutable

---

## New Convex mutation required

Add to `convex/profiles.ts`:

```typescript
export const editProfile = mutation({
  args: {
    profileId: v.id("profiles"),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getUserForIdentity(ctx);

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.userId !== user._id) {
      throw new Error("Profile not found or not owned by current user");
    }
    if (profile.status === "archived") {
      throw new Error("Cannot edit an archived profile");
    }

    const updates: { displayName?: string; avatarUrl?: string } = {};
    if (args.displayName !== undefined) {
      if (args.displayName.trim().length === 0) {
        throw new Error("Display name cannot be empty");
      }
      updates.displayName = args.displayName.trim();
    }
    if (args.avatarUrl !== undefined) {
      // Empty string clears the avatar
      updates.avatarUrl = args.avatarUrl.trim() === "" ? null : args.avatarUrl.trim();
    }

    await ctx.db.patch(args.profileId, updates);
  },
});
```

No schema changes needed. `avatarUrl` is already `v.optional(v.string())` in the schema.

---

## UI — where it lives

Edit UI belongs in `/internal` (`src/app/internal/page.tsx`) only.

Do NOT add edit to the homepage shell (`src/app/page.tsx`). The homepage is for identity selection and app launching, not profile management.

The edit flow in `/internal`:
- Each profile card in the "Your profiles" list gets an **Edit** button alongside the existing Archive button
- Clicking Edit opens an inline edit form below the profile card (not a modal, not a new page)
- Form fields: Display name (text input, pre-filled), Avatar URL (text input, pre-filled or empty)
- Submit calls `editProfile` mutation
- On success: form closes, profile card updates reactively via Convex
- On error: show error message inline
- Cancel button closes the form without saving

---

## Validation rules

- `displayName`: required, minimum 1 character after trim, maximum 64 characters
- `avatarUrl`: optional, if provided must start with `http://` or `https://`
- Both validated client-side before submission and server-side in the mutation

---

## Files to change

| File | Action |
|---|---|
| `convex/profiles.ts` | Add `editProfile` mutation |
| `src/app/internal/page.tsx` | Add Edit button and inline edit form to profile list |

---

## Acceptance criteria

- `editProfile` mutation exists and is callable
- Editing `displayName` updates the profile and reflects immediately in the UI
- Editing `avatarUrl` updates the profile and reflects immediately in the UI
- Cannot edit an archived profile (mutation throws, UI should not offer edit for archived profiles)
- Cannot set `displayName` to empty string
- Handle is not editable
- Role is not editable
- Edit UI is in `/internal` only — homepage shell is unchanged
- Lint passes, build passes, smoke tests pass

---

## Convex optional field semantics (implementation note)

In Convex, optional fields (`v.optional(v.string())`) are cleared by passing `undefined`, not `null`. Passing `null` is a type error in Convex.

This means:
- General API design principle: `null = explicitly cleared`
- Convex runtime reality: `undefined = clear optional field`

The implementation correctly uses `undefined` to clear `avatarUrl`. This is an intentional, documented deviation from general API convention. Do not change this to `null` — it will break the Convex mutation.
