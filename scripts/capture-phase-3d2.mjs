import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Captures Phase 3D.2 QA screenshots from a local production build (synthetic data only).
// Start `npm run start -- --port 3101` first. Output: docs/qa/phase-3d2/*.png + capture-metadata.json
const origin = process.env.CAPTURE_ORIGIN || 'http://127.0.0.1:3101';
const directory = 'docs/qa/phase-3d2';
const sample = 'day=2026-11-07&court=court-3&start=08%3A00&duration=120&players=4';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const records = [];
const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('main h1').waitFor();
}
async function fullHeight(page, width) {
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await page.setViewportSize({ width, height: Math.max(height, 600) });
}
const scenarios = [
  { name: 'booking-desktop', width: 1440, route: '/book', prepare: async (page) => { await page.getByLabel('Session duration').selectOption('120'); } },
  { name: 'booking-grouped-slots-mobile-390', width: 390, route: '/book', prepare: async (page) => { await page.getByLabel('Session duration').selectOption('120'); await page.getByRole('button', { name: '8:00 AM Available', exact: true }).click(); } },
  { name: 'booking-list-view-mobile-390', width: 390, route: '/book', prepare: async (page) => { await page.getByRole('button', { name: 'List', exact: true }).click(); } },
  { name: 'reset-notice-mobile-390', width: 390, route: '/book', prepare: async (page) => { await page.getByRole('button', { name: '8:00 AM Available', exact: true }).click(); await page.getByLabel('Session duration').selectOption('120'); await page.locator('.booking-notice').waitFor(); } },
  { name: 'consent-error-mobile-390', width: 390, route: '/book', prepare: async (page) => { await page.getByLabel('Session duration').selectOption('120'); await page.getByRole('button', { name: '8:00 AM Available', exact: true }).click(); await page.getByRole('button', { name: 'Review demo details' }).click(); await page.getByRole('button', { name: 'Create demo preview' }).click(); await page.locator('main').getByRole('alert').waitFor(); } },
  { name: 'details-mobile-390', width: 390, route: '/book', prepare: async (page) => { await page.getByLabel('Session duration').selectOption('120'); await page.getByRole('button', { name: '8:00 AM Available', exact: true }).click(); await page.getByRole('button', { name: 'Review demo details' }).click(); await page.getByRole('heading', { name: 'Your crew, your session' }).waitFor(); } },
  { name: 'confirmation-mobile-390', width: 390, route: '/booking/confirmation?' + sample },
  { name: 'status-desktop', width: 1440, route: '/booking/status?' + sample },
  { name: 'status-expired-mobile-390', width: 390, route: '/booking/status?' + sample, prepare: async (page) => { await page.getByLabel('Choose a demo status').selectOption('expired'); } },
  { name: 'status-unavailable-mobile-390', width: 390, route: '/booking/status' },
];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.width === 390 ? 844 : 1000 } });
    const page = await context.newPage();
    await page.goto(origin + scenario.route);
    await settle(page);
    if (scenario.prepare) await scenario.prepare(page);
    const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    assert.deepEqual(serious, [], `Serious/critical accessibility violations: ${scenario.name}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow: ${scenario.name}`);
    const text = await page.locator('body').innerText();
    assert.ok(/DEMONSTRATION|DEMO/.test(text), `Missing demo label: ${scenario.name}`);
    await fullHeight(page, scenario.width);
    if (!scenario.name.startsWith('consent-error')) await page.evaluate(() => document.activeElement?.blur());
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `${directory}/${scenario.name}.png`, animations: 'disabled' });
    records.push({ name: scenario.name, route: scenario.route, width: scenario.width, violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), incompleteRules: results.incomplete.map((r) => ({ id: r.id, nodes: r.nodes.length })) });
    await context.close();
  }
  await writeFile(`${directory}/capture-metadata.json`, JSON.stringify({ capturedAt: new Date().toISOString(), branch: 'phase-3d2-booking-ux', baseCommit: '0172b32d24f3a4f1fddb5e3e66ffe7620eb93265', data: 'synthetic fixtures only', records }, null, 2) + '\n');
  console.log(`Captured ${records.length} Phase 3D.2 screenshots with zero serious/critical accessibility violations.`);
} finally {
  await browser.close();
}
