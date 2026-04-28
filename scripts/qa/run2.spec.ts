import { test, expect } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import {
  goToProfiles,
  unlockManageGate,
  expectManageGateLocked,
  switchProfileToProfiles,
} from './test-utils';

const OIDC_CLIENT_ID = 'mall-hebrew-adventures';
const TEST_PIN = '1234';
const TEST_ACCOUNT_PASSWORD = 'QaRun2Pass1234';

const BASE_URL = process.env.ZUROT_BASE_URL || 'http://localhost:3000';
const OIDC_REDIRECT_URI = `${BASE_URL}/test`;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickPin(page: import("@playwright/test").Page, pin: string) {
  for (const digit of pin.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

async function ensureManageUnlocked(page: import("@playwright/test").Page) {
  const setupLocator = page.getByText('Set up your owner PIN');
  const pinEntryLocator = page.getByText('Enter your 4-digit owner PIN');
  const unlockedLocator = page.getByRole('button', { name: '+ Add new profile', exact: true });

  for (let attempt = 0; attempt < 30; attempt++) {
    if (await unlockedLocator.isVisible().catch(() => false)) {
      // Route remounts can briefly show unlocked UI before gate reappears.
      // Require a short stable unlocked window before returning.
      await page.waitForTimeout(350);
      const setupVisible = await setupLocator.isVisible().catch(() => false);
      const pinEntryVisible = await pinEntryLocator.isVisible().catch(() => false);
      if (!setupVisible && !pinEntryVisible && (await unlockedLocator.isVisible().catch(() => false))) {
        return;
      }
    }

    if (await setupLocator.isVisible().catch(() => false)) {
      const inputs = page.locator('input[inputmode="numeric"]');
      await inputs.first().fill(TEST_PIN);
      await inputs.nth(1).fill(TEST_PIN);
      await page.getByRole('button', { name: 'Save PIN', exact: true }).click();
      await unlockedLocator.waitFor({ timeout: 15000 });
      return;
    }

    if (await pinEntryLocator.isVisible().catch(() => false)) {
      const clear = page.getByRole('button', { name: 'Clear', exact: true });
      if (await clear.isVisible().catch(() => false)) {
        await clear.click().catch(() => {});
      }
      for (const digit of TEST_PIN) {
        await page.getByRole('button', { name: digit, exact: true }).click();
        await page.waitForTimeout(100);
      }
      await unlockedLocator.waitFor({ timeout: 15000 });
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error('Failed to unlock manage gate in place');
}

async function gotoManageWithRetry(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
  }
}

// Navigate to portal via profile card. Retries if guard redirects back.
async function enterPortalViaProfileCard(page: import("@playwright/test").Page, name: string) {
  const card = page.locator('button', { hasText: name }).first();
  await expect(card).toBeVisible({ timeout: 10000 });

  for (let attempt = 0; attempt < 5; attempt++) {
    await card.click();
    try {
      await page.waitForURL('**/portal', { timeout: 10000 });
    } catch {
      // stay in loop
    }

    if (page.url().includes('/portal')) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      try {
        await page.waitForSelector('header', { timeout: 8000 });
        return;
      } catch {
        // If a guard bounce happened, retry.
        if (!page.url().includes('/portal')) {
          continue;
        }
      }
    }

    // If PIN modal appears unexpectedly, this profile is not eligible for no-PIN entry
    if ((await page.getByText('Enter PIN', { exact: true }).count()) > 0) {
      throw new Error(`Expected non-PIN profile flow for "${name}", but PIN modal appeared`);
    }

    await page.waitForTimeout(1200);
  }

  throw new Error(`Expected /portal but landed at ${page.url()}`);
}

async function ensurePortalHeaderVisible(page: import("@playwright/test").Page, name: string) {
  const headerButton = page.locator('header button').first();
  for (let attempt = 0; attempt < 8; attempt++) {
    if (await headerButton.isVisible().catch(() => false)) {
      return;
    }
    try {
      await enterPortalViaProfileCard(page, name);
    } catch {
      await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(800);
      continue;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`Portal header button not visible after retries. Final URL: ${page.url()}`);
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const [, payload] = jwt.split('.');
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

// Shared state across tests in this file
let testEmail: string;
let testUserId: string;
let clerkBackend: ReturnType<typeof createClerkClient>;

// Each test gets a unique profile name to prevent PIN contamination across tests
let testCounter = 0;
function uniqueProfileName() {
  testCounter++;
  return `QA Kid ${testCounter}-${Date.now().toString().slice(-4)}`;
}

test.beforeAll(async () => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('Missing CLERK_SECRET_KEY');
  clerkBackend = createClerkClient({ secretKey });
  const stamp = Date.now();
  // Use Clerk test email format: OTP always succeeds with code 424242
  testEmail = `qa.run2.${stamp}+clerk_test@example.com`;
  const user = await clerkBackend.users.createUser({
    emailAddress: [testEmail],
    password: TEST_ACCOUNT_PASSWORD,
    firstName: 'QA', lastName: 'Run2',
    skipPasswordChecks: true,
  });
  testUserId = user.id;
});

test.afterAll(async () => {
  if (testUserId && clerkBackend) {
    await clerkBackend.users.deleteUser(testUserId).catch(() => {});
  }
});

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto(`${BASE_URL}/profiles`);
  await clerk.signIn({ page, emailAddress: testEmail });
  await goToProfiles(page);
  // Wait for Convex to receive and process the new session JWT.
  // We verify by waiting for the profile grid (or Add Profile card) to appear,
  // which means getProfiles() has executed successfully with the new session token.
  await page.waitForSelector("text=Who's Watching?", { timeout: 15000 });
  await page.waitForSelector('text=Add Profile', { timeout: 10000 });
  // Extra settle time for Convex subscriptions to stabilize
  await sleep(1500);
});

// ─── Step 1: Profile Selection ───────────────────────────────────────────────

test('Step 1 - Root homepage shows email-first entry', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Safe profiles and app access for every child in your home.' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel('Email address')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByLabel('Email address').fill('qa.root@example.com');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/profiles\?email=qa\.root%40example\.com/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: "Who's Watching?" })).toBeVisible({ timeout: 10000 });
});

test('Step 1 - Create profile appears immediately', async ({ page }) => {
  const profileName = uniqueProfileName();
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  // Toast OR card appearing both confirm success — toast is brief (2.6s auto-dismiss)
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });
});

test('Step 1 - Select non-PIN profile redirects to /portal', async ({ page }) => {
  const profileName = uniqueProfileName();
  // Create profile first
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });

  await enterPortalViaProfileCard(page, profileName);
  expect(page.url()).toContain('/portal');

  // Root stays a public landing page even with an active profile.
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Safe profiles and app access for every child in your home.' })).toBeVisible({ timeout: 10000 });
});

test('Step 1 - PIN gate appears on /profiles/manage', async ({ page }) => {
  await gotoManageWithRetry(page);
  // Test user has no PIN set yet, so setup screen appears
  await expect(page.getByRole('button', { name: 'Save PIN', exact: true })).toBeVisible({ timeout: 10000 });
});

test('Step 1 - PIN gate Cancel returns to /profiles', async ({ page }) => {
  await gotoManageWithRetry(page);
  // Test user has no PIN set yet, so setup screen appears
  await expect(page.getByRole('button', { name: 'Save PIN', exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/profiles/, { timeout: 5000 });
});

test('Step 1 - PIN flow: set, modal, wrong attempts, cooldown, correct', async ({ page }) => {
  const profileName = uniqueProfileName();
  test.setTimeout(150000); // PIN cooldown is 30s + setup time

  // Create profile
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });

  // Set PIN via manage
  await unlockManageGate(page);

  // Navigate to the newly created profile — manage shows profiles[0] by default
  const profileLink = page.locator('aside a', { hasText: profileName }).first();
  await expect(profileLink).toBeVisible({ timeout: 10000 });
  await profileLink.click();
  await ensureManageUnlocked(page);
  await expect(page.getByText('PIN Lock', { exact: true })).toBeVisible({ timeout: 10000 });

  // Clear any existing PIN first to guarantee a clean Set PIN flow
  if ((await page.getByRole('button', { name: 'Remove', exact: true }).count()) > 0) {
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    // Wait for Remove to complete — Set PIN button re-appears
    await expect(page.getByRole('button', { name: 'Set PIN', exact: true })).toBeVisible({ timeout: 8000 });
  }

  let pinSaved = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    await ensureManageUnlocked(page);
    await page.getByRole('button', { name: 'Set PIN', exact: true }).click();
    const savePinButton = page.getByRole('button', { name: 'Save PIN', exact: true });
    await expect(savePinButton).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('0000').fill(TEST_PIN);
    try {
      await savePinButton.click({ timeout: 5000 });
      pinSaved = true;
      break;
    } catch {
      await page.waitForTimeout(600);
    }
  }
  expect(pinSaved).toBe(true);
  // Wait for PIN input to disappear (mode returns to idle) — more reliable than brief toast
  await expect(page.getByPlaceholder('0000')).toBeHidden({ timeout: 10000 });
  await ensureManageUnlocked(page);
  // Confirm PIN is now set — Remove button only appears when hasPin is true.
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeVisible({ timeout: 10000 });

  // Select PIN-protected profile — modal should appear
  await page.goto(`${BASE_URL}/profiles`);
  let pinModalVisible = false;
  const lockedProfileCard = page.locator('button', { hasText: profileName }).first();
  await expect(lockedProfileCard).toBeVisible({ timeout: 15000 });

  for (let attempt = 0; attempt < 8; attempt++) {
    const profileCard = page.locator('button', { hasText: profileName }).first();
    await expect(profileCard).toBeVisible({ timeout: 10000 });
    try {
      await profileCard.click({ force: true, timeout: 5000 });
    } catch {
      await profileCard.evaluate((el) => (el as HTMLButtonElement).click());
    }
    await page.waitForTimeout(300);
    try {
      await page.getByText('Enter PIN', { exact: true }).waitFor({ state: 'visible', timeout: 6000 });
      pinModalVisible = true;
      break;
    } catch {
      if (page.url().includes('/portal')) {
        await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'networkidle' });
      }
      await page.waitForTimeout(1200);
    }
  }
  expect(pinModalVisible).toBe(true);
  await expect(page.getByText('Enter PIN', { exact: true })).toBeVisible({ timeout: 8000 });

  // 4 wrong attempts
  for (let attempt = 1; attempt <= 4; attempt++) {
    await clickPin(page, '9999');
    await expect(page.getByText('Incorrect PIN. Try again.', { exact: true })).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Attempts remaining:')).toContainText(String(5 - attempt));
  }

  // 5th wrong — cooldown
  await clickPin(page, '9999');
  await expect(page.getByText('Too many failed attempts. Keypad disabled for 30 seconds.', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Try again in').first()).toContainText('Try again in 30 seconds.');

  await sleep(1200);
  await expect(page.locator('text=Try again in').first()).toContainText(/Try again in 2[89] seconds\./);

  // Wait for cooldown then correct PIN
  await expect(page.locator('text=Try again in').first()).toBeHidden({ timeout: 45000 });
  await clickPin(page, TEST_PIN);
  // After correct PIN, the app calls setActiveProfile then window.location.assign('/portal').
  // The Clerk token may have refreshed during the 30s cooldown window.
  // Give Convex extra time to sync the new session token before portal guard checks.
  await page.waitForTimeout(6000);
  if (!page.url().includes('/portal')) {
    // Close PIN modal if still open (overlay blocks profile card click)
    const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true });
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click();
      await page.waitForTimeout(500);
    }
    // Retry via profile card (PIN-protected flow)
    await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: profileName }).first().click();
    if ((await page.getByText('Enter PIN', { exact: true }).count()) > 0) {
      await clickPin(page, TEST_PIN);
    }
    await page.waitForURL('**/portal', { timeout: 15000 });
  }
  expect(page.url()).toContain('/portal');
});

// ─── Step 2: Portal ───────────────────────────────────────────────────────────

test('Step 2 - Sticky header shows active profile name and emoji', async ({ page }) => {
  const profileName = uniqueProfileName();
  // Create and enter profile
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });
  await ensurePortalHeaderVisible(page, profileName);

  const headerButton = page.locator('header button').first();
  const headerText = (await headerButton.textContent()) || '';
  expect(headerText).toContain(profileName);
  expect(/[\p{Extended_Pictographic}]/u.test(headerText)).toBe(true);
});

test('Step 2 - Profile switcher dropdown shows only Switch profile', async ({ page }) => {
  const profileName = uniqueProfileName();
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });
  await ensurePortalHeaderVisible(page, profileName);

  await page.locator('header button').first().click();
  const dropdownText = (await page.locator('header').innerText()).toLowerCase();
  expect(dropdownText).toContain('switch profile');
  expect(dropdownText).not.toContain('sign out');
});

test('Step 2 - Switch profile returns to /profiles', async ({ page }) => {
  const profileName = uniqueProfileName();
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });
  await ensurePortalHeaderVisible(page, profileName);

  await page.locator('header button').first().click();
  await switchProfileToProfiles(page);

  // T-010 check: sign-out should hard-redirect, and modal must not persist after sign-in.
  await page.getByRole('button', { name: 'Sign out of account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign out of account?' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/profiles', { timeout: 10000 });
  await expect(page.getByText('Sign in to select a profile.', { exact: true })).toBeVisible({ timeout: 10000 });

  // Root stays a public landing page when signed out.
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Safe profiles and app access for every child in your home.' })).toBeVisible({ timeout: 10000 });

  // Sign back in and ensure sign-out modal does not persist.
  await clerk.signIn({ page, emailAddress: testEmail });
  await goToProfiles(page);
  await expect(page.getByRole('heading', { name: "Who's Watching?" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Sign out of account?' })).toHaveCount(0);
});

test('Step 2 - Disabled app removed from portal app grid', async ({ page }) => {
  const profileName = uniqueProfileName();

  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });
  await ensurePortalHeaderVisible(page, profileName);

  await unlockManageGate(page);

  const toggleRow = page.locator('section', { hasText: 'App Access' }).locator('div', { hasText: 'Mall Hebrew Adventures' }).first();
  const toggle = toggleRow.getByRole('button').first();
  if (((await toggle.textContent()) || '').trim() === 'ON') {
    await toggle.click();
    await expect(page.getByText('App disabled for this profile.', { exact: true })).toBeVisible({ timeout: 10000 });
  }

  await page.goto(`${BASE_URL}/portal`);
  await expect(page.locator('a[href="/portal/app/mall-hebrew-adventures"]')).toHaveCount(0);
});

// ─── Step 3: Launch + OIDC ────────────────────────────────────────────────────

test('Step 3 - Silent auth and token claims', async ({ page }) => {
  const profileName = uniqueProfileName();

  // Create profile and enter portal (this sets the active profile in Convex for this session)
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });

  // Resolve a deterministic profile_hint from the manage sidebar.
  // This avoids relying solely on active-profile session state in prompt=none flows.
  let profileHint: string | null = null;
  await unlockManageGate(page);
  const profileLink = page.locator('aside a', { hasText: profileName }).first();
  if ((await profileLink.count()) > 0) {
    const href = await profileLink.getAttribute('href');
    profileHint = href?.split('/').pop() ?? null;
  }

  // Also set active profile by entering portal in this session.
  await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'networkidle' });
  await enterPortalViaProfileCard(page, profileName);

  const state = 'qa-test-' + Date.now();
  const authorizeUrl = new URL(`${BASE_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', OIDC_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', OIDC_REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', 'openid profile');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('prompt', 'none');
  if (profileHint) {
    authorizeUrl.searchParams.set('profile_hint', profileHint);
  }

  let authCode: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(authorizeUrl.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/test*', { timeout: 30000 });

    const url = new URL(page.url());
    authCode = url.searchParams.get('code');
    const errorCode = url.searchParams.get('error');
    if (authCode) break;

    // If active profile was lost, re-establish it and retry once.
    if (errorCode === 'interaction_required' && attempt === 0) {
      await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'networkidle' });
      await enterPortalViaProfileCard(page, profileName);
      continue;
    }
    break;
  }

  expect(authCode).toBeTruthy();

  const tokenRes = await fetch(`${BASE_URL}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: authCode,
      client_id: OIDC_CLIENT_ID,
      redirect_uri: OIDC_REDIRECT_URI,
    }),
  });
  const tokenJson = await tokenRes.json();
  expect(tokenRes.ok, `Token exchange failed: ${JSON.stringify(tokenJson)}`).toBe(true);

  const claims = decodeJwtPayload(tokenJson.id_token);

  // Verify token structure — sub and preferred_username must be profile_<id>
  expect(claims.sub).toMatch(/^profile_/);
  expect(claims.preferred_username).toMatch(/^profile_/);
  expect(claims.sub).toBe(claims.preferred_username);
  expect(claims.name).toBe(profileName);

  const ctx = claims['https://zurot.org/profile_context'] || {};
  expect(ctx.role).toBe('student');
  expect(ctx.userId).toBe(testUserId);
});

// ─── Step 4: Management Dashboard ────────────────────────────────────────────

test('Step 4 - PIN gate appears on /profiles/manage', async ({ page }) => {
  await expectManageGateLocked(page);
});

test('Step 4 - PIN gate correct PIN unlocks dashboard', async ({ page }) => {
  await unlockManageGate(page);
  await expect(page.getByText('Manage Profiles', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: '+ Add new profile', exact: true })).toBeVisible();
});

test('Step 4 - Full management dashboard flow', async ({ page }) => {
  const profileName = uniqueProfileName();

  // Create profile to work with
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });

  await unlockManageGate(page);

  // Sidebar and right panel exist
  expect(await page.locator('aside').count()).toBeGreaterThan(0);
  expect(await page.locator('section', { hasText: 'Identity' }).count()).toBeGreaterThan(0);

  // Edit name + role inline
  const updatedName = `${profileName} Renamed`;
  await page.locator('label:has-text("Name") + input').fill(updatedName);
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible({ timeout: 10000 });

  // PIN set and remove inline — no browser dialogs
  if ((await page.getByRole('button', { name: 'Remove', exact: true }).count()) > 0) {
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByText('PIN removed.', { exact: true })).toBeVisible({ timeout: 10000 });
  }
  await page.getByRole('button', { name: 'Set PIN', exact: true }).click();
  await page.getByPlaceholder('0000').fill('2468');
  await page.getByRole('button', { name: 'Save PIN', exact: true }).click();
  await expect(page.getByText('PIN set.', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('PIN removed.', { exact: true })).toBeVisible({ timeout: 10000 });

  // Add a second profile then delete it — sidebar updates
  await page.getByRole('button', { name: '+ Add new profile', exact: true }).click();
  const deleteName = `Delete Me ${Date.now().toString().slice(-4)}`;
  await page.getByPlaceholder('e.g. Alex').fill(deleteName);
  await page.getByRole('button', { name: 'Create Profile', exact: true }).click();
  await expect(page.locator('aside a', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });
  await expect
    .poll(async () => page.locator('aside a', { hasText: deleteName }).count(), { timeout: 15000 })
    .toBeGreaterThan(0);

  const sidebarLinks = page.locator("aside a[href^='/profiles/manage/']");
  let preDeleteCount = await sidebarLinks.count();
  if (preDeleteCount < 2) {
    const extraName = `Delete Extra ${Date.now().toString().slice(-4)}`;
    await page.getByRole('button', { name: '+ Add new profile', exact: true }).click();
    await page.getByPlaceholder('e.g. Alex').fill(extraName);
    await page.getByRole('button', { name: 'Create Profile', exact: true }).click();
    await expect(page.locator('aside a', { hasText: extraName }).first()).toBeVisible({ timeout: 10000 });
    preDeleteCount = await sidebarLinks.count();
  }
  expect(preDeleteCount).toBeGreaterThan(1);

  // Navigate to the delete-me profile explicitly before deleting
  const deleteLink = page.locator('aside a', { hasText: deleteName }).first();
  if ((await deleteLink.count()) > 0) {
    // Retry click — link can detach during React re-render of the sidebar
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await deleteLink.click({ timeout: 5000 });
        break;
      } catch {
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(1500);
  }
  await ensureManageUnlocked(page);
  await expect(page.getByRole('button', { name: 'Delete Profile', exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Delete Profile', exact: true }).click();
  // Inline confirmation renders — wait up to 8s for it to appear
  const yesDelete = page.getByRole('button', { name: 'Yes, delete', exact: true });
  await expect(yesDelete).toBeVisible({ timeout: 8000 });
  try {
    await yesDelete.click({ timeout: 8000 });
  } catch {
    // Fallback when transient overlays intercept pointer events.
    await yesDelete.evaluate((el) => (el as HTMLButtonElement).click());
  }
  await ensureManageUnlocked(page);
  await expect
    .poll(async () => sidebarLinks.count(), { timeout: 10000 })
    .toBe(preDeleteCount - 1);

  // Last profile — delete disabled
  const sidebarCount = await page.locator("aside a[href^='/profiles/manage/']").count();
  const deleteDisabled = await page.getByRole('button', { name: 'Delete Profile', exact: true }).isDisabled();
  const disableMsg = await page.getByText('Delete disabled: you cannot delete the only remaining profile.', { exact: true }).count();
  if (sidebarCount === 1) {
    expect(deleteDisabled).toBe(true);
    expect(disableMsg).toBeGreaterThan(0);
  } else {
    expect(deleteDisabled).toBe(false);
  }
});
