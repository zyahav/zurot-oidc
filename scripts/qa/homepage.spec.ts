import { test, expect } from '@playwright/test';

const BASE_URL = process.env.ZUROT_BASE_URL || 'http://localhost:3000';

test('Homepage - signed-out user sees public landing', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'Safe profiles and app access for every child in your home.' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel('Email address')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Get Started', exact: true })).toBeVisible({ timeout: 10000 });
});

test('Homepage - invalid email shows validation message', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible({ timeout: 10000 });
});

test('Homepage - email submit opens account creation', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  await page.getByLabel('Email address').fill('new.parent@example.com');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toHaveValue('new.parent@example.com');
});

test('Homepage - Go to profiles opens sign-in directly when signed out', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'Go to profiles', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Sign in to ZurOt.org', exact: true })).toBeVisible({ timeout: 10000 });
});
