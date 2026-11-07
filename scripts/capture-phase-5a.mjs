import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Captures the Phase 5A QA screenshots from a local production build (synthetic data only).
// Start `npm run start -- --port 3107` first. Output: docs/qa/phase-5a/*.png + capture-metadata.json
// The "enabled Reclub link" captures type a TEST-ONLY link with an obviously fake path into the
// in-memory staff form; every request to reclub.co is intercepted and aborted.
const origin = process.env.CAPTURE_ORIGIN || 'http://127.0.0.1:3107';
const directory = 'docs/qa/phase-5a';
const TEST_MEET = 'https://reclub.co/SAMPLE-TEST-ONLY-not-a-real-meet';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const records = [];
const addEvent = async (page, link) => {
 await page.getByLabel('Event title').fill('Fictional evening rally');
 await page.locator('form.staff-form').getByRole('checkbox', { name: 'Court 2' }).check();
 await page.getByLabel('Start (Asia/Manila)').selectOption('17');
 await page.getByLabel('End (Asia/Manila)').selectOption('19');
 if (link) await page.getByLabel('Reclub Meet link (optional)').fill(link);
};
const scenarios = [
 { name: '01-staff-overview-desktop', width: 1440, route: '/staff' },
 { name: '02-staff-overview-mobile-390', width: 390, route: '/staff' },
 { name: '03-daily-schedule-open-play-desktop', width: 1440, route: '/staff/schedule' },
 { name: '04-daily-schedule-mobile-390', width: 390, route: '/staff/schedule' },
 { name: '05-weekly-schedule-desktop', width: 1440, route: '/staff/schedule', prepare: async (page) => { await page.getByRole('button', { name: 'Week', exact: true }).click(); } },
 { name: '06-booking-list-desktop', width: 1440, route: '/staff/bookings' },
 { name: '07-booking-details-desktop', width: 1440, route: '/staff/bookings?ref=00000000-0000-4000-8000-000000000302' },
 { name: '08-open-play-management-desktop', width: 1440, route: '/staff/open-play' },
 { name: '09-maintenance-closure-preview-desktop', width: 1440, route: '/staff/maintenance', prepare: async (page) => { await page.getByLabel('Maintenance reason (fictional)').fill('surface sweep'); await page.locator('#mc-court').selectOption('court-2'); await page.getByRole('button', { name: 'Review affected schedule' }).click(); await page.locator('#mc-review-ok').waitFor(); }, keepFocus: true },
 { name: '10-occupancy-conflict-warning-desktop', width: 1440, route: '/staff/maintenance', prepare: async (page) => { await page.getByLabel('Maintenance reason (fictional)').fill('surface sweep'); await page.locator('#mc-court').selectOption('court-1'); await page.getByLabel('Start (Asia/Manila)').selectOption('8'); await page.getByLabel('End (Asia/Manila)').selectOption('10'); await page.getByRole('button', { name: 'Review affected schedule' }).click(); await page.locator('.conflict-warning').waitFor(); }, keepFocus: true },
 { name: '11-customer-history-desktop', width: 1440, route: '/staff/customers', prepare: async (page) => { await page.getByRole('button', { name: 'History for Sample Customer C' }).click(); } },
 { name: '12-cancellation-request-desktop', width: 1440, route: '/staff/requests', prepare: async (page) => { await page.getByRole('button', { name: 'Review CR-1' }).click(); } },
 { name: '13-rescheduling-request-conflict-desktop', width: 1440, route: '/staff/requests', prepare: async (page) => { await page.getByRole('button', { name: 'Review RR-2' }).click(); } },
 { name: '14-receipt-review-integration-desktop', width: 1440, route: '/staff/payments-demo' },
 { name: '15-keyboard-mobile-menu-390', width: 390, route: '/staff/schedule', prepare: async (page) => { await page.getByRole('button', { name: /Staff menu/ }).click(); await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Schedule' }).focus(); }, keepFocus: true, keyboard: true },
 { name: '16-open-play-event-details-mobile-390', width: 390, route: '/staff/schedule', prepare: async (page) => { await page.getByRole('button', { name: /^Details for Court 5, 8:00 AM – 12:00 PM, Open play$/ }).click(); await page.locator('.staff-detail .reclub-pending').waitFor(); } },
 { name: '17-reclub-link-pending-desktop', width: 1440, route: '/staff/schedule', prepare: async (page) => { await page.locator('table.day-grid').getByRole('button', { name: /Court 5, Open play/ }).click(); await page.locator('.staff-detail .reclub-pending').waitFor(); } },
 { name: '18-reclub-link-validation-desktop', width: 1440, route: '/staff/open-play', prepare: async (page) => { await addEvent(page, 'https://reclub.co.evil.example/meet'); await page.getByRole('button', { name: 'Check and add to preview' }).click(); await page.locator('#op-reclub-error').waitFor(); }, keepFocus: true },
 { name: '19-reclub-link-management-preview-desktop', width: 1440, route: '/staff/open-play', prepare: async (page) => { await addEvent(page, TEST_MEET); await page.locator('#op-reclub-status.ready').waitFor(); }, testLink: true },
 { name: '20-reclub-link-enabled-schedule-desktop', width: 1440, route: '/staff/open-play', prepare: async (page) => { await addEvent(page, TEST_MEET); await page.getByRole('button', { name: 'Check and add to preview' }).click(); await page.locator('.simulation-notice.shown').waitFor(); await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Schedule' }).click(); await page.locator('table.day-grid a.reclub-link').waitFor(); await page.locator('table.day-grid').getByRole('button', { name: /Court 2, Open play/ }).click(); await page.locator('.staff-detail a.reclub-link').waitFor(); }, testLink: true },
];
try {
 for (const scenario of scenarios) {
  const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.width === 390 ? 844 : 1000 } });
  await context.route(/reclub\.co/i, (route) => route.abort());
  const page = await context.newPage();
  const mutations = [];
  page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()); });
  await page.goto(origin + scenario.route);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('main h1').waitFor();
  if (scenario.keyboard) await page.keyboard.press('Tab');
  if (scenario.prepare) await scenario.prepare(page);
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
  const severe = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  assert.deepEqual(severe, [], `Serious/critical accessibility violations: ${scenario.name}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow: ${scenario.name}`);
  const text = await page.locator('body').innerText();
  assert.ok(/SYNTHETIC STAFF DEMONSTRATION|DEMONSTRATION ONLY/.test(text), `Missing demo label: ${scenario.name}`);
  assert.ok(!/\b09\d{9}\b/.test(text), `Phone-number-like text: ${scenario.name}`);
  assert.ok(!/@(?!example\.invalid)[a-z0-9-]+\.[a-z]{2,}/i.test(text), `Non-synthetic email: ${scenario.name}`);
  const reclubLinks = await page.locator('a[href*="reclub"]').evaluateAll((links) => links.map((link) => link.href));
  assert.ok(reclubLinks.every((href) => href === TEST_MEET) && (scenario.testLink || reclubLinks.length === 0), `Unexpected Reclub link: ${scenario.name}`);
  assert.deepEqual(mutations, [], `Mutation request: ${scenario.name}`);
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await page.setViewportSize({ width: scenario.width, height: Math.max(height, 600) });
  if (!scenario.keepFocus) await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${directory}/${scenario.name}.png`, animations: 'disabled' });
  records.push({ name: scenario.name, route: scenario.route, width: scenario.width, usesTestOnlyReclubLink: Boolean(scenario.testLink), violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), incompleteRules: results.incomplete.map((r) => ({ id: r.id, nodes: r.nodes.length })) });
  await context.close();
 }
 await writeFile(`${directory}/capture-metadata.json`, JSON.stringify({ capturedAt: new Date().toISOString(), branch: 'phase-5a-staff-demo', baseCommit: '563eb8b3893ed2b5a882c0f882562775502cff91', data: 'synthetic staff fixtures (staff-demo-v1); test-only Reclub link in captures marked usesTestOnlyReclubLink, requests aborted', records }, null, 2) + '\n');
 console.log(`Captured ${records.length} Phase 5A screenshots with zero serious/critical accessibility violations.`);
} finally {
 await browser.close();
}
