#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const clientSecret = process.env.OIDC_CLIENT_SECRET;

if (!clientSecret) {
  console.error("OIDC_CLIENT_SECRET must be supplied through the process environment.");
  process.exit(1);
}

const client = {
  clientId: "gmail-ops",
  clientSecret,
  tokenEndpointAuthMethod: "client_secret_post",
  redirectUris: [
    "https://gmail-ops.zurot.org/auth/callback",
    "http://127.0.0.1:8787/auth/callback",
  ],
};

execFileSync(
  "npx",
  ["convex", "run", "oauth:registerClient", JSON.stringify(client)],
  { stdio: "inherit" },
);

console.log("Registered OAuth client: gmail-ops");
