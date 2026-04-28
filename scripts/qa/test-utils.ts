import { expect, Page } from '@playwright/test';

const TEST_PIN = '1234';

/**
 * Ensures we start from /profiles in a stable state
 */
export async function goToProfiles(page: Page) {
  await page.goto('/profiles');
  await expect(page).toHaveURL(/\/profiles/);
  await expect(page.getByRole('heading', { name: "Who's Watching?" })).toBeVisible();
}

async function gotoManageWithRetry(page: Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.goto('/profiles/manage', { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      await page.goto('/profiles', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
    }
  }
}

/**
 * Deterministically unlocks the Manage Profiles gate
 * Works whether gate is locked or already unlocked
 */
export async function unlockManageGate(page: Page) {
  await gotoManageWithRetry(page);

  const setupLocator = page.getByText('Set up your owner PIN');
  const pinEntryLocator = page.getByText('Enter your 4-digit owner PIN');
  const unlockedLocator = page.getByRole('button', { name: '+ Add new profile', exact: true });

  await setupLocator.or(pinEntryLocator).or(unlockedLocator).waitFor({ timeout: 20000 });

  if (await unlockedLocator.isVisible().catch(() => false)) {
    return;
  }

  if (await setupLocator.isVisible().catch(() => false)) {
    const inputs = page.locator('input[inputmode="numeric"]');
    await inputs.first().fill(TEST_PIN);
    await inputs.nth(1).fill(TEST_PIN);
    await page.getByRole('button', { name: 'Save PIN', exact: true }).click();
    await unlockedLocator.or(pinEntryLocator).waitFor({ timeout: 20000 });
    if (await pinEntryLocator.isVisible().catch(() => false)) {
      for (const digit of TEST_PIN) {
        await page.getByRole('button', { name: digit, exact: true }).click();
        await page.waitForTimeout(120);
      }
    }
    await unlockedLocator.waitFor({ timeout: 20000 });
    return;
  }

  if (await pinEntryLocator.isVisible().catch(() => false)) {
    const clear = page.getByRole('button', { name: 'Clear', exact: true });
    if (await clear.isVisible().catch(() => false)) {
      await clear.click().catch(() => {});
    }
    for (const digit of TEST_PIN) {
      await page.getByRole('button', { name: digit, exact: true }).click();
      await page.waitForTimeout(120);
    }
    await unlockedLocator.waitFor({ timeout: 20000 });
    return;
  }

  throw new Error('Failed to unlock manage gate');
}

/**
 * Ensures the Manage gate is in LOCKED state
 * (useful for tests that expect the gate UI)
 */
export async function expectManageGateLocked(page: Page) {
  await gotoManageWithRetry(page);

  const setupLocator = page.getByText('Set up your owner PIN');
  const pinEntryLocator = page.getByText('Enter your 4-digit owner PIN');
  const cancelLocator = page.getByRole('button', { name: 'Cancel', exact: true });

  await cancelLocator.waitFor({ timeout: 15000 });
  await expect(cancelLocator).toBeVisible();
  const setupVisible = await setupLocator.isVisible().catch(() => false);
  const pinEntryVisible = await pinEntryLocator.isVisible().catch(() => false);
  expect(setupVisible || pinEntryVisible).toBe(true);
}

/**
 * Safe navigation helper for clicks that trigger route changes
 */
export async function clickAndWaitForURL(
  page: Page,
  clickTarget: () => Promise<void>,
  urlPattern: string | RegExp
) {
  await Promise.all([
    page.waitForURL(urlPattern),
    clickTarget(),
  ]);
}

/**
 * Switch profile and ensure redirect completes
 */
export async function switchProfileToProfiles(page: Page) {
  await clickAndWaitForURL(
    page,
    async () => {
      await page.getByText('Switch profile').click();
    },
    /\/profiles/
  );

  await expect(page.getByRole('heading', { name: "Who's Watching?" })).toBeVisible();
}
