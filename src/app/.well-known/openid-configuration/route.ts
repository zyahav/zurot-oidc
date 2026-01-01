import { NextResponse } from "next/server";

export async function GET() {
  // Issuer Rules (Strict):
  // 1. Prefer process.env.ISSUER
  // 2. Fallback to localhost in dev
  const issuer = process.env.ISSUER || 
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://auth.zurot.org");

  // Exact response body (DISCOVERY ONLY)
  return NextResponse.json({
    issuer: issuer,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  });
}
