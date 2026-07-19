# ZurOt — Decisions and deferred architecture

Last updated: 2026-07-19. Keep this file short. One line per decision.

## Vision (target model, agreed)
- One account per person/authority (email login). The account owner (owner PIN)
  is the only administrative authority inside the account.
- Profiles are workspaces ("hats"), not identities. One human may hold several
  (parent, teacher x2, school manager, grandparent...).
- Two trust tiers only: kid (free to create, no power) and adult (creation
  requires owner approval via owner PIN). The hat chosen for an adult profile
  is a catalog preset, not a trust level.
- Cross-account relationships are socially person-to-person but technically
  profile-to-profile: the requesting adult profile connects to one specific kid
  profile; the receiving account owner picks the target profile and approves
  with their owner PIN. Likely mechanism: short-lived invite codes (same
  pattern as device pairing).
- App availability per profile is a state, not a boolean:
  included / requestable / hidden, combined with request status
  pending / approved / declined. Approval must change real token scopes.

## Deferred intentionally (do not build yet)
- Household/org-level device ownership; device assignment vs ownership
  (devices D1 already stores account_id as the migration escape hatch).
- Granular device scopes (devices:view_assigned etc.).
- App publication lifecycle (draft/internal/pilot/published).
- Credits, entitlements, token top-ups (parents fund, apps ask the hub).
- Student Coach product (student-facing companion on the same Android agent).
- Teacher-student connections across accounts; school-manager hat; invite codes.
- Renaming roles to kid/adult + hat presets (current student/parent/teacher
  labels map onto it; rename when connections work starts).

Reason for all deferrals: no complete family-zero journey has been validated
yet. Revisit only when a real tested workflow demonstrates the need.
