# ZurOt JWT Token Contract

Canonical token contract for all federated apps.
Read this before implementing auth in any consumer app.

## Claims

| Claim | Type | Example |
|---|---|---|
| `sub` | string | `profile_js71q9tyv7a18efcz8amqnf18n83kj18` |
| `iss` | string | `http://localhost:3000` |
| `aud` | string | `mall-hebrew-adventures` |
| `iat` | number | `1774401214` |
| `exp` | number | `1774402114` |
| `name` | string | `Noam` |
| `preferred_username` | string | `noam` |
| `account_id` | string | `account_jx7cdeef3vfwczg4mchm2w70gs83kqmf` |
| `scopes` | string[] | `["game:instructor", "game:viewer"]` |

## Scope Claim Rules

- Permissions are read from `scopes` (plural).
- `scopes` is an array of strings.
- Scope format is `product:permission` (example: `game:player`, `lms:grader`).
- Standard OIDC `scope` (singular, space-separated string) is not used in ZurOt tokens.
- Federated apps must not read permissions from `scope`; use `scopes` only.
