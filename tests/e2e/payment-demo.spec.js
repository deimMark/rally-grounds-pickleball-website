import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sample = 'day=2026-11-07&court=court-3&start=08%3A00&duration=120&players=4';
const route = '/booking/payment-demo?' + sample;
const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const serious = (results) => results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
const receipts = resolve('public/images/receipts');
const pngPath = resolve(receipts, 'sample-gcash-receipt.png'), jpgPath = resolve(receipts, 'sample-bank-receipt.jpg'), webpPath = resolve(receipts, 'sample-receipt.webp');
const pngBytes = readFileSync(pngPath);
const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fileInput = (page) => page.getByLabel('Receipt image (sample only)');
const alertIn = (page) => page.locator('main').getByRole('alert');

function watch(page) {
 const mutations = [], api = [];
 page.on('request', (r) => { if (!['GET', 'HEAD'].includes(r.method())) mutations.push(`${r.method()} ${r.url()}`); if (/\/api\/|supabase|storage\.googleapis|gcash\.com|\/upload/i.test(r.url())) api.push(r.url()); });
 return { mutations, api };
}

test('4A: confirmation and status link to the payment demo; instructions, frozen total and demo recipient are shown', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto('/booking/confirmation?' + sample);
 await page.getByRole('link', { name: 'Explore the payment demo' }).click();
 await expect(page).toHaveURL(/\/booking\/payment-demo\?day=2026-11-07/);
 await expect(page.getByRole('heading', { name: 'Pay, then show us the receipt.' })).toBeVisible();
 await expect(page.getByText('DEMONSTRATION ONLY', { exact: true })).toBeVisible();
 await expect(page.locator('main')).toContainText('00000000-0000-4000-8000-000000000300');
 await expect(page.locator('main')).toContainText('Court 3');
 await expect(page.locator('main')).toContainText('8:00 AM – 10:00 AM');
 await expect(page.locator('.payment-amount')).toHaveText('₱1,200');
 await expect(page.getByText('DEMO ONLY — NO REAL TRANSFER', { exact: true })).toBeVisible();
 await expect(page.locator('main')).toContainText('No account number, mobile number or QR code is shown');
 await expect(page.locator('main')).not.toContainText(/09\d{9}|\b\d{10,16}\b/); // no phone/account numbers
 await expect(page.locator('main')).toContainText('this demonstration collects no payment at all');
 await page.goto('/booking/status?' + sample);
 await expect(page.getByRole('link', { name: 'Explore the payment demo' })).toHaveAttribute('href', '/booking/payment-demo?' + sample.replace(/%3A/g, '%3A'));
});

test('4A: GCash and bank transfer selection change the instructions; keyboard operable', async ({ page }) => {
 await page.goto(route);
 const gcash = page.getByRole('radio', { name: /GCash/ }), bank = page.getByRole('radio', { name: /Bank transfer/ });
 await expect(gcash).toBeChecked();
 await expect(page.getByRole('heading', { name: 'How you would pay with GCash' })).toBeVisible();
 await expect(page.locator('.payment-instructions ol')).toContainText('Open the GCash app');
 await gcash.focus(); await page.keyboard.press('ArrowDown');
 await expect(bank).toBeChecked();
 await expect(page.getByRole('heading', { name: 'How you would pay with Bank transfer' })).toBeVisible();
 await expect(page.locator('.payment-instructions ol')).toContainText('Transfer to another bank');
 await expect(page.getByText('DEMO ONLY — NO REAL TRANSFER', { exact: true })).toBeVisible();
});

test('4A: valid PNG, JPEG and WebP samples preview with filename, type, size and dimensions; remove and replace work', async ({ page }) => {
 await page.goto(route);
 const input = fileInput(page);
 await expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
 await expect(page.getByText('No receipt image selected yet.')).toBeVisible();
 for (const [path, label, name] of [[pngPath, 'PNG', 'sample-gcash-receipt.png'], [jpgPath, 'JPEG', 'sample-bank-receipt.jpg'], [webpPath, 'WebP', 'sample-receipt.webp']]) {
  await input.setInputFiles(path);
  const figure = page.locator('.payment-preview');
  await expect(figure.getByRole('img')).toBeVisible();
  await expect(figure.getByRole('img')).toHaveAttribute('alt', `Preview of the selected sample receipt image ${name}`);
  await expect(figure.getByRole('img')).toHaveJSProperty('naturalWidth', 390);
  await expect(figure.locator('figcaption')).toContainText(name);
  await expect(figure.locator('figcaption')).toContainText(label);
  await expect(figure.locator('figcaption')).toContainText(/\d+ KB/);
  await expect(figure.locator('figcaption')).toContainText('390×620px');
  await expect(figure.locator('figcaption')).toContainText('Not uploaded');
  await expect(page.locator('main').getByRole('status').last()).toContainText('ready to preview');
  expect(await figure.getByRole('img').getAttribute('src')).toMatch(/^blob:/);
 }
 const blobUrl = await page.locator('.payment-preview img').getAttribute('src');
 await page.getByRole('button', { name: 'Remove image' }).click();
 await expect(page.locator('.payment-preview')).toHaveCount(0);
 await expect(page.getByText('No receipt image selected yet.')).toBeVisible();
 await expect(page.locator('.payment-announcer')).toContainText('Selected image removed');
 expect(await input.inputValue()).toBe('');
 // The revoked object URL can no longer be loaded.
 expect(await page.evaluate(async (url) => { try { await fetch(url); return 'loaded'; } catch { return 'revoked'; } }, blobUrl)).toBe('revoked');
 await input.setInputFiles(pngPath);
 const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Replace image' }).click()]);
 await chooser.setFiles(jpgPath);
 await expect(page.locator('.payment-preview figcaption')).toContainText('sample-bank-receipt.jpg');
});

test('4A: unsupported, mismatched, corrupted, oversized and empty selections give accessible errors with focus on the input', async ({ page }) => {
 await page.goto(route);
 const input = fileInput(page);
 const cases = [
  { file: { name: 'receipt.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a' + 'x'.repeat(64)) }, text: 'file type is not supported' },
  { file: { name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sample') }, text: 'file type is not supported' },
  { file: { name: 'renamed.png', mimeType: 'image/png', buffer: Buffer.from('GIF89a' + 'x'.repeat(64)) }, text: 'does not look like a real PNG, JPEG or WebP image' },
  { file: { name: 'truncated.png', mimeType: 'image/png', buffer: Buffer.concat([pngHeader, Buffer.from('not really an image')]) }, text: 'could not be opened' },
  { file: { name: 'huge.png', mimeType: 'image/png', buffer: Buffer.concat([pngBytes, Buffer.alloc(4 * 1024 * 1024 + 1 - pngBytes.length)]) }, text: 'larger than the demo limit of 4.0 MB' },
 ];
 for (const { file, text } of cases) {
  await input.setInputFiles(file);
  await expect(alertIn(page)).toHaveCount(1);
  await expect(alertIn(page)).toContainText(text);
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  expect((await input.getAttribute('aria-describedby')).split(' ')).toContain((await alertIn(page).getAttribute('id')));
  await expect(page.locator('.payment-preview')).toHaveCount(0);
 }
 // A good file clears the error.
 await input.setInputFiles(pngPath);
 await expect(alertIn(page)).toHaveCount(0);
 await expect(input).not.toHaveAttribute('aria-invalid', 'true');
 // Empty submission.
 await page.getByRole('button', { name: 'Remove image' }).click();
 await page.getByRole('button', { name: 'Submit demo receipt' }).click();
 await expect(alertIn(page)).toContainText('Choose a receipt image first');
 await expect(input).toBeFocused();
 await expect(page).toHaveURL(/payment-demo/);
});

test('4A: submitting a demo receipt shows the pending-review state with no verified-payment claim, no mutation, no storage, no cookies', async ({ page, context }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 const { mutations, api } = watch(page);
 await page.goto(route);
 await fileInput(page).setInputFiles(pngPath);
 await page.getByRole('button', { name: 'Submit demo receipt' }).click();
 await expect(page.getByRole('heading', { name: 'Receipt submitted — awaiting staff verification (DEMO)' })).toBeVisible();
 await expect(page.getByText('No payment has been verified. No real receipt was uploaded.', { exact: true }).first()).toBeVisible();
 await expect(page.getByRole('heading', { name: 'Sample booking to pay for' })).toBeFocused();
 await expect(page.locator('main p.booking-state')).toContainText('awaiting staff verification');
 await expect(page.locator('main')).toContainText('Submitting a receipt does not extend the hold');
 await expect(page.locator('main')).toContainText('Sample unpaid hold'); // booking status unchanged
 await expect(page.locator('main')).not.toContainText(/payment verified\b(?!.*fictional)/i);
 await expect(page.locator('.payment-submitted .payment-preview img')).toBeVisible();
 expect(mutations).toEqual([]); expect(api).toEqual([]);
 expect(await context.cookies()).toEqual([]);
 expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, indexed: (await indexedDB.databases()).length, caches: (await caches.keys()).length }))).toEqual({ local: 0, session: 0, indexed: 0, caches: 0 });
 expect(page.url()).not.toMatch(/blob|base64|receipt|image=/);
 // A fresh load does not carry a submission.
 await page.reload();
 await expect(page.locator('main p.booking-state')).toContainText('Awaiting evidence');
 await expect(page.getByRole('heading', { name: /awaiting staff verification/ })).toHaveCount(0);
 // Start over restores the picker.
});

test('4A: demo outcome previews (rejected, verified-fictional, expired) and the expired scenario block submissions', async ({ page }) => {
 await page.goto(route);
 const select = page.getByLabel('Preview a demo outcome');
 await select.selectOption('needs_resubmission');
 await expect(page.getByRole('group', { name: 'Sample outcome preview' })).toContainText('Receipt rejected — resubmission needed (DEMO)');
 await select.selectOption('verified');
 await expect(page.getByRole('group', { name: 'Sample outcome preview' })).toContainText('Payment verified — fictional scenario (DEMO)');
 await expect(page.getByRole('group', { name: 'Sample outcome preview' })).toContainText('no money was received');
 await select.selectOption('expired');
 await expect(page.getByRole('group', { name: 'Sample outcome preview' })).toContainText('would not revive it');
 await expect(page.locator('main p.booking-state')).toContainText('Awaiting evidence'); // preview never changes the real demo state
 await page.goto(route + '&scenario=expired');
 await expect(page.locator('main p.booking-state')).toContainText('Booking expired — evidence cannot be submitted (DEMO)');
 await expect(page.locator('main')).toContainText('would not revive the reservation');
 await expect(fileInput(page)).toHaveCount(0);
 await expect(page.getByRole('button', { name: 'Submit demo receipt' })).toHaveCount(0);
 await expect(page.locator('.payment-amount')).toHaveText('₱1,200'); // frozen total unchanged
});

test('4A: missing or malformed demo context shows a safe unavailable state', async ({ page }) => {
 for (const query of ['', 'reference=00000000-0000-4000-8000-000000000300', sample + '&scenario=verified', sample.replace('duration=120', 'duration=0120'), sample.replace('court=court-3', 'court=%3Cscript%3Eprobe%3C%2Fscript%3E')]) {
  await page.goto('/booking/payment-demo' + (query ? '?' + query : ''));
  await expect(page.getByRole('heading', { name: 'Payment demo unavailable' })).toBeVisible();
  await expect(page.locator('main')).toContainText('No receipt can be submitted and no payment is collected');
  await expect(page.locator('main')).not.toContainText('probe');
  await expect(page.getByRole('link', { name: 'Explore the booking demo' })).toBeVisible();
 }
});

test('4A: staff queue, filtering, scenarios, local-only simulation and verified-revenue exclusion', async ({ page }) => {
 const { mutations, api } = watch(page);
 await page.goto('/staff/payments-demo');
 await expect(page.getByRole('heading', { name: 'Receipts are claims until the money is found.' })).toBeVisible();
 await expect(page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Receipt review demo' })).toHaveAttribute('aria-current', 'page');
 await expect(page.locator('main')).toContainText('A displayed receipt is not verified funds.');
 await expect(page.locator('main')).toContainText('matching recipient, actual received amount, settlement details and transaction reference');
 const rows = page.locator('tbody tr');
 await expect(rows).toHaveCount(5);
 for (const name of ['Sample Customer A', 'Sample Customer B', 'Sample Customer C', 'Sample Customer D', 'Sample Customer E']) await expect(page.locator('tbody')).toContainText(name);
 const metric = (label) => page.locator('.metric-card', { hasText: label }).locator('strong');
 await expect(metric('Verified (fictional)')).toHaveText('₱600');
 await expect(metric('Unverified claims')).toHaveText('₱1,800');
 await expect(metric('Awaiting review')).toHaveText('1');
 await page.getByLabel('Filter sample receipt queue').selectOption('pending_review');
 await expect(rows).toHaveCount(1); await expect(rows.first()).toContainText('Sample Customer B');
 await page.getByLabel('Filter sample receipt queue').selectOption('needs_resubmission');
 await expect(rows.first()).toContainText('Sample Customer C');
 await page.getByLabel('Filter sample receipt queue').selectOption('all');
 // Detail for the pending claim (default), image preview and simulated decisions.
 await page.getByRole('button', { name: 'Review Sample Customer B, 00000000-0000-4000-8000-000000000302' }).click();
 const detail = page.locator('.payment-detail');
 await expect(detail.getByRole('heading', { name: 'Sample Customer B' })).toBeFocused();
 await expect(detail.getByRole('img')).toHaveAttribute('alt', /SAMPLE, NOT A REAL PAYMENT/);
 await expect(detail).toContainText('Verified money received');
 await expect(detail.locator('dd', { hasText: /^₱0$/ })).toHaveCount(1);
 await expect(detail).toContainText('8:40 AM'); // Manila time of the sample submission
 await detail.getByRole('button', { name: 'Simulate: reject receipt' }).click();
 await expect(detail.locator('.payment-pill')).toContainText('Needs resubmission');
 await expect(metric('Verified (fictional)')).toHaveText('₱600');
 await expect(detail.locator('.payment-announcer')).toContainText('Verified revenue unchanged');
 await detail.getByRole('button', { name: 'Simulate: verified (fictional)' }).click();
 await expect(detail.locator('.payment-pill')).toContainText('Verified (fictional)');
 await expect(metric('Verified (fictional)')).toHaveText('₱1,200');
 await expect(detail).toContainText('₱600 (fictional)');
 await detail.getByRole('button', { name: 'Reset sample queue' }).click();
 await expect(metric('Verified (fictional)')).toHaveText('₱600');
 // Expired and awaiting scenarios offer no decision.
 await page.getByRole('button', { name: /Review Sample Customer E/ }).click();
 await expect(detail.getByRole('button', { name: 'Simulate: reject receipt' })).toBeDisabled();
 await expect(detail).toContainText('must not revive the reservation');
 await page.getByRole('button', { name: /Review Sample Customer A/ }).click();
 await expect(detail).toContainText('Nothing to review until a receipt is submitted');
 expect(mutations).toEqual([]); expect(api).toEqual([]);
 await page.reload();
 await expect(metric('Verified (fictional)')).toHaveText('₱600'); // nothing persisted
});

test('4A: keyboard-only receipt submission at 390px with visible focus and no severe accessibility violations', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto(route);
 const outline = () => page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0; });
 const reach = async (locator, limit = 60) => { let guard = 0; while (!(await locator.evaluate((el) => el === document.activeElement)) && guard++ < limit) await page.keyboard.press('Tab'); expect(guard).toBeLessThan(limit); };
 await reach(page.getByRole('radio', { name: /GCash/ })); expect(await outline()).toBe(true);
 await page.keyboard.press('ArrowDown'); await expect(page.getByRole('radio', { name: /Bank transfer/ })).toBeChecked();
 const input = fileInput(page); await reach(input); expect(await outline()).toBe(true);
 await input.setInputFiles(webpPath); // file chooser content cannot be typed; selection itself is keyboard-triggered in real browsers
 await expect(page.locator('.payment-preview')).toBeVisible();
 await reach(page.getByRole('button', { name: 'Remove image' })); expect(await outline()).toBe(true);
 const submit = page.getByRole('button', { name: 'Submit demo receipt' }); await reach(submit); expect(await outline()).toBe(true);
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading', { name: 'Sample booking to pay for' })).toBeFocused();
 await expect(page.getByRole('heading', { name: /awaiting staff verification/ })).toBeVisible();
 expect(serious(await new AxeBuilder({ page }).withTags(wcag).analyze())).toEqual([]);
 await reach(page.getByRole('button', { name: 'Start the demo again' })); await page.keyboard.press('Enter');
 await expect(fileInput(page)).toBeVisible();
});

for (const width of [320, 360, 390, 768, 1440]) {
 test(`4A: payment and staff review pages fit ${width}px with no severe accessibility violations`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  for (const path of [route, route + '&scenario=expired', '/booking/payment-demo', '/staff/payments-demo']) {
   const response = await page.goto(path);
   if (path.startsWith('/booking/')) { expect(response.headers()['referrer-policy']).toBe('no-referrer'); expect(response.headers()['cache-control']).toContain('no-store'); }
   await expect(page.locator('main h1')).toBeVisible();
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
   expect(serious(await new AxeBuilder({ page }).withTags(wcag).analyze())).toEqual([]);
   if (path === route) {
    await fileInput(page).setInputFiles(jpgPath);
    await expect(page.locator('.payment-preview')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await fileInput(page).setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('nope') });
    await expect(alertIn(page)).toBeVisible();
    expect(serious(await new AxeBuilder({ page }).withTags(wcag).analyze())).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
   }
  }
 });
}

test('4A: existing booking flow, court geometry and staff overview remain intact', async ({ page }) => {
 await page.goto('/book');
 await expect(page.locator('.court-map')).toBeVisible();
 const box = async (n) => page.getByRole('button', { name: new RegExp(`^Court ${n},`) }).boundingBox();
 const a = await box(3), c = await box(5), d = await box(2), e = await box(1);
 expect(a.height / a.width).toBeCloseTo(44 / 20, 1);
 expect(Math.abs(d.x + d.width - c.x - c.width)).toBeLessThanOrEqual(1);
 expect(Math.abs(e.x - d.x)).toBeLessThanOrEqual(1);
 await page.goto('/staff');
 await expect(page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
 await expect(page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Receipt review demo' })).not.toHaveAttribute('aria-current', 'page');
 await expect(page.getByRole('heading', { name: 'Sample schedule' })).toBeVisible();
});
