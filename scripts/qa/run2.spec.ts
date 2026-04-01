import { test, expect } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';

const OIDC_CLIENT_ID = 'mall-hebrew-adventures';
const TEST_PIN = '1234';
const TEST_ACCOUNT_PASSWORD = 'QaRun2Pass1234';
const MANAGE_GATE_SESSION_KEY = 'zurot_manage_gate_unlocked';

const BASE_URL = process.env.ZUROT_BASE_URL || 'http://localhost:3000';
const OIDC_REDIRECT_URI = `${BASE_URL}/test`;
const MANAGE_PASSWORD = TEST_ACCOUNT_PASSWORD;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickPin(page: import("@playwright/test").Page, pin: string) {
  for (const digit of pin.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
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
  testEmail = `qa.run2.${stamp}@example.com`;
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
  await page.waitForURL('**/profiles', { timeout: 15000 });
  // Wait for Convex to receive and process the new session JWT.
  // We verify by waiting for the profile grid (or Add Profile card) to appear,
  // which means getProfiles() has executed successfully with the new session token.
  await page.waitForSelector("text=Who's Watching?", { timeout: 15000 });
  await page.waitForSelector('text=Add Profile', { timeout: 10000 });
  // Extra settle time for Convex subscriptions to stabilize
  await sleep(1500);
});

// ─── Step 1: Profile Selection ───────────────────────────────────────────────

test('Step 1 - /profiles loads with profile grid', async ({ page }) => {
  // T-010 check: signed-in session with no active profile should resolve root "/" to "/profiles".
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForURL('**/profiles', { timeout: 10000 });

  await expect(page.getByRole('heading', { name: "Who's Watching?" })).toBeVisible();
  await expect(page.getByText('Add Profile', { exact: true }).first()).toBeVisible();
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

  // T-010 check: signed-in session with active profile should resolve root "/" to "/portal".
  let rootResolvedToPortal = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    try {
      await page.waitForURL('**/portal', { timeout: 12000 });
      rootResolvedToPortal = true;
      break;
    } catch {
      await page.goto(`${BASE_URL}/portal`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
    }
  }
  expect(rootResolvedToPortal).toBe(true);
});

test('Step 1 - Password gate appears on /profiles/manage', async ({ page }) => {
  // Use retry wrapper to avoid ERR_ABORTED and ensure session is active on this route
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(1500);
    }
  }
  await expect(page.getByText('Manage Profiles', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByPlaceholder('Account password')).toBeVisible();
});

test('Step 1 - Wrong management password shows inline error', async ({ page }) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(1500);
    }
  }
  await expect(page.getByText('Manage Profiles', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByPlaceholder('Account password')).toBeVisible({ timeout: 10000 });
  await page.getByPlaceholder('Account password').fill('wrong-password');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('Incorrect account password.', { exact: true })).toBeVisible({ timeout: 15000 });
});

test('Step 1 - PIN flow: set, modal, wrong attempts, cooldown, correct', async ({ page }) => {
  const profileName = uniqueProfileName();
  test.setTimeout(150000); // PIN cooldown is 30s + setup time
  test.skip(!MANAGE_PASSWORD, 'Manage password is not configured');

  // Create profile
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });

  // Set PIN via manage
  // Retry goto on ERR_ABORTED (can occur during Turbopack hot reload window)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByPlaceholder('Account password').fill(MANAGE_PASSWORD);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('Identity', { exact: true })).toBeVisible({ timeout: 10000 });

  // Navigate to the newly created profile — manage shows profiles[0] by default
  const profileLink = page.locator('aside a', { hasText: profileName }).first();
  await expect(profileLink).toBeVisible({ timeout: 10000 });
  await profileLink.click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Identity', { exact: true })).toBeVisible({ timeout: 5000 });

  // Clear any existing PIN first to guarantee a clean Set PIN flow
  if ((await page.getByRole('button', { name: 'Remove', exact: true }).count()) > 0) {
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    // Wait for Remove to complete — Set PIN button re-appears
    await expect(page.getByRole('button', { name: 'Set PIN', exact: true })).toBeVisible({ timeout: 8000 });
  }

  await page.getByRole('button', { name: 'Set PIN', exact: true }).click();
  await page.getByPlaceholder('0000').fill(TEST_PIN);
  await page.getByRole('button', { name: 'Save PIN', exact: true }).click();
  // Wait for PIN input to disappear (mode returns to idle) — more reliable than brief toast
  await expect(page.getByPlaceholder('0000')).toBeHidden({ timeout: 10000 });
  // Confirm PIN is now set — Remove button only appears when hasPin is true.
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeVisible({ timeout: 10000 });

  // Select PIN-protected profile — modal should appear
  await page.goto(`${BASE_URL}/profiles`);
  let pinModalVisible = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const profileCard = page.locator('button', { hasText: profileName }).first();
    await expect(profileCard).toBeVisible({ timeout: 10000 });
    try {
      await profileCard.click({ force: true, timeout: 5000 });
    } catch {
      await profileCard.evaluate((el) => (el as HTMLButtonElement).click());
    }
    await page.waitForTimeout(300);
    try {
      await page.getByText('Enter PIN', { exact: true }).waitFor({ state: 'visible', timeout: 4000 });
      pinModalVisible = true;
      break;
    } catch {
      if (page.url().includes('/portal')) {
        await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'networkidle' });
      }
      await page.waitForTimeout(1000);
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
  await enterPortalViaProfileCard(page, profileName);

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
  await enterPortalViaProfileCard(page, profileName);

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
  await enterPortalViaProfileCard(page, profileName);

  await page.locator('header button').first().click();
  await page.getByRole('button', { name: 'Switch profile', exact: true }).click();
  await page.waitForURL('**/profiles', { timeout: 10000 });
  expect(page.url()).toContain('/profiles');

  // T-010 check: sign-out should hard-redirect, and modal must not persist after sign-in.
  await page.getByRole('button', { name: 'Sign out of account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign out of account?' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/profiles', { timeout: 10000 });
  await expect(page.getByText('Sign in to select a profile.', { exact: true })).toBeVisible({ timeout: 10000 });

  // T-010 check: signed-out root should resolve to /profiles.
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForURL('**/profiles', { timeout: 10000 });

  // Sign back in and ensure sign-out modal does not persist.
  await clerk.signIn({ page, emailAddress: testEmail });
  await page.waitForURL('**/profiles', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: "Who's Watching?" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Sign out of account?' })).toHaveCount(0);
});

test('Step 2 - Disabled app removed from portal app grid', async ({ page }) => {
  const profileName = uniqueProfileName();
  test.skip(!MANAGE_PASSWORD, 'Manage password is not configured');

  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });
  await enterPortalViaProfileCard(page, profileName);

  // waitUntil: 'domcontentloaded' avoids ERR_ABORTED on manage route under load
  await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByPlaceholder('Account password').fill(MANAGE_PASSWORD);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('Identity', { exact: true })).toBeVisible({ timeout: 10000 });

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
  if (MANAGE_PASSWORD) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        break;
      } catch (e) {
        if (attempt === 2) throw e;
        await page.waitForTimeout(1500);
      }
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByPlaceholder('Account password').fill(MANAGE_PASSWORD);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByText('Identity', { exact: true })).toBeVisible({ timeout: 10000 });
    const profileLink = page.locator('aside a', { hasText: profileName }).first();
    if ((await profileLink.count()) > 0) {
      const href = await profileLink.getAttribute('href');
      profileHint = href?.split('/').pop() ?? null;
    }
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

test('Step 4 - Management password gate appears', async ({ page }) => {
  await page.evaluate(key => sessionStorage.removeItem(key), MANAGE_GATE_SESSION_KEY);
  await page.goto(`${BASE_URL}/profiles/manage`);
  await expect(page.getByText('This gate protects profile settings, PIN controls, and deletion actions.')).toBeVisible();
});

test('Step 4 - Wrong password inline error, does not lock', async ({ page }) => {
  await page.goto(`${BASE_URL}/profiles/manage`);
  await page.getByPlaceholder('Account password').fill('wrong-password');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('Incorrect account password.', { exact: true })).toBeVisible({ timeout: 15000 });
});

test('Step 4 - Full management dashboard flow', async ({ page }) => {
  const profileName = uniqueProfileName();
  test.skip(!MANAGE_PASSWORD, 'Manage password is not configured');

  // Create profile to work with
  await page.getByRole('button', { name: /Add Profile/i }).first().click();
  await page.getByPlaceholder('e.g. Alex').fill(profileName);
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.getByRole('button', { name: 'Create Profile' }).click();
  await expect(page.locator('button', { hasText: profileName }).first()).toBeVisible({ timeout: 10000 });

  // waitUntil: 'domcontentloaded' avoids ERR_ABORTED on manage route under load
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/profiles/manage`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByPlaceholder('Account password').fill(MANAGE_PASSWORD);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('Identity', { exact: true })).toBeVisible({ timeout: 10000 });

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
  await expect(page.locator('aside a', { hasText: deleteName }).first()).toBeVisible({ timeout: 10000 });

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
    await deleteLink.click();
    // Wait for the right panel to fully re-render for this profile.
    // The useEffect(selectedProfile) resets showDeleteConfirm — must complete before clicking.
    await page.waitForTimeout(1500);
    await page.waitForTimeout(800);
  }
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
