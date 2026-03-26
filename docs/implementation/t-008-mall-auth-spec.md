# T-008 Spec — ZurOt Auth Integration for mall-hebrew-adventures

**Status:** APPROVED — ready for implementation
**Branch:** `codex/mall-auth`
**Repo:** `mall-hebrew-adventures`
**Depends on:** T-007 (zurot-oidc) — must be complete first

---

## One-line scope

Add a self-contained ZurOt OIDC auth module to mall-hebrew-adventures that gates app entry behind authentication, exposes `user` and `hasScope()` to the app, and handles the three explicit auth states.

---

## Binding constraints (non-negotiable)

1. `user.role` must NEVER appear in app code — authorization via `hasScope()` only
2. Token for this client contains only `game:*` scopes — enforced by T-007
3. Three auth states must be explicit: `NOT_AUTHENTICATED`, `AUTHENTICATED_NO_ACCESS`, `AUTHENTICATED_WITH_ACCESS`
4. `hasScope()` supports exact match AND wildcard (`game:*`)
5. `ZurotAuthProvider` exposes ONLY: `user`, `hasScope`, `login`, `logout`

---

## Environment variables required

Add to `.env.local` and `.env.example`:
```
VITE_ZUROT_ISSUER=http://localhost:3000
VITE_ZUROT_CLIENT_ID=mall-hebrew-adventures
VITE_ZUROT_REDIRECT_URI=http://localhost:8080/auth/callback
```

---

## Files to create

### `src/integrations/zurot/config.ts`
```typescript
export const zurotConfig = {
  issuer: import.meta.env.VITE_ZUROT_ISSUER,
  clientId: import.meta.env.VITE_ZUROT_CLIENT_ID,
  redirectUri: import.meta.env.VITE_ZUROT_REDIRECT_URI,
  authorizationEndpoint: `${import.meta.env.VITE_ZUROT_ISSUER}/oauth/authorize`,
  tokenEndpoint: `${import.meta.env.VITE_ZUROT_ISSUER}/api/oauth/token`,
};
```

### `src/integrations/zurot/auth.ts`

Implements:
- `login()` — redirects to ZurOt authorize endpoint with PKCE
- `handleCallback(code, state)` — exchanges code for token, stores in sessionStorage
- `getUser()` — returns decoded token payload or null
- `logout()` — clears stored token

PKCE flow:
- Generate `code_verifier` (random 43-128 char string)
- Compute `code_challenge` = BASE64URL(SHA256(code_verifier))
- Store `code_verifier` in sessionStorage before redirect
- Include `code_challenge` and `code_challenge_method=S256` in authorize request
- Send `code_verifier` in token exchange

User shape (from decoded JWT — no `role` exposed):
```typescript
export interface ZurotUser {
  sub: string;              // profile_
  name: string;             // display name
  preferred_username: string; // handle
  scopes: string[];         // game:* scopes only
  account_id: string;       // human account context
}
```
Note: scopes are read from the `scopes` JWT claim (array), not `scope` (string). See `docs/architecture/token-contract.md`.

### `src/integrations/zurot/ZurotAuthProvider.tsx`

React context. Exposes ONLY:
```typescript
interface ZurotAuthContext {
  user: ZurotUser | null;
  authState: "NOT_AUTHENTICATED" | "AUTHENTICATED_NO_ACCESS" | "AUTHENTICATED_WITH_ACCESS";
  hasScope: (scope: string) => boolean;
  login: () => void;
  logout: () => void;
}
```

State machine:
- `NOT_AUTHENTICATED`: no token in sessionStorage
- `AUTHENTICATED_NO_ACCESS`: token valid but `user.scopes.length === 0`
- `AUTHENTICATED_WITH_ACCESS`: token valid and at least one `game:*` scope present

`hasScope` implementation:
```typescript
// Exact match: hasScope("game:instructor")
// Wildcard: hasScope("game:*") — user with game:* passes any game: check
function hasScope(scope: string): boolean {
  if (!user) return false;
  if (user.scopes.includes(scope)) return true;
  // Check if user has wildcard for this product
  const product = scope.split(":")[0];
  if (user.scopes.includes(`${product}:*`)) return true;
  return false;
}
```

### `src/pages/AuthCallback.tsx`

Route handler for `/auth/callback`:
- Reads `code` and `state` from URL params
- Calls `handleCallback(code, state)`
- On success: redirects to `/`
- On error: shows error message with logout option

---

## Files to modify

### `src/App.tsx`

Wrap with `ZurotAuthProvider`. Add `/auth/callback` route:
```typescript
} />
```

### `src/pages/Index.tsx`

Gate entry behind auth state:
```typescript
const { authState, login } = useZurotAuth();

if (authState === "NOT_AUTHENTICATED") {
  // redirect to login automatically
  login();
  return null;
}

if (authState === "AUTHENTICATED_NO_ACCESS") {
  return ;
}

// authState === "AUTHENTICATED_WITH_ACCESS"
return ...;
```

### `src/pages/NoAccessScreen.tsx` (new)

Dedicated screen for `AUTHENTICATED_NO_ACCESS` state:
- Message: "Your profile does not have access to this game"
- Button: "Switch Profile" — calls `logout()` then redirects to ZurOt profile picker
- Button: "Sign Out" — calls `logout()`
- No game content rendered

---

## Acceptance criteria

- Unauthenticated users are redirected to ZurOt login automatically
- After login, user lands back on the game with correct scopes
- `AUTHENTICATED_NO_ACCESS` state shows `NoAccessScreen` — no game rendered
- `AUTHENTICATED_WITH_ACCESS` state shows the game normally
- `hasScope("game:instructor")` returns true for teacher profiles
- `hasScope("game:player")` returns true for student profiles
- `hasScope("game:*")` returns true for admin profiles
- `user.role` does not appear anywhere in app code — violation of spec
- Authorization checks use `hasScope()` only
- Lint passes, build passes
