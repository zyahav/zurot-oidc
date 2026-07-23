#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const clientSecret = process.env.OIDC_CLIENT_SECRET;
const useProduction = process.argv.slice(2).includes("--prod");

if (!clientSecret) {
  console.error("OIDC_CLIENT_SECRET must be supplied through the process environment.");
  process.exit(1);
}

if (process.argv.slice(2).some(argument => argument !== "--prod")) {
  console.error("Only the optional --prod argument is supported.");
  process.exit(1);
}

const client = {
  clientId: "meetings",
  clientSecret,
  tokenEndpointAuthMethod: "client_secret_post",
  redirectUris: [
    "https://meeting.zurot.org/api/auth/callback",
    "http://localhost:3000/api/auth/callback",
  ],
};

execFileSync(
  "npx",
  [
    "convex",
    "run",
    ...(useProduction ? ["--prod"] : []),
    "oauth:registerClient",
    JSON.stringify(client),
  ],
  { stdio: "inherit" },
);

console.log(`Registered OAuth client: meetings (${useProduction ? "production" : "development"})`);
