#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const clients = [
  {
    clientId: "mall-hebrew-adventures",
    redirectUris: [
      "https://mall-hebrew-adventures.pages.dev/auth/callback",
      "https://preview-zurot-auth.mall-hebrew-adventures.pages.dev/auth/callback",
      "http://localhost:8080/auth/callback",
      "http://localhost:3000/test",
    ],
  },
];

function runConvexRegisterClient(client) {
  const argsJson = JSON.stringify(client);
  execFileSync("npx", ["convex", "run", "oauth:registerClient", argsJson], {
    stdio: "inherit",
  });
}

async function main() {
  console.log("Seeding OAuth clients...");
  for (const client of clients) {
    console.log(`Registering/upserting client: ${client.clientId}`);
    runConvexRegisterClient(client);
  }
  console.log("Client seed completed.");
}

main().catch((error) => {
  console.error("Client seed failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
