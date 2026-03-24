#!/usr/bin/env node

import { spawn } from "node:child_process";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const startServer = process.env.SMOKE_START_SERVER !== "false";
const readyTimeoutMs = 90000;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function getJson(url, init) {
  const response = await fetch(url, init);
  let json = null;
  try {
    json = await response.json();
  } catch {
    // Keep null for non-JSON responses.
  }
  return { response, json };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  try {
    const response = await fetch(`${baseUrl}/.well-known/openid-configuration`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < readyTimeoutMs) {
    if (await isServerReady()) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

function startDevServer() {
  const child = spawn("npm", ["run", "dev"], {
    stdio: "pipe",
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

let spawnedDevServer = null;

async function run() {
  console.log(`Running OIDC smoke checks against ${baseUrl}`);

  if (!(await isServerReady())) {
    if (!startServer) {
      fail(`server not reachable at ${baseUrl} and SMOKE_START_SERVER=false`);
    }
    console.log("No server detected, starting local Next.js dev server...");
    spawnedDevServer = startDevServer();
    const ready = await waitForServer();
    if (!ready) {
      if (spawnedDevServer && !spawnedDevServer.killed) {
        spawnedDevServer.kill("SIGINT");
      }
      fail(`server did not become ready within ${readyTimeoutMs / 1000}s`);
    }
    console.log("Local server is ready.");
  }

  const discovery = await getJson(
    `${baseUrl}/.well-known/openid-configuration`
  );
  if (!discovery.response.ok || !discovery.json) {
    fail("openid-configuration endpoint did not return valid JSON/200");
  }
  const requiredDiscoveryKeys = [
    "issuer",
    "authorization_endpoint",
    "token_endpoint",
    "userinfo_endpoint",
    "jwks_uri",
  ];
  for (const key of requiredDiscoveryKeys) {
    if (!(key in discovery.json)) {
      fail(`openid-configuration missing key: ${key}`);
    }
  }
  pass("GET /.well-known/openid-configuration");

  const jwks = await getJson(`${baseUrl}/.well-known/jwks.json`);
  if (!jwks.response.ok || !jwks.json || !Array.isArray(jwks.json.keys)) {
    fail("jwks endpoint did not return valid keys array");
  }
  if (jwks.json.keys.length === 0) {
    fail("jwks endpoint returned empty keys array");
  }
  pass("GET /.well-known/jwks.json");

  const tokenInvalid = await getJson(`${baseUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "authorization_code" }),
  });
  if (tokenInvalid.response.status !== 400 || !tokenInvalid.json) {
    fail("token endpoint invalid request did not return 400 JSON");
  }
  if (tokenInvalid.json.error !== "invalid_request") {
    fail(
      `token endpoint invalid request error mismatch: ${tokenInvalid.json.error}`
    );
  }
  pass("POST /api/oauth/token invalid request");

  const userinfoUnauthorized = await getJson(`${baseUrl}/api/oauth/userinfo`);
  if (userinfoUnauthorized.response.status !== 401 || !userinfoUnauthorized.json) {
    fail("userinfo unauthorized did not return 401 JSON");
  }
  if (userinfoUnauthorized.json.error !== "invalid_token") {
    fail(
      `userinfo unauthorized error mismatch: ${userinfoUnauthorized.json.error}`
    );
  }
  pass("GET /api/oauth/userinfo unauthorized");

  console.log("OIDC smoke checks completed successfully.");

  if (spawnedDevServer && !spawnedDevServer.killed) {
    spawnedDevServer.kill("SIGINT");
    spawnedDevServer = null;
  }
}

run().catch((error) => {
  if (spawnedDevServer && !spawnedDevServer.killed) {
    spawnedDevServer.kill("SIGINT");
  }
  fail(error instanceof Error ? error.message : String(error));
});
