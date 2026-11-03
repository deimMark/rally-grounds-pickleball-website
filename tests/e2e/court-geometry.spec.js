import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const documentBox = (locator) => locator.evaluate((node) => {
  const box = node.getBoundingClientRect();
  return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
});
const court = (page, number) => page.getByRole('button', { name: new RegExp(`^Court ${number},`) });
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`court geometry, markings and selection match the sketch at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const map = await documentBox(page.locator('.court-map'));
    const boxes = {};
    const close = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
    const right = (box) => box.x + box.width;
    const bottom = (box) => box.y + box.height;
    for (const number of [3, 4, 5, 2, 1]) boxes[number] = await documentBox(court(page, number));
    const w = boxes[3].width, h = boxes[3].height;
    close(h, w * 44 / 20);
    for (const number of [3, 4, 5]) {
      close(boxes[number].width, w); close(boxes[number].height, h);
      close(boxes[number].y, boxes[3].y);
    }
    for (const number of [2, 1]) {
      close(boxes[number].width, h); close(boxes[number].height, w);
      close(right(boxes[number]), right(boxes[5]));
    }
    close(boxes[1].x, boxes[2].x);
    close(boxes[1].y - bottom(boxes[2]), boxes[2].y - bottom(boxes[5]));
    const gap = boxes[4].x - right(boxes[3]);
    expect(gap).toBeGreaterThan(0);
    close(boxes[5].x - right(boxes[4]), gap);
    close(boxes[2].y - bottom(boxes[5]), gap);
    close(gap, w * 4 / 20);
    expect(boxes[2].x).toBeLessThan(boxes[5].x);
    for (const number of [3, 4, 5, 2, 1]) {
      const button = court(page, number), box = boxes[number];
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(map.x - 1);
      expect(right(box)).toBeLessThanOrEqual(right(map) + 1);
      expect(bottom(box)).toBeLessThanOrEqual(bottom(map) + 1);
      const net = await documentBox(button.locator('.court-net'));
      if ([3, 4, 5].includes(number)) {
        expect(net.width).toBeGreaterThan(net.height * 5);
        close(net.y + net.height / 2, box.y + box.height / 2);
      } else {
        expect(net.height).toBeGreaterThan(net.width * 5);
        close(net.x + net.width / 2, box.x + box.width / 2);
      }
      const label = await documentBox(button.locator('.court-tile-label strong'));
      close(label.x + label.width / 2, box.x + box.width / 2);
      close(label.y + label.height / 2, box.y + box.height / 2);
      const status = await documentBox(button.locator('.court-status'));
      expect(status.y).toBeGreaterThanOrEqual(label.y + label.height);
      expect(status.x).toBeGreaterThanOrEqual(box.x);
      expect(right(status)).toBeLessThanOrEqual(right(box) + 1);
      expect(bottom(status)).toBeLessThanOrEqual(bottom(box));
      // Clicking any court must leave every court's dimensions and gaps unchanged.
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.session-heading h3')).toHaveText(`Court ${number}`);
      for (const n of [3, 4, 5, 2, 1]) {
        const selectedBox = await documentBox(court(page, n));
        for (const dimension of ['x', 'y', 'width', 'height']) close(selectedBox[dimension], boxes[n][dimension]);
      }
    }
    const artwork = await page.locator('.court-map svg g').evaluateAll((nodes) => nodes.map((node) => node.innerHTML));
    expect(new Set(artwork).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await court(page, 5).click();
    await expect(page.getByRole('button', { name: '8:00 AM Open play', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('.court-map')).toHaveCount(0);
    await expect(page.locator('.court-list button')).toHaveCount(5);
    await court(page, 2).click();
    await expect(page.locator('.session-heading h3')).toHaveText('Court 2');
    await page.getByRole('button', { name: '8:00 AM Available', exact: true }).click();
    await page.getByRole('button', { name: 'Preview this session' }).click();
    await expect(page.getByRole('status')).toContainText('Court 2');
    await expect(page.getByRole('status')).toContainText('No court has been reserved');
  });
}

for (const width of [390, 1440]) {
  test(`court map remains keyboard accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await court(page, 3).focus();
    for (const number of [3, 4, 5, 2, 1]) {
      await expect(court(page, number)).toBeFocused();
      await page.keyboard.press('Space');
      await expect(court(page, number)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.session-heading h3')).toHaveText(`Court ${number}`);
      await page.keyboard.press('Tab');
    }
    const results = await new AxeBuilder({ page }).include('#courts').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
