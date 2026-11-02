import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Only local, mock-only routes. Start the final production build on port 3101 first.
const origin = 'http://127.0.0.1:3101';
const directory = 'docs/qa/phase-1.1';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
const records = [];
try {
  for (const [name, route, width] of [
    ['desktop-homepage', '/', 1440], ['mobile-homepage-390', '/', 390],
    ['desktop-staff-dashboard', '/staff', 1440], ['mobile-staff-dashboard-390', '/staff', 390],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    const page = await context.newPage();
    await page.goto(origin + route);
    await page.evaluate(() => document.fonts.ready);
    for (const img of await page.locator('img').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate((node) => node.decode());
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(results.violations, [], `Accessibility violations: ${name}`);
    const contrast = results.passes.find((rule) => rule.id === 'color-contrast');
    assert.ok(contrast, `Contrast rule did not pass: ${name}`);
    const helpers = await page.locator('.small-muted, .demo-explanation, .table-footnote, .metric-card p, .metric-card small, .status-pill, figcaption').evaluateAll((nodes) => nodes.filter((node) => node.checkVisibility()).map((node) => Number.parseFloat(getComputedStyle(node).fontSize)));
    assert.ok(helpers.every((size) => size >= 12));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true, animations: 'disabled' });
    if (name === 'mobile-staff-dashboard-390') {
      // Capture in document coordinates without scrolling fixed/offscreen UI into the crop.
      const clip = await page.locator('#schedule').boundingBox();
      await page.screenshot({ path: `${directory}/mobile-schedule-details-390.png`, clip, fullPage: true, captureBeyondViewport: true, animations: 'disabled' });
    }
    records.push({ name, route, width, violations: results.violations, contrastNodesPassed: contrast.nodes.length,
      incompleteRules: results.incomplete.map((rule) => ({ id: rule.id, nodes: rule.nodes.length })), minimumHelperPixels: Math.min(...helpers) });
    await context.close();
  }
  await writeFile(`${directory}/capture-metadata.json`, JSON.stringify({
    capturedAt: new Date().toISOString(), branch: 'phase-1-1-visual-qa',
    baseCommit: '1a9b04c262759ce62bf72573a86e3924c6809c48',
    revision: 'Phase 1.1 working tree captured before its checkpoint commit',
    photoSha256: createHash('sha256').update(await readFile('public/images/pickleball-community.jpg')).digest('hex'), records,
  }, null, 2) + '\n');
  console.log(`Captured five Phase 1.1 screenshots; all four route/viewport accessibility scans had zero violations.`);
} finally {
  await browser.close();
}
