import * as jose from "jose";

// For development/testing, using a symmetric key
// In production, use RSA key pair stored securely
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "zurot-dev-secret-key-change-in-production"
);

const ISSUER = process.env.NEXT_PUBLIC_APP_URL || "https://zurot.org";

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
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(payload.clientId)
    .setSubject(payload.profileId) // CRITICAL: sub = profileId
    .setIssuedAt(now)
    .setExpirationTime(now + 900) // 15 minutes (per OIDC spec v1.3)
    .sign(JWT_SECRET);

  return token;
}

export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const token = await new jose.SignJWT({
    scope: "openid profile",
    account_id: payload.accountId, // Required per OIDC spec v1.3
    "https://zurot.org/profile_context": {
      profileId: payload.profileId,
      role: payload.role,
    },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(payload.clientId)
    .setSubject(payload.profileId) // CRITICAL: sub = profileId
    .setIssuedAt(now)
    .setExpirationTime(now + 900) // 15 minutes (per OIDC spec v1.3)
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(token: string): Promise<jose.JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
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

// JWKS for public key distribution (symmetric key version)
export function getJWKS() {
  return {
    keys: [
      {
        kty: "oct",
        use: "sig",
        alg: "HS256",
        kid: "zurot-key-1",
        // Note: In production with RS256, this would be the public key
        // For HS256, JWKS typically isn't used for verification
        // This is a placeholder for the OIDC discovery endpoint
      },
    ],
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
    id_token_signing_alg_values_supported: ["HS256"],
    scopes_supported: ["openid", "profile"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    claims_supported: [
      "sub",
      "name",
      "preferred_username",
      "picture",
      "https://zurot.org/profile_context",
    ],
  };
}
