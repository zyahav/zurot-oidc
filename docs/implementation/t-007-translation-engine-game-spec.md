# T-007 Spec — Translation Engine: Game Product + Scope Isolation

**Status:** APPROVED — ready for implementation  
**Branch:** `codex/game-translation`  
**Spec References:** `BASELINE.md`, `docs/architecture/identity-federation-core.md`, `src/lib/translation-engine.ts`

---

## One-line scope

Add `game` as an explicit product in the translation engine, map `mall-hebrew-adventures` client to it, define scope translations per persona, and enforce that tokens issued for any client contain ONLY scopes for that client's resolved product.

---

## Why this must be done before T-008

The auth integration in `mall-hebrew-adventures` depends on receiving correct, isolated game scopes in the token. If this contract is not correct first, T-008 builds on a broken foundation.

---

## Required changes in `src/lib/translation-engine.ts`

### 1. Add `game` to the `Product` type
```typescript
export type Product = 
  | "cms" | "lms" | "portal" | "hub"
  | "game";  // ADD
```

### 2. Add game scope mappings to `PERSONA_SCOPE_DEFAULTS`
```typescript
teacher: { game: ["game:instructor", "game:viewer"], ... }
student: { game: ["game:player"], ... }
admin:   { game: ["game:instructor", "game:viewer", "game:player", "game:observer", "game:admin"], ... }
parent:  { game: ["game:observer"], ... }
guest:   { game: [], ... }
```

Scope definitions:
- `game:instructor` — see all players, progress, activate camera/audio controls
- `game:player` — play the game
- `game:viewer` — read-only view
- `game:observer` — parent view: see child's session only
- `game:admin` — full administrative access

### 3. Add explicit client → product mapping

In `resolveClientToProduct`:
```typescript
"mall-hebrew-adventures": "game",  // explicit — no fallback
```

### 4. Add `filterScopesToProduct` function
```typescript
export function scopeBelongsToProduct(scope: string, product: Product): boolean {
  if (!scope.includes(":")) return false;
  const scopeProduct = scope.split(":")[0];
  return scopeProduct === product;
}

export function filterScopesToProduct(scopes: string[], product: Product): string[] {
  return scopes.filter(scope => scopeBelongsToProduct(scope, product));
}
```

### 5. Apply isolation in token endpoint

In `src/app/api/oauth/token/route.ts`, after translation:
```typescript
const product = resolveClientToProduct(clientId);
const rawScopes = translatePersonaToScopes(persona, product);
const scopes = filterScopesToProduct(rawScopes, product);
```

---

## Tests required

File: `src/lib/translation-engine.test.ts`

1. `translatePersonaToScopes("teacher", "game")` → `["game:instructor", "game:viewer"]`
2. `translatePersonaToScopes("student", "game")` → `["game:player"]`
3. `translatePersonaToScopes("parent", "game")` → `["game:observer"]`
4. `translatePersonaToScopes("guest", "game")` → `[]`
5. `resolveClientToProduct("mall-hebrew-adventures")` → `"game"`
6. `filterScopesToProduct(["game:instructor", "lms:grader", "hub:admin"], "game")` → `["game:instructor"]`
7. Token for `mall-hebrew-adventures` + `teacher` persona → scopes are exactly `["game:instructor", "game:viewer"]`, no `lms:*` or `hub:*`

---

## Files to change

| File | Action |
|---|---|
| `src/lib/translation-engine.ts` | Add `game` product, mappings, `filterScopesToProduct`, explicit client mapping |
| `src/app/api/oauth/token/route.ts` | Apply `filterScopesToProduct` after translation |
| `src/lib/translation-engine.test.ts` | New — 7 test cases |

---

## Acceptance criteria

- `game` product exists in `Product` type
- All five personas have `game` scope mappings
- `resolveClientToProduct("mall-hebrew-adventures")` returns `"game"`
- `filterScopesToProduct` exists and filters correctly
- Token endpoint applies `filterScopesToProduct` before issuing
- Token for `mall-hebrew-adventures` teacher contains exactly `["game:instructor", "game:viewer"]`
- All 7 tests pass
- Lint passes, build passes, smoke tests pass
