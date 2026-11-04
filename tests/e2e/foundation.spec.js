import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [320, 360, 390, 768, 1440]) {
  for (const route of ['/', '/staff']) {
    test(`${route} fits ${width}px with working navigation and loaded assets`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(route);
      await expect(page.locator('main h1')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (route === '/') {
        await expect(page.getByText('Mock availability', { exact: false })).toBeVisible();
        await page.locator('.community-photo img').scrollIntoViewIfNeeded();
        await expect.poll(() => page.locator('.community-photo img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        if (width < 761) {
          await page.getByRole('button', { name: 'Open navigation' }).click();
          await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
          await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Our courts' }).click();
          await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
        } else {
          await page.getByRole('link', { name: 'Explore the courts', exact: true }).click();
        }
        await expect(page.getByRole('heading', { name: 'Five courts. Endless possibilities.' })).toBeInViewport();
      } else {
        await page.getByRole('link', { name: 'Public website', exact: true }).click();
        await expect(page).toHaveURL('/');
      }
      expect(errors).toEqual([]);
    });
  }
}

test('court selector preserves layout and previews only; date changes reset selection', async ({ page }) => {
  const mutations = [];
  page.on('request', (req) => { if (req.method() !== 'GET') mutations.push(req.url()); });
  await page.goto('/');
  await expect(page.locator('.court-map')).toBeVisible(); // wait for the streamed content reveal
  const court = (number) => page.getByRole('button', { name: new RegExp(`^Court ${number},`) });
  const bounds = {};
  for (const n of [1, 2, 3, 4, 5]) bounds[n] = await court(n).boundingBox();
  expect(bounds[3].x).toBeLessThan(bounds[4].x);
  expect(bounds[4].x).toBeLessThan(bounds[5].x);
  expect(bounds[3].y).toBe(bounds[5].y);
  expect(bounds[2].x + bounds[2].width).toBeCloseTo(bounds[5].x + bounds[5].width, 0);
  expect(bounds[1].x).toBe(bounds[2].x);
  expect(bounds[1].y).toBeGreaterThan(bounds[2].y);
  const preview = page.getByRole('button', { name: 'Preview this session' });
  await expect(preview).toBeDisabled();
  await page.getByRole('button', { name: '8:00 AM Available', exact: true }).click();
  await preview.click();
  await expect(page.getByRole('status')).toContainText('No court has been reserved');
  await page.getByLabel('Explore a demo day').selectOption('2026-11-08');
  await expect(preview).toBeDisabled();
  await expect(page.getByRole('button', { name: '8:00 AM Reserved', exact: true })).toBeDisabled();
  await court(2).click();
  await expect(page.getByText('No sample sessions available here.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await court(1).click();
  await expect(court(1)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '8:00 AM Available', exact: true }).click();
  await preview.click();
  await expect(page.getByRole('status')).toContainText('Court 1');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(preview).toBeDisabled();
  expect(mutations).toEqual([]);
});

test('open-play samples cannot be selected and court controls work with keyboard', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  const court5 = page.getByRole('button', { name: 'Court 5, Open play', exact: true });
  await court5.focus();
  await page.keyboard.press('Enter');
  await expect(court5).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '8:00 AM Open play', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Preview this session' })).toBeDisabled();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Court 2, Available', exact: true })).toBeFocused();
});

test('staff demo filters synthetic sessions without enabling operations', async ({ page }) => {
  await page.goto('/staff');
  await expect(page.getByText('No authentication or live operations', { exact: false })).toBeVisible();
  await expect(page.getByText('₱1,200', { exact: true })).toBeVisible();
  await expect(page.getByText('₱900', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.getByLabel('Filter sample schedule').selectOption('review');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('1 synthetic session');
  await expect(page.getByRole('button', { name: /verify|pay|book|save/i })).toHaveCount(0);
});

for (const route of ['/', '/staff']) {
  test(`${route} has no serious or critical accessibility violations`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  });
}

for (const width of [320, 360, 390, 760]) {
  test(`mobile schedule exposes every booking detail at ${width}px and preserves filtering`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/staff');
    await expect(page.locator('.schedule-table-wrapper')).toBeHidden();
    const cards = page.getByRole('list', { name: 'Synthetic booking details' });
    await expect(cards).toBeVisible();
    await expect(cards.locator('li')).toHaveCount(4);
    for (const card of await cards.locator('li').all()) {
      await expect(card.getByRole('heading')).toBeVisible();
      for (const label of ['Reference', 'Time', 'Session type', 'Booking status']) {
        await expect(card.locator('dt').filter({ hasText: label })).toBeVisible();
      }
      await expect(card.locator('.status-pill')).toBeVisible();
      expect(await card.evaluate((node) => [...node.querySelectorAll('dd, .status-pill')].every((field) => {
        const box = field.getBoundingClientRect();
        return field.scrollWidth <= field.clientWidth + 1 && box.left >= 0 && box.right <= innerWidth;
      }))).toBe(true);
    }
    const filter = page.getByLabel('Filter sample schedule');
    await filter.focus();
    await expect(filter).toBeFocused();
    await filter.selectOption('review');
    await expect(cards.locator('li')).toHaveCount(1);
    await expect(cards).toContainText('DEMO-002');
    await expect(cards).toContainText('Pending review');
    await expect(page.getByRole('status')).toContainText('1 synthetic session');
    await filter.selectOption('all');
    await expect(cards.locator('li')).toHaveCount(4);
  });
}

test('desktop schedule keeps all statuses and demo collection labels visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/staff');
  await expect(page.locator('.schedule-cards')).toBeHidden();
  expect(await page.locator('.schedule-table-wrapper').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  for (const status of await page.locator('tbody .status-pill').all()) await expect(status).toBeVisible();
  const net = page.locator('.metric-card').filter({ hasText: 'Net collections' });
  await expect(net).toContainText('₱900');
  await expect(net).toContainText('DEMO FIGURE');
});

test('draft contact stays unverified and interactive targets remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  // Content streams through app/(public)/loading.js and is revealed after load; controls
  // have no layout box (boundingBox() === null) until then, so wait before measuring.
  await expect(page.locator('.session-panel')).toBeVisible();
  await expect(page.locator('.draft-contact')).toContainText('OWNER CONFIRMATION PENDING');
  await expect(page.locator('.draft-contact')).toContainText('0917 777 3933');
  await expect(page.locator('.draft-contact')).toContainText('These supplied details are unverified');
  await expect(page.locator('form, input, a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator('.map-orientation')).toHaveCount(0);
  for (const selector of ['.mobile-menu', '.view-switch button', '.session-panel select', '.time-slots button', '.session-cta']) {
    for (const control of await page.locator(selector).all()) {
      const box = await control.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  }
});
