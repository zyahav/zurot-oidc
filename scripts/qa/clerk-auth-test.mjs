import { createClerkClient } from '@clerk/backend';
import { clerkSetup, clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { chromium } from 'playwright';

const BASE_URL = process.env.ZUROT_BASE_URL || 'http://localhost:3000';

await clerkSetup();
console.log('clerkSetup done. FAPI:', process.env.CLERK_FAPI);

const clerkBackend = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const stamp = Date.now();
const email = `qa.authtest.${stamp}@example.com`;
const user = await clerkBackend.users.createUser({
  emailAddress: [email], password: 'QaRun2Pass1234',
  firstName: 'QA', lastName: 'AuthTest', skipPasswordChecks: true,
});
console.log('user created:', email);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await setupClerkTestingToken({ page });
await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'networkidle', timeout: 15000 });
console.log('URL after goto:', page.url());

await clerk.signIn({ page, emailAddress: email });
console.log('URL after signIn:', page.url());

await page.waitForURL('**/profiles', { timeout: 15000 });
const body = (await page.locator('body').innerText()).slice(0, 300);
console.log('body:', body);
const success = body.includes("Who's Watching") || body.includes('Add Profile');
console.log('AUTH SUCCESS:', success);

await browser.close();
await clerkBackend.users.deleteUser(user.id);
console.log('cleanup done');
process.exit(success ? 0 : 1);
