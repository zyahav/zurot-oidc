#!/usr/bin/env node

import { createClerkClient } from "@clerk/backend";
import { clerkSetup, clerk as clerkTesting, setupClerkTestingToken } from "@clerk/testing/playwright";
import { chromium } from "playwright";

const BASE_URL = process.env.ZUROT_BASE_URL || "http://localhost:3000";
const OIDC_CLIENT_ID = "mall-hebrew-adventures";
const OIDC_REDIRECT_URI = `${BASE_URL}/test`;
const TEST_PIN = "1234";
const TEST_ACCOUNT_PASSWORD = "QaRun2Pass1234";
const MANAGE_GATE_SESSION_KEY = "zurot_manage_gate_unlocked";

const results = [];
const notes = [];

function record(step, name, pass, details = "") {
  results.push({ step, name, pass, details });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickPin(page, pin) {
  for (const digit of pin.split("")) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

function decodeJwtPayload(jwt) {
  const [, payload] = jwt.split(".");
  if (!payload) throw new Error("Invalid JWT format");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

async function run() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("Missing CLERK_SECRET_KEY in environment.");

  const managePassword = TEST_ACCOUNT_PASSWORD;

  // @clerk/testing bootstrap — must happen before browser launch
  await clerkSetup();

  const clerkBackend = createClerkClient({ secretKey });
  const stamp = Date.now();
  const email = `qa.run2.${stamp}@example.com`;
  const user = await clerkBackend.users.createUser({
    emailAddress: [email],
    password: TEST_ACCOUNT_PASSWORD,
    firstName: "QA", lastName: "Run2",
    skipPasswordChecks: true,
  });
  const userId = user.id;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const runtimeErrors = [];
  page.on("pageerror", error => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") runtimeErrors.push(`console.error: ${message.text()}`);
  });

  // setupClerkTestingToken MUST be called before first page.goto
  await setupClerkTestingToken({ page });

  await page.goto(`${BASE_URL}/profiles`, { waitUntil: "networkidle" });

  // clerk.signIn handles sign-in token creation internally
  await clerkTesting.signIn({ page, emailAddress: email });

  await page.waitForURL("**/profiles", { timeout: 15000 });
  await sleep(500);

  const authCheck = await page.locator("body").innerText();
  if (authCheck.includes("Sign in to select a profile.")) {
    throw new Error(`Auth not established. Runtime: ${runtimeErrors[0] || "n/a"}`);
  }

  let profileName = `QA Kid ${new Date().toISOString().slice(11, 19)}`;
  let createdRole = "student";
  let profileHintFromOidc = null;
  let disabledAppName = null;

  try {
    // Step 1 - Profile selection
    const hasGridTitle = await page.getByText("Who's Watching?", { exact: true }).count();
    const hasAddCard = await page.getByText("Add Profile", { exact: true }).count();
    record(1, "/profiles loads with profile grid", hasGridTitle > 0 && hasAddCard > 0);
    if (hasAddCard === 0) {
      const debugText = (await page.locator("body").innerText()).slice(0, 1200);
      throw new Error(`/profiles did not render Add Profile card. Body: ${debugText}`);
    }

    await page.getByRole("button", { name: /Add Profile/i }).first().click();
    await page.getByPlaceholder("e.g. Alex").fill(profileName);
    await page.getByRole("button", { name: "Student", exact: true }).click();
    await page.getByRole("button", { name: "Create Profile" }).click();
    await page.getByText("Profile created.", { exact: true }).waitFor({ timeout: 10000 });
    const createdCard = await page.locator("button", { hasText: profileName }).count();
    record(1, "Create profile appears immediately", createdCard > 0);

    await page.locator("button", { hasText: profileName }).first().click();
    await page.waitForURL("**/portal", { timeout: 10000 });
    record(1, "Select non-PIN profile redirects to /portal", page.url().includes("/portal"));

    await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: "networkidle" });
    const gateVisible = await page.getByText("Manage Profiles", { exact: true }).count();
    record(1, "Password gate appears on /profiles/manage", gateVisible > 0);

    await page.getByPlaceholder("Account password").fill("wrong-password");
    await page.getByRole("button", { name: "Unlock", exact: true }).click();
    const wrongPasswordInlineError = await page.getByText("Incorrect account password.", { exact: true }).count();
    record(1, "Wrong management password shows inline error", wrongPasswordInlineError > 0);

    if (managePassword) {
      await page.getByPlaceholder("Account password").fill(managePassword);
      await page.getByRole("button", { name: "Unlock", exact: true }).click();
      await page.getByText("Identity", { exact: true }).waitFor({ timeout: 10000 });
      record(1, "Correct password unlocks management dashboard", true);

      const selectedProfileName = await page
        .locator("section").filter({ hasText: "PIN Lock" })
        .locator("xpath=preceding::h1[1]").first().textContent();
      if (selectedProfileName && selectedProfileName.trim() !== profileName) {
        const profileLink = page.locator("a", { hasText: profileName }).first();
        if ((await profileLink.count()) > 0) {
          await profileLink.click();
          await page.waitForTimeout(500);
        }
      }

      if ((await page.getByRole("button", { name: "Set PIN", exact: true }).count()) > 0) {
        await page.getByRole("button", { name: "Set PIN", exact: true }).click();
      } else if ((await page.getByRole("button", { name: "Change PIN", exact: true }).count()) > 0) {
        await page.getByRole("button", { name: "Change PIN", exact: true }).click();
      }
      await page.getByPlaceholder("0000").fill(TEST_PIN);
      await page.getByRole("button", { name: "Save PIN", exact: true }).click();
      await page.getByText(/PIN (set|changed)\./).waitFor({ timeout: 10000 });
      record(1, "PIN can be set on profile", true);
    } else {
      record(1, "Correct password unlocks management dashboard", false, "Manage password not configured");
      record(1, "PIN can be set on profile", false, "Manage password not configured");
    }

    await page.goto(`${BASE_URL}/profiles`, { waitUntil: "networkidle" });
    await page.locator("button", { hasText: profileName }).first().click();
    await page.getByText("Enter PIN", { exact: true }).waitFor({ timeout: 8000 });
    record(1, "PIN modal appears when PIN-protected profile is selected", true);

    let shakeDetected = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      await clickPin(page, "9999");
      await page.getByText("Incorrect PIN. Try again.", { exact: true }).waitFor({ timeout: 8000 });
      const attemptsRemainingText = await page.locator("text=Attempts remaining:").textContent();
      const expected = String(5 - attempt);
      if (!attemptsRemainingText?.includes(expected)) {
        record(1, `Wrong PIN attempt ${attempt} decrements attempt counter`, false, `Expected ${expected}, got "${attemptsRemainingText}"`);
      } else {
        record(1, `Wrong PIN attempt ${attempt} decrements attempt counter`, true);
      }
      const animationName = await page.locator("text=Enter PIN").evaluate(node => {
        const root = node.closest(".fixed") ?? node.parentElement;
        return root ? (window.getComputedStyle(root).animationName || "") : "";
      });
      if (animationName && animationName !== "none") shakeDetected = true;
    }
    record(1, "Wrong PIN triggers shake animation", shakeDetected);

    await clickPin(page, "9999");
    await page.getByText("Too many failed attempts. Keypad disabled for 30 seconds.", { exact: true }).waitFor({ timeout: 10000 });
    const cooldownStartText = await page.locator("text=Try again in").first().textContent();
    record(1, "5th wrong PIN triggers 30-second cooldown", /Try again in 30 seconds\./.test(cooldownStartText || ""), cooldownStartText || "");

    await sleep(1200);
    const cooldownTickText = await page.locator("text=Try again in").first().textContent();
    record(1, "Cooldown counter starts decrementing", /Try again in 2[89] seconds\./.test(cooldownTickText || ""), cooldownTickText || "");

    await page.locator("text=Try again in").first().waitFor({ state: "hidden", timeout: 45000 });
    await clickPin(page, TEST_PIN);
    await page.waitForURL("**/portal", { timeout: 10000 });
    record(1, "Correct PIN enters /portal after cooldown", page.url().includes("/portal"));

    // Step 2 - Portal
    const headerButton = page.locator("header button").first();
    const headerText = (await headerButton.textContent()) || "";
    record(2, "Sticky header shows active profile name and emoji",
      headerText.includes(profileName) && /[\p{Extended_Pictographic}]/u.test(headerText), headerText.trim());

    await headerButton.click();
    const dropdownText = (await page.locator("header").innerText()).toLowerCase();
    record(2, "Profile switcher dropdown shows only Switch profile",
      dropdownText.includes("switch profile") && !dropdownText.includes("sign out"));

    await page.getByRole("button", { name: "Switch profile", exact: true }).click();
    await page.waitForURL("**/profiles", { timeout: 10000 });
    record(2, "Switch profile clears active profile and redirects to /profiles", page.url().includes("/profiles"));

    await page.locator("button", { hasText: profileName }).first().click();
    await page.getByText("Enter PIN", { exact: true }).waitFor({ timeout: 8000 });
    await clickPin(page, TEST_PIN);
    await page.waitForURL("**/portal", { timeout: 10000 });

    await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: "networkidle" });
    if ((await page.getByPlaceholder("Account password").count()) > 0 && managePassword) {
      await page.getByPlaceholder("Account password").fill(managePassword);
      await page.getByRole("button", { name: "Unlock", exact: true }).click();
      await page.getByText("Identity", { exact: true }).waitFor({ timeout: 10000 });
    }
    const toggleRow = page.locator("section", { hasText: "App Access" }).locator("div", { hasText: "Letters Lab" }).first();
    const rowText = (await toggleRow.innerText()).trim();
    const toggle = toggleRow.getByRole("button").first();
    const wasOn = ((await toggle.textContent()) || "").trim() === "ON";
    if (wasOn) {
      await toggle.click();
      await page.getByText("App disabled for this profile.", { exact: true }).waitFor({ timeout: 10000 });
      disabledAppName = "Letters Lab";
    } else {
      disabledAppName = "Letters Lab";
    }

    await page.goto(`${BASE_URL}/portal`, { waitUntil: "networkidle" });
    const disabledVisible = await page.getByText(disabledAppName, { exact: true }).count();
    record(2, "Disabled app is removed from portal app grid", disabledVisible === 0, `Checked: ${disabledAppName}; row: ${rowText}`);

    // Step 3 - Launch and OIDC
    const launchUrl = `${BASE_URL}/launch/${OIDC_CLIENT_ID}?client_id=${encodeURIComponent(OIDC_CLIENT_ID)}&redirect_uri=${encodeURIComponent(OIDC_REDIRECT_URI)}`;

    let promptNoneSeen = false;
    page.on("framenavigated", frame => {
      const u = frame.url();
      if (u.includes("/oauth/authorize") && u.includes("prompt=none")) promptNoneSeen = true;
      if (u.includes("/oauth/authorize") && u.includes("profile_hint=")) {
        try { profileHintFromOidc = new URL(u).searchParams.get("profile_hint"); } catch {}
      }
    });

    await page.goto(launchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/test?**", { timeout: 30000 });
    const authCode = new URL(page.url()).searchParams.get("code");

    record(3, "Silent auth uses prompt=none automatically", promptNoneSeen);
    record(3, "Launch flow redirects with authorization code", Boolean(authCode), page.url());

    if (!authCode) throw new Error("No authorization code returned from launch flow.");

    const tokenResponse = await fetch(`${BASE_URL}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", code: authCode, client_id: OIDC_CLIENT_ID, redirect_uri: OIDC_REDIRECT_URI }),
    });
    const tokenJson = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokenJson)}`);

    const claims = decodeJwtPayload(tokenJson.id_token);
    const expectedSub = profileHintFromOidc ? `profile_${profileHintFromOidc}` : null;
    const contextClaim = claims["https://zurot.org/profile_context"] || {};

    record(3, "id_token.sub = profile_<convexId>", expectedSub ? claims.sub === expectedSub : false, String(claims.sub));
    record(3, "id_token.preferred_username = profile_<convexId>", expectedSub ? claims.preferred_username === expectedSub : false, String(claims.preferred_username));
    record(3, "id_token.name = profile display name", claims.name === profileName, String(claims.name));
    record(3, "id_token profile_context has correct profileId, userId, role",
      Boolean(profileHintFromOidc && contextClaim.profileId === profileHintFromOidc && contextClaim.userId === userId && contextClaim.role === createdRole),
      JSON.stringify(contextClaim));

    // Step 4 - Management dashboard
    await page.goto(`${BASE_URL}/profiles`, { waitUntil: "networkidle" });
    await page.evaluate(key => sessionStorage.removeItem(key), MANAGE_GATE_SESSION_KEY);
    await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: "networkidle" });
    record(4, "Management password gate appears",
      (await page.getByText("This gate protects profile settings, PIN controls, and deletion actions.").count()) > 0);

    await page.getByPlaceholder("Account password").fill("wrong-password");
    await page.getByRole("button", { name: "Unlock", exact: true }).click();
    record(4, "Wrong password shows inline error and does not lock",
      (await page.getByText("Incorrect account password.", { exact: true }).count()) > 0);

    if (!managePassword) {
      record(4, "Correct password unlocks dashboard (sidebar + right panel)", false, "Manage password not configured");
      record(4, "Edit profile name + role saves inline", false, "Skipped");
      record(4, "Set and remove PIN inline without browser dialogs", false, "Skipped");
      record(4, "Delete non-last profile updates sidebar and right panel", false, "Skipped");
      record(4, "Last profile delete is disabled with explanation", false, "Skipped");
    } else {
      await page.getByPlaceholder("Account password").fill(managePassword);
      await page.getByRole("button", { name: "Unlock", exact: true }).click();
      await page.getByText("Identity", { exact: true }).waitFor({ timeout: 10000 });
      record(4, "Correct password unlocks dashboard (sidebar + right panel)",
        (await page.locator("aside").count()) > 0 && (await page.locator("section", { hasText: "Identity" }).count()) > 0);

      const updatedName = `${profileName} Renamed`;
      await page.locator('label:has-text("Name") + input').fill(updatedName);
      await page.getByRole("button", { name: "Teacher", exact: true }).click();
      await page.getByRole("button", { name: "Save Changes", exact: true }).click();
      await page.getByText("Profile updated.", { exact: true }).waitFor({ timeout: 10000 });
      profileName = updatedName;
      createdRole = "teacher";
      record(4, "Edit profile name + role saves inline", true);

      if ((await page.getByRole("button", { name: "Remove", exact: true }).count()) > 0) {
        await page.getByRole("button", { name: "Remove", exact: true }).click();
        await page.getByText("PIN removed.", { exact: true }).waitFor({ timeout: 10000 });
      }
      await page.getByRole("button", { name: "Set PIN", exact: true }).click();
      await page.getByPlaceholder("0000").fill("2468");
      await page.getByRole("button", { name: "Save PIN", exact: true }).click();
      await page.getByText("PIN set.", { exact: true }).waitFor({ timeout: 10000 });
      await page.getByRole("button", { name: "Remove", exact: true }).click();
      await page.getByText("PIN removed.", { exact: true }).waitFor({ timeout: 10000 });
      record(4, "Set and remove PIN inline without browser dialogs", true);

      await page.getByRole("button", { name: "+ Add new profile", exact: true }).click();
      await page.getByPlaceholder("e.g. Alex").fill(`Delete Me ${Date.now().toString().slice(-4)}`);
      await page.getByRole("button", { name: "Create Profile", exact: true }).click();
      await page.getByText("Profile created!", { exact: true }).waitFor({ timeout: 10000 });

      await page.getByRole("button", { name: "Delete Profile", exact: true }).click();
      await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
      await page.getByText("Profile deleted.", { exact: true }).waitFor({ timeout: 10000 });
      record(4, "Delete non-last profile updates sidebar and right panel", true);

      const sidebarProfiles = await page.locator("aside a[href^='/profiles/manage/']").count();
      const deleteDisabled = await page.getByRole("button", { name: "Delete Profile", exact: true }).isDisabled();
      const disableMessage = await page.getByText("Delete disabled: you cannot delete the only remaining profile.", { exact: true }).count();
      record(4, "Last profile delete is disabled with explanation", sidebarProfiles === 1 && deleteDisabled && disableMessage > 0);
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    await clerkBackend.users.deleteUser(userId).catch(() => {});
  }

  const passed = results.filter(r => r.pass);
  const failed = results.filter(r => !r.pass);

  console.log("Run 2 QA Results");
  console.log(`- passed: ${passed.length}`);
  console.log(`- failed: ${failed.length}`);
  if (notes.length > 0) {
    console.log("- notes:");
    for (const note of notes) console.log(`  - ${note}`);
  }
  for (const result of results) {
    const marker = result.pass ? "PASS" : "FAIL";
    const suffix = result.details ? ` :: ${result.details}` : "";
    console.log(`[${marker}] Step ${result.step} - ${result.name}${suffix}`);
  }
  if (failed.length > 0) process.exitCode = 2;
}

run().catch(error => {
  if (notes.length > 0) {
    console.error("run2-e2e notes:");
    for (const note of notes) console.error(`  - ${note}`);
  }
  console.error("run2-e2e failed:", error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
