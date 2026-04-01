import { createClerkClient } from '@clerk/backend';
import { clerkSetup, clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

const { CLERK_FAPI, CLERK_TESTING_TOKEN } = await clerkSetup();
process.env.CLERK_FAPI = CLERK_FAPI;
process.env.CLERK_TESTING_TOKEN = CLERK_TESTING_TOKEN;
console.log('CLERK_FAPI:', CLERK_FAPI);
console.log('CLERK_TESTING_TOKEN prefix:', CLERK_TESTING_TOKEN?.slice(0, 20));

const clerkBackend = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const stamp = Date.now();
const email = `qa.test.${stamp}@example.com`;
const user = await clerkBackend.users.createUser({
  emailAddress: [email],
  password: 'QaRun2Pass1234',
  firstName: 'QA', lastName: 'Test', skipPasswordChecks: true,
});
console.log('created user:', user.id, email);

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
console.log('AUTH SUCCESS:', body.includes("Who's Watching") || body.includes('Add Profile'));

await browser.close();
await clerkBackend.users.deleteUser(user.id);
console.log('done');
