import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Start the corrected production build locally on 3120. Never contacts a deployment.
const directory = 'docs/qa/phase-1.1/court-layout';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const records = [];
try {
  for (const [name, width] of [['desktop-court-selector', 1440], ['mobile-court-selector-390', 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3120/');
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page }).include('#courts').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(result.violations, []);
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    const geometry = await page.locator('.court-map .court-tile').evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { label: node.getAttribute('aria-label'), x: box.x, y: box.y + scrollY, width: box.width, height: box.height };
    }));
    const clip = await page.locator('#courts').boundingBox();
    await page.screenshot({ path: `${directory}/${name}.png`, clip, fullPage: true, animations: 'disabled' });
    records.push({ name, width, geometry, violations: result.violations,
      incompleteRules: result.incomplete.map((rule) => ({ id: rule.id, nodes: rule.nodes.length })) });
    await context.close();
  }
  await writeFile(`${directory}/capture-metadata.json`, JSON.stringify({
    capturedAt: new Date().toISOString(), baseCommit: '06134a67f67c6ba4d174ba1e982b5c4a219ef4ad',
    revision: 'Court orientation correction working tree, before its commit', records,
  }, null, 2) + '\n');
  console.log('Captured corrected desktop and 390px court selectors; both scoped axe scans have zero violations.');
} finally { await browser.close(); }
