import * as jose from "jose";

// =============================================================================
// RSA Key Configuration for RS256 Signing
// =============================================================================
// In production: RSA_PRIVATE_KEY and RSA_PUBLIC_KEY must be set as PEM strings
// In development: Falls back to generated dev keys (NOT for production use)
// =============================================================================

let privateKey: jose.CryptoKey | jose.KeyObject | null = null;
let publicKey: jose.CryptoKey | jose.KeyObject | null = null;
let publicKeyJWK: jose.JWK | null = null;

// Key ID for JWKS - should be rotated when keys change
const KEY_ID = "zurot-rs256-key-1";

const ISSUER = process.env.NEXT_PUBLIC_APP_URL || "https://zurot.org";

/**
 * Initialize RSA keys from environment variables or generate dev keys
 * MUST be called before any token operations
 */
async function initializeKeys(): Promise<void> {
  if (privateKey && publicKey) return; // Already initialized

  const rsaPrivateKeyPem = process.env.RSA_PRIVATE_KEY;
  const rsaPublicKeyPem = process.env.RSA_PUBLIC_KEY;

  if (rsaPrivateKeyPem && rsaPublicKeyPem) {
    // Production: Load keys from environment
    try {
      privateKey = await jose.importPKCS8(rsaPrivateKeyPem, "RS256");
      publicKey = await jose.importSPKI(rsaPublicKeyPem, "RS256");
      publicKeyJWK = await jose.exportJWK(publicKey);
      publicKeyJWK.kid = KEY_ID;
      publicKeyJWK.use = "sig";
      publicKeyJWK.alg = "RS256";
      console.log("[JWT] RS256 keys loaded from environment");
    } catch (error) {
      console.error("[JWT] Failed to load RSA keys from environment:", error);
      throw new Error("Invalid RSA keys in environment variables");
    }
  } else {
    // Development only: Generate ephemeral keys
    // WARNING: These keys change on every restart - NOT for production
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "RSA_PRIVATE_KEY and RSA_PUBLIC_KEY must be set in production"
      );
    }
    console.warn("[JWT] WARNING: Using generated dev keys - NOT FOR PRODUCTION");
    const { publicKey: pubKey, privateKey: privKey } = await jose.generateKeyPair("RS256", {
      modulusLength: 2048,
    });
    privateKey = privKey;
    publicKey = pubKey;
    publicKeyJWK = await jose.exportJWK(publicKey);
    publicKeyJWK.kid = KEY_ID;
    publicKeyJWK.use = "sig";
    publicKeyJWK.alg = "RS256";
  }
}

// Auto-initialize on module load (for Next.js)
const keysReady = initializeKeys();

export interface TokenPayload {
  profileId: string;
  displayName: string;
  handle: string;
  role: string;
  userId: string;
  clientId: string;
  accountId: string; // Required per OIDC spec v1.3
}

export async function generateIdToken(payload: TokenPayload): Promise<string> {
  await keysReady;
  if (!privateKey) throw new Error("RSA private key not initialized");

  const now = Math.floor(Date.now() / 1000);

  const token = await new jose.SignJWT({
    name: payload.displayName,
    preferred_username: payload.handle,
    account_id: payload.accountId, // Required per OIDC spec v1.3
    "https://zurot.org/profile_context": {
      profileId: payload.profileId,
      userId: payload.userId,
      role: payload.role,
    },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: KEY_ID })
    .setIssuer(ISSUER)
    .setAudience(payload.clientId)
    .setSubject(payload.profileId) // CRITICAL: sub = profileId
    .setIssuedAt(now)
    .setExpirationTime(now + 900) // 15 minutes (per OIDC spec v1.3)
    .sign(privateKey);

  return token;
}

export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  await keysReady;
  if (!privateKey) throw new Error("RSA private key not initialized");

  const now = Math.floor(Date.now() / 1000);

  const token = await new jose.SignJWT({
    scope: "openid profile",
    account_id: payload.accountId, // Required per OIDC spec v1.3
    "https://zurot.org/profile_context": {
      profileId: payload.profileId,
      role: payload.role,
    },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: KEY_ID })
    .setIssuer(ISSUER)
    .setAudience(payload.clientId)
    .setSubject(payload.profileId) // CRITICAL: sub = profileId
    .setIssuedAt(now)
    .setExpirationTime(now + 900) // 15 minutes (per OIDC spec v1.3)
    .sign(privateKey);

  return token;
}

export async function verifyToken(token: string): Promise<jose.JWTPayload | null> {
  await keysReady;
  if (!publicKey) throw new Error("RSA public key not initialized");

  try {
    const { payload } = await jose.jwtVerify(token, publicKey, {
      issuer: ISSUER,
    });
    return payload;
  } catch {
    return null;
  }
}

export function decodeToken(token: string): jose.JWTPayload | null {
  try {
    const decoded = jose.decodeJwt(token);
    return decoded;
  } catch {
    return null;
  }
}

// JWKS for public key distribution (RS256)
export async function getJWKS(): Promise<{ keys: jose.JWK[] }> {
  await keysReady;
  if (!publicKeyJWK) throw new Error("Public key JWK not initialized");

  return {
    keys: [publicKeyJWK],
  };
}

export function getOpenIDConfiguration(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    userinfo_endpoint: `${baseUrl}/api/oauth/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"], // Changed from HS256
    scopes_supported: ["openid", "profile"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    claims_supported: [
      "sub",
      "name",
      "preferred_username",
      "picture",
      "account_id",
      "https://zurot.org/profile_context",
    ],
  };
}
