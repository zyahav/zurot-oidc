/**
 * Persona → Scope Translation Engine
 * 
 * OIDC Spec v1.3 Section 4 Requirements:
 * - Each Profile has ONE Persona (default identity lens)
 * - Persona is used ONLY to derive default scopes per product
 * - Persona does NOT limit what scopes a profile can receive
 * - Subdomains NEVER see personas, only scopes
 * 
 * Phase 1: Hardcoded mappings in TypeScript
 * Phase 2: Move to database without rewriting OIDC logic
 * 
 * @module translation-engine
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Known Persona types in the ZurOt system
 * These map to the `role` field in the profiles table
 */
export type Persona = 
  | "teacher"
  | "student" 
  | "admin"
  | "parent"
  | "guest";

/**
 * Known products/subdomains in the ZurOt ecosystem
 * Each product has its own scope namespace
 */
export type Product = 
  | "cms"      // Content Management System
  | "lms"      // Learning Management System
  | "portal"   // Parent/Admin Portal
  | "hub"      // ZurOt Hub itself
  | "game";    // Mall Hebrew Adventures

/**
 * Scope format: "product:permission"
 * Examples: "cms:editor", "lms:student", "portal:viewer"
 */
export type Scope = `${Product}:${string}`;

/**
 * Per-profile scope override
 * Allows granting additional scopes beyond persona defaults
 */
export interface ScopeOverride {
  profileId: string;
  product: Product;
  scopes: Scope[];
}

// =============================================================================
// Default Persona → Scope Mappings
// =============================================================================

/**
 * Default scopes granted to each persona for each product
 * 
 * Structure: persona → product → scopes[]
 * 
 * Phase 2 Migration Path:
 * - Move this to a Convex table: personaScopeMappings
 * - Schema: { persona: string, product: string, scopes: string[] }
 * - Query at runtime instead of importing this constant
 */
const PERSONA_SCOPE_DEFAULTS: Record<Persona, Partial<Record<Product, Scope[]>>> = {
  teacher: {
    cms: ["cms:editor", "cms:viewer", "cms:publish"],
    lms: ["lms:instructor", "lms:grader", "lms:viewer"],
    portal: ["portal:viewer"],
    hub: ["hub:profile", "hub:settings"],
    game: ["game:instructor", "game:viewer"],
  },
  
  student: {
    cms: ["cms:viewer"],
    lms: ["lms:student", "lms:viewer"],
    portal: [], // Students don't access portal
    hub: ["hub:profile"],
    game: ["game:player"],
  },
  
  admin: {
    cms: ["cms:admin", "cms:editor", "cms:viewer", "cms:publish", "cms:delete"],
    lms: ["lms:admin", "lms:instructor", "lms:grader", "lms:viewer"],
    portal: ["portal:admin", "portal:viewer", "portal:reports"],
    hub: ["hub:admin", "hub:profile", "hub:settings", "hub:users"],
    game: ["game:instructor", "game:viewer", "game:player", "game:observer", "game:admin"],
  },
  
  parent: {
    cms: ["cms:viewer"],
    lms: ["lms:viewer"], // View-only for student progress
    portal: ["portal:parent", "portal:viewer"],
    hub: ["hub:profile"],
    game: ["game:observer"],
  },
  
  guest: {
    cms: ["cms:viewer"],
    lms: ["lms:viewer"],
    portal: [],
    hub: ["hub:profile"],
    game: [],
  },
};

// =============================================================================
// Translation Engine API
// =============================================================================

/**
 * Translate a persona to scopes for a specific product
 * 
 * @param persona - The user's persona (role)
 * @param product - Target product/subdomain
 * @param overrides - Optional per-profile overrides (Phase 2: from database)
 * @returns Array of scopes for the token
 * 
 * @example
 * ```ts
 * const scopes = translatePersonaToScopes("teacher", "cms");
 * // Returns: ["cms:editor", "cms:viewer", "cms:publish"]
 * ```
 */
export function translatePersonaToScopes(
  persona: string,
  product: string,
  overrides?: ScopeOverride[]
): string[] {
  // Normalize inputs
  const normalizedPersona = persona.toLowerCase() as Persona;
  const normalizedProduct = product.toLowerCase() as Product;
  
  // Check for per-profile override first (Phase 2: query from DB)
  const override = overrides?.find(
    o => o.product === normalizedProduct
  );
  
  if (override) {
    // Override completely replaces defaults
    return override.scopes;
  }
  
  // Get default scopes for this persona + product combination
  const personaDefaults = PERSONA_SCOPE_DEFAULTS[normalizedPersona];
  
  if (!personaDefaults) {
    // Unknown persona - return minimal scopes
    console.warn(`[Translation Engine] Unknown persona: ${persona}, using guest defaults`);
    return PERSONA_SCOPE_DEFAULTS.guest[normalizedProduct] || [];
  }
  
  const scopes = personaDefaults[normalizedProduct];
  
  if (!scopes) {
    // Product not configured for this persona
    return [];
  }
  
  return [...scopes]; // Return copy to prevent mutation
}

/**
 * Get all available personas
 * Phase 2: Query from database
 */
export function getAvailablePersonas(): Persona[] {
  return Object.keys(PERSONA_SCOPE_DEFAULTS) as Persona[];
}

/**
 * Get all scopes a persona has access to across all products
 * Useful for debugging and admin interfaces
 */
export function getAllScopesForPersona(persona: string): Record<string, string[]> {
  const normalizedPersona = persona.toLowerCase() as Persona;
  const personaDefaults = PERSONA_SCOPE_DEFAULTS[normalizedPersona];
  
  if (!personaDefaults) {
    return {};
  }
  
  const result: Record<string, string[]> = {};
  for (const [product, scopes] of Object.entries(personaDefaults)) {
    if (scopes && scopes.length > 0) {
      result[product] = [...scopes];
    }
  }
  
  return result;
}

/**
 * Validate that a scope string is properly formatted
 */
export function isValidScope(scope: string): boolean {
  const pattern = /^[a-z]+:[a-z_]+$/;
  return pattern.test(scope);
}

/**
 * Extract product from a scope string
 */
export function extractProductFromScope(scope: string): string | null {
  const parts = scope.split(":");
  return parts.length === 2 ? parts[0] : null;
}

export function scopeBelongsToProduct(scope: string, product: Product): boolean {
  if (!scope.includes(":")) return false;
  const scopeProduct = scope.split(":")[0];
  return scopeProduct === product;
}

export function filterScopesToProduct(scopes: string[], product: Product): string[] {
  return scopes.filter(scope => scopeBelongsToProduct(scope, product));
}

/**
 * Resolve client_id to product name
 * Phase 2: Query from oauthClients table with product field
 */
export function resolveClientToProduct(clientId: string): Product {
  // Phase 1: Simple mapping based on client_id patterns
  // Phase 2: Look up in oauthClients table
  const clientProductMap: Record<string, Product> = {
    "test-client": "hub",
    "cms-client": "cms",
    "lms-client": "lms",
    "portal-client": "portal",
    "mall-hebrew-adventures": "game",
  };
  
  // Check exact match first
  if (clientProductMap[clientId]) {
    return clientProductMap[clientId];
  }
  
  // Check prefix patterns
  if (clientId.startsWith("cms-")) return "cms";
  if (clientId.startsWith("lms-")) return "lms";
  if (clientId.startsWith("portal-")) return "portal";
  
  // Default to hub
  return "hub";
}
