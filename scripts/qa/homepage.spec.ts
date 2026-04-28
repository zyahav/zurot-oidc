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

test('Homepage - email submit routes new user to profiles entry', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  await page.getByLabel('Email address').fill('new.parent@example.com');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();

  await expect(page).toHaveURL(/\/profiles\?email=new\.parent%40example\.com/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Profiles', exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible({ timeout: 10000 });
});
