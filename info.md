# ZurOt Hub / OIDC - Project Info

Last updated: 2026-07-14

## Fast Glance

This repo is the ZurOt identity hub and OIDC provider.

It owns:

- Account sign-in through Clerk.
- ZurOt profiles under one human account.
- Profile selection.
- OIDC/OAuth tokens for ZurOt apps.
- The app portal and profile management flow.

Important production domains:

```text
zurot.org       - public root domain
app.zurot.org   - hub UI: profiles, portal, app launcher, manage profiles
auth.zurot.org  - OIDC issuer and auth endpoints
```

The current provider contract is profile-scoped:

```text
sub = profile_<profileId>
account_id = account_<userId>
```

Apps should use the selected profile identity, not email or Clerk user ID, as their app user key.

## Why We Built It

ZurOt is becoming a house of tools for teachers. The same teacher may use many apps:

- phone follow-up
- Meta/Facebook ads
- Google Ads
- CRM/contact memory
- calendar assistant
- learning games
- public profile/discovery pages

Without one identity hub, every app would create its own login, its own user model, and its own profile confusion.

This repo exists so all ZurOt apps can ask one trusted place:

```text
Who is acting now, and which profile are they using?
```

The answer is not only the human account. It is the selected ZurOt profile.

## Current Identity Model

One human account can own multiple profiles.

Examples:

- Zuriel as owner/teacher.
- A teacher profile.
- A child/student profile.
- A parent profile.

During OIDC authorization, the signed-in user chooses a profile. Tokens are issued for that profile.

Current token shape:

- `sub`: `profile_<profileId>`
- `account_id`: account-level context
- `name`: profile display name
- `preferred_username`: current generated profile handle
- `https://zurot.org/profile_context`: profile metadata

Important: the current code generates handles as `profile_<id>`. A real public handle like `@zuriel` is not implemented yet as a stored profile field.

## Public Handle Vision

The next product layer is public profile identity:

```text
https://zurot.org/@zuriel
```

Zuriel wants this to feel like a TikTok-style public profile:

- public handle
- profile page
- scrolling media/feed
- shareable identity
- useful for discovery and trust

This should be connected to ZurOt identity, but it should not break OIDC.

Recommended rule:

```text
OIDC stable identity = profileId / sub
Public identity = handle / @username
```

The public handle can change or be moderated. The OIDC `sub` should stay stable.

## Phone App Connection

One important next step is connecting `phone.zurot.org` to this identity hub.

The phone app should not own login directly. It should use ZurOt OIDC:

```text
issuer: https://auth.zurot.org
client_id: phone
redirect_uri: https://phone.zurot.org/auth/callback
flow: Authorization Code with PKCE
```

Why this matters:

- Phone calls must be tied to a ZurOt profile.
- Permissions can depend on profile/user role.
- We need to know which teacher/coordinator called a lead.
- Country calling privileges can be controlled centrally.
- Future CRM/lead history can attach to the same profile identity.

## Why Public Handle Is Separate From Login

The public `@handle` should not simply be the same thing as display name.

Reasons:

- Display names can repeat.
- Children should not freely choose public handles.
- Handles are public URLs and may need moderation.
- A teacher may want a professional public handle.
- OIDC needs stable identifiers even if the public handle changes.

So the model should be:

```text
profileId: stable internal identity
displayName: editable visible name
handle: public URL identity, unique and controlled
```

## Current Status

From the current repo docs:

- OIDC provider exists.
- Profile-scoped tokens exist.
- RS256 signing and JWKS exist.
- OIDC discovery exists.
- Profile management exists.
- Federated-app integration guide exists.
- Phone and Meta are documented as future/consumer apps.
- TASKS.md shows T-001 through T-011 mostly done, with T-012 production deploy gate planned.

Current local git status seen by Codex on 2026-07-14:

- Branch: `main...origin/main`
- Modified: `.DS_Store`
- Untracked: `docs/dorit-master-handoff-spec.html`

Those were not changed by this info update.

## What Is Not Done Yet

The following are not complete platform capabilities yet:

- Stored unique public handles like `zuriel`.
- Public route `zurot.org/@handle`.
- TikTok-style public profile/feed product.
- Handle reservation and moderation rules.
- Child-safe handle policy.
- Phone app login through OIDC.
- Product-specific scopes for phone permissions.
- Country/calling privilege model.
- Handle resolution API for other apps.
- Public activity/media feed API.

## Next Honest Steps

Recommended next steps:

1. Add a real `handle` field to profiles.
2. Define handle rules:
   - unique
   - lowercase/canonical
   - reserved words blocked
   - child-safe approval policy
   - handle can be changed only by owner/admin
3. Create Zuriel's own profile and reserve a public handle, probably `zuriel`.
4. Keep `sub = profile_<profileId>` unchanged.
5. Update userinfo/token behavior only after deciding whether `preferred_username` should expose the public handle.
6. Register `phone` as an OIDC client and connect the phone app login.
7. Add phone permission scopes, especially country/calling privileges.
8. Decide whether public `@handle` pages live in this repo or a standalone public-profile repo.
9. Build or connect the TikTok-style profile/feed app.
10. Route `https://zurot.org/@handle` to the public profile experience.

Recommended architecture:

```text
zurot-hub-monorepo
  owns login, profiles, OIDC, profile IDs, handle registry

public profile/feed app
  owns TikTok-like public profile pages and scrolling media

zurot.org/@handle
  public route that resolves handle and shows the profile/feed
```

## How We Know It Worked

Identity success:

- A user can sign in once through ZurOt.
- The user can create/select a profile.
- Federated apps receive a valid profile-scoped token.
- Apps store data by `sub`, not email.
- Profile switching is handled through ZurOt, not inside each app.

Phone connection success:

- Zuriel can log into `phone.zurot.org` through ZurOt OIDC.
- Phone app knows the selected profile.
- Calls are logged under the selected profile subject.
- A user without calling privilege is blocked.
- Allowed destination countries and caller-number countries are enforced.

Public handle success:

- `zurot.org/@zuriel` resolves to Zuriel's public profile.
- Public handle is unique and stable enough to share.
- Display name can change without breaking the URL.
- OIDC `sub` remains stable even if public profile details change.
- The profile page can show a scrolling video/feed experience.

## Safety Notes

This repo is identity infrastructure. Mistakes here affect all ZurOt apps.

Be careful with:

- token claims
- issuer URLs
- redirect URI validation
- signing keys
- account/profile separation
- child profile privacy
- public handle exposure
- app permissions
- profile deletion

Do not expose secrets, Clerk private data, raw tokens, signing keys, or private child/profile data in public pages or reports.

