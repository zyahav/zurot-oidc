#!/usr/bin/env node

import { createClerkClient } from "@clerk/backend";

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!secretKey) {
    throw new Error("Missing CLERK_SECRET_KEY in environment.");
  }
  if (!publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in environment.");
  }

  const clerk = createClerkClient({ secretKey });
  let instance = null;
  const instanceApi = clerk.instances ?? clerk.instance;
  const getInstanceFn = instanceApi?.get ?? instanceApi?.getInstance;
  if (typeof getInstanceFn === "function") {
    try {
      instance = await getInstanceFn.call(instanceApi);
    } catch {
      instance = null;
    }
  }

  if (!instance || (!instance.publishableKey && !instance.publishable_key)) {
    const response = await fetch("https://api.clerk.com/v1/instance", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Clerk instance API failed with ${response.status}`);
    }
    const rawInstance = await response.json();
    instance = { ...rawInstance, ...instance };
  }

  const decodedPublishable = (() => {
    const encoded = publishableKey.replace(/^pk_(test|live)_/, "");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    try {
      return Buffer.from(padded, "base64").toString("utf8");
    } catch {
      return null;
    }
  })();

  console.log("Clerk instance check");
  console.log(`- instance id: ${instance.id || instance.object || "(unknown)"}`);
  console.log(`- accounts domain: ${instance.accountsBaseUrl || instance.accounts_base_url || "(unknown)"}`);
  console.log(`- dashboard domain: ${instance.homeUrl || instance.home_url || "(unknown)"}`);
  console.log(`- env publishable key: ${publishableKey}`);
  if (decodedPublishable) {
    console.log(`- decoded env publishable payload: ${decodedPublishable}`);
  }
  const apiPublishable = instance.publishableKey || instance.publishable_key;
  if (apiPublishable) {
    console.log(`- api publishable key: ${apiPublishable}`);
    console.log(`- publishable key match: ${apiPublishable === publishableKey ? "YES" : "NO"}`);
  } else {
    console.log("- api publishable key: (not returned by Clerk API)");
    console.log(`- instance fields: ${Object.keys(instance).sort().join(", ")}`);
  }

  // Decode a real session token to inspect issuer expectations from the secret key.
  const email = `clerk.check.${Date.now()}@example.com`;
  const user = await clerk.users.createUser({
    emailAddress: [email],
    password: "ClerkCheckPass1234",
    firstName: "Clerk",
    lastName: "Check",
    skipPasswordChecks: true,
  });
  const session = await clerk.sessions.createSession({ userId: user.id });
  const token = await clerk.sessions.getToken(session.id);
  const payloadB64 = token.jwt.split(".")[1];
  const payloadJson = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const payload = JSON.parse(payloadJson);
  console.log(`- decoded session issuer (iss): ${payload.iss || "(missing)"}`);
  console.log(`- decoded session azp: ${payload.azp || "(missing)"}`);
}

main().catch(error => {
  console.error("clerk-check failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
