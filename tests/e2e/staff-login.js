import { expect } from '@playwright/test';
export async function signIn(page, identity = 'STAFF') {
  const email = process.env[`TEST_${identity}_EMAIL`];
  const password = process.env[`TEST_${identity}_PASSWORD`];
  if (!email || !password) throw new Error('Run npm run db:staff before browser tests; synthetic Auth fixtures are required');
  await page.goto('/staff/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/staff');
}
