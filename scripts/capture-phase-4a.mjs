import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Captures the Phase 4A QA screenshots from a local production build (synthetic data only).
// Start `npm run start -- --port 3103` first. Output: docs/qa/phase-4a/*.png + capture-metadata.json
const origin = process.env.CAPTURE_ORIGIN || 'http://127.0.0.1:3103';
const directory = 'docs/qa/phase-4a';
const sample = 'day=2026-11-07&court=court-3&start=08%3A00&duration=120&players=4';
const route = '/booking/payment-demo?' + sample;
const png = resolve('public/images/receipts/sample-gcash-receipt.png');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const records = [];
const pick = (page) => page.getByLabel('Receipt image (sample only)').setInputFiles(png);
const scenarios = [
 { name: '01-payment-instructions-mobile-390', width: 390, route },
 { name: '02-gcash-selected-mobile-390', width: 390, route, prepare: async (page) => { await page.getByRole('radio', { name: /GCash/ }).check(); await page.locator('.payment-instructions').scrollIntoViewIfNeeded(); } },
 { name: '03-bank-transfer-selected-mobile-390', width: 390, route, prepare: async (page) => { await page.getByRole('radio', { name: /Bank transfer/ }).check(); await page.getByRole('heading', { name: 'How you would pay with Bank transfer' }).waitFor(); } },
 { name: '04-receipt-selected-preview-mobile-390', width: 390, route, prepare: async (page) => { await pick(page); await page.locator('.payment-preview img').waitFor(); } },
 { name: '05-receipt-validation-error-mobile-390', width: 390, route, prepare: async (page) => { await page.getByLabel('Receipt image (sample only)').setInputFiles({ name: 'statement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sample') }); await page.locator('main').getByRole('alert').waitFor(); }, keepFocus: true },
 { name: '06-pending-review-confirmation-mobile-390', width: 390, route, prepare: async (page) => { await pick(page); await page.locator('.payment-preview img').waitFor(); await page.getByRole('button', { name: 'Submit demo receipt' }).click(); await page.getByRole('heading', { name: /awaiting staff verification/ }).waitFor(); } },
 { name: '07-staff-receipt-queue-desktop', width: 1440, route: '/staff/payments-demo' },
 { name: '08-staff-receipt-detail-mobile-390', width: 390, route: '/staff/payments-demo', prepare: async (page) => { await page.getByRole('button', { name: 'Review Sample Customer B' }).click(); await page.locator('.payment-detail').scrollIntoViewIfNeeded(); } },
 { name: '09-staff-rejected-scenario-mobile-390', width: 390, route: '/staff/payments-demo', prepare: async (page) => { await page.getByRole('button', { name: 'Review Sample Customer C' }).click(); await page.locator('.payment-detail').scrollIntoViewIfNeeded(); } },
 { name: '10-staff-verified-fictional-scenario-desktop', width: 1440, route: '/staff/payments-demo', prepare: async (page) => { await page.getByRole('button', { name: 'Review Sample Customer D, 00000000-0000-4000-8000-000000000304' }).click(); } },
 { name: '11-payment-page-desktop', width: 1440, route, prepare: async (page) => { await pick(page); await page.locator('.payment-preview img').waitFor(); } },
 { name: '12-expired-scenario-mobile-390', width: 390, route: route + '&scenario=expired' },
];
try {
 for (const scenario of scenarios) {
  const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.width === 390 ? 844 : 1000 } });
  const page = await context.newPage();
  await page.goto(origin + scenario.route);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('main h1').waitFor();
  if (scenario.prepare) await scenario.prepare(page);
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
  const severe = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  assert.deepEqual(severe, [], `Serious/critical accessibility violations: ${scenario.name}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow: ${scenario.name}`);
  const text = await page.locator('body').innerText();
  assert.ok(/DEMONSTRATION ONLY|DEMO/.test(text), `Missing demo label: ${scenario.name}`);
  assert.ok(!/\b09\d{9}\b/.test(text), `Phone-number-like text: ${scenario.name}`);
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await page.setViewportSize({ width: scenario.width, height: Math.max(height, 600) });
  if (!scenario.keepFocus) await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${directory}/${scenario.name}.png`, animations: 'disabled' });
  records.push({ name: scenario.name, route: scenario.route, width: scenario.width, violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), incompleteRules: results.incomplete.map((r) => ({ id: r.id, nodes: r.nodes.length })) });
  await context.close();
 }
 await writeFile(`${directory}/capture-metadata.json`, JSON.stringify({ capturedAt: new Date().toISOString(), branch: 'phase-4a-receipt-demo', baseCommit: 'af6ce955a0cf483c1b2acecadc6a9239d5a62f90', data: 'synthetic fixtures and sample images only', records }, null, 2) + '\n');
 console.log(`Captured ${records.length} Phase 4A screenshots with zero serious/critical accessibility violations.`);
} finally {
 await browser.close();
}
