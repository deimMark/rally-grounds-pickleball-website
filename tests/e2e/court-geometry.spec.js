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
    for (const number of [3, 4, 5, 2, 1]) {
      const button = court(page, number);
      const box = boxes[number] = await documentBox(button);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(map.x);
      expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height + 1);
      const net = await button.locator('.court-lines > span').boundingBox();
      const service = await button.locator('.court-lines i').boundingBox();
      if ([3, 4, 5].includes(number)) {
        expect(box.height / box.width).toBeGreaterThan(1.8);
        expect(net.width).toBeGreaterThan(net.height * 5);
        expect(service.height).toBeGreaterThan(service.width * 5);
      } else {
        expect(box.width / box.height).toBeGreaterThan(1.8);
        expect(net.height).toBeGreaterThan(net.width * 5);
        expect(service.width).toBeGreaterThan(service.height * 5);
      }
      expect(await button.locator('.court-status').evaluate((node) => {
        const child = node.getBoundingClientRect(); const parent = node.closest('button').getBoundingClientRect();
        return child.left >= parent.left && child.right <= parent.right + 1 && child.bottom <= parent.bottom;
      })).toBe(true);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.session-heading h3')).toHaveText(`Court ${number}`);
    }
    expect(boxes[3].y).toBeCloseTo(boxes[4].y, 0);
    expect(boxes[4].y).toBeCloseTo(boxes[5].y, 0);
    expect(boxes[3].x + boxes[3].width).toBeLessThan(boxes[4].x);
    expect(boxes[4].x + boxes[4].width).toBeLessThan(boxes[5].x);
    expect(boxes[2].y).toBeGreaterThan(boxes[5].y + boxes[5].height);
    expect(boxes[1].y).toBeGreaterThan(boxes[2].y + boxes[2].height);
    expect(boxes[2].x).toBeCloseTo(boxes[5].x, 0);
    expect(boxes[1].x).toBeCloseTo(boxes[2].x, 0);
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
