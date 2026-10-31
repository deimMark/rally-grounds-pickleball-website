import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signIn } from './staff-login';

test('anonymous staff access redirects; login and logout require trusted POST origins', async ({ page, request }) => {
  await page.goto('/staff');
  await expect(page).toHaveURL('/staff/login');
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
  const deniedLogin = await request.post('/auth/login', { headers: { Origin: 'https://evil.test' }, form: { email: 'irrelevant@rally.test', password: 'irrelevant' } });
  expect(deniedLogin.status()).toBe(403);
  expect((await request.post('/auth/logout')).status()).toBe(403);
  expect((await request.get('/auth/logout')).status()).toBe(405);
  await expect(page.getByRole('heading', { name: 'A good day starts here.' })).toHaveCount(0);
});
test('active owner can sign in; cookies are HttpOnly and logout removes staff access', async ({ page, context }) => {
  await signIn(page, 'OWNER');
  const cookies = (await context.cookies()).filter((item) => item.name.startsWith('sb-'));
  expect(cookies.length).toBeGreaterThan(0);
  expect(cookies.every((item) => item.httpOnly && item.sameSite === 'Lax')).toBe(true);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/staff/login');
  await page.goto('/staff');await expect(page).toHaveURL('/staff/login');
});
for (const identity of ['INACTIVE', 'OUTSIDER']) {
  test(`${identity.toLowerCase()} cannot enter the protected workspace`, async ({ page }) => {
    await page.goto('/staff/login');
    await page.getByLabel('Email', { exact: true }).fill(process.env[`TEST_${identity}_EMAIL`]);
    await page.getByLabel('Password', { exact: true }).fill(process.env[`TEST_${identity}_PASSWORD`]);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('Sign in could not be completed');
    await page.goto('/staff');await expect(page).toHaveURL('/staff/login');
  });
}
test('invalid password produces a generic error without account details', async ({ page }) => {
  await page.goto('/staff/login');
  await page.getByLabel('Email', { exact: true }).fill(process.env.TEST_STAFF_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill('synthetic-incorrect-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText('Sign in could not be completed. Check your details and staff access, then try again.');
});
test('tampering with a session cookie cannot impersonate staff', async ({ page, context }) => {
  await signIn(page);
  const cookies = (await context.cookies()).filter((item) => item.name.startsWith('sb-'));
  await context.clearCookies();
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, value: 'tampered-session' })));
  await page.goto('/staff');await expect(page).toHaveURL('/staff/login');
});
test('server proxy refreshes an expired session envelope with the real refresh token', async ({ page, context }) => {
  await signIn(page);
  const cookies = (await context.cookies()).filter((item) => item.name.startsWith('sb-')).sort((a, b) => a.name.localeCompare(b.name));
  const value = cookies.map((item) => item.value).join('');
  expect(value.startsWith('base64-')).toBe(true);
  const session = JSON.parse(Buffer.from(value.slice(7), 'base64url').toString());
  session.expires_at = 1;
  const changed = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  expect(cookies.length).toBe(1); // Synthetic local session fits in a single cookie.
  await context.addCookies([{ ...cookies[0], value: changed }]);
  await page.goto('/staff');await expect(page).toHaveURL('/staff');
  const refreshed = (await context.cookies()).find((item) => item.name === cookies[0].name);
  expect(refreshed.value).not.toBe(changed);
});
test('database role revocation denies an existing browser session immediately', async ({ page }) => {
  const owner = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await owner.auth.signInWithPassword({ email: process.env.TEST_OWNER_EMAIL, password: process.env.TEST_OWNER_PASSWORD });
  expect(login.error).toBeNull();
  const params = { p_user_id: process.env.TEST_REVOCABLE_ID, p_role: 'staff', p_active: true };
  expect((await owner.rpc('set_staff_role', params)).error).toBeNull();
  try {
    await signIn(page, 'REVOCABLE');
    expect((await owner.rpc('set_staff_role', { ...params, p_active: false })).error).toBeNull();
    await page.goto('/staff');await expect(page).toHaveURL('/staff/login');
  } finally { await owner.rpc('set_staff_role', params); }
});
