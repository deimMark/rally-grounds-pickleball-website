import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const serious = (results) => results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
const REF = (n) => `00000000-0000-4000-8000-000000000${n}`;
// Test-only Reclub fixture on the allowlisted host with an obviously fake path; requests to it
// are intercepted and aborted so no real external navigation happens during tests.
const TEST_MEET = 'https://reclub.co/SAMPLE-TEST-ONLY-not-a-real-meet';
const LABEL = 'SIMULATED ACTION — NO BOOKING CHANGED';
const staffRoutes = ['/staff', '/staff/schedule', '/staff/bookings', '/staff/open-play', '/staff/maintenance', '/staff/customers', '/staff/requests', '/staff/payments-demo'];

function guard(page, context) {
 const mutations = [], external = [], reclub = [];
 page.on('request', (r) => {
  if (!['GET', 'HEAD'].includes(r.method())) mutations.push(`${r.method()} ${r.url()}`);
  if (/\/api\/|supabase|gcash\.com|\/upload/i.test(r.url())) external.push(r.url());
 });
 context.route(/reclub\.co/i, (route) => { reclub.push(route.request().url()); route.abort(); });
 return { mutations, external, reclub };
}
async function storageIsEmpty(page, context) {
 expect(await context.cookies()).toEqual([]);
 expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, indexed: (await indexedDB.databases()).length }))).toEqual({ local: 0, session: 0, indexed: 0 });
}
const metric = (page, label) => page.locator('.metric-card', { hasText: label }).locator('strong');

test('5A overview: computed operations and payment metrics, labels and navigation', async ({ page, context }) => {
 const g = guard(page, context);
 await page.goto('/staff');
 await expect(page.getByText('SYNTHETIC STAFF DEMONSTRATION', { exact: true })).toBeVisible();
 await expect(page.getByText('Example data — no live bookings or payments')).toBeVisible();
 for (const [label, value] of [['Today’s sessions', '3'], ['Available court time', '67 h'], ['Upcoming reservations', '9'], ['Pending payment reviews', '1'], ['Cancellation requests', '1'], ['Rescheduling requests', '2'], ['Open-play periods', '3'], ['Maintenance closures', '2'], ['Verified payments (fictional)', '₱8,400'], ['Unverified claims', '₱1,800'], ['Completed refunds (sample)', '₱600'], ['Net collections (fictional)', '₱7,800']]) await expect(metric(page, label)).toHaveText(value);
 const nav = page.getByRole('navigation', { name: 'Dashboard navigation' });
 for (const name of ['Overview', 'Schedule', 'Bookings', 'Open play', 'Maintenance', 'Customers', 'Requests', 'Receipt review demo']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
 await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
 await page.getByRole('link', { name: /Receipt review demo 1 awaiting review/ }).click();
 await expect(page.getByRole('heading', { name: 'Receipts are claims until the money is found.' })).toBeVisible();
 await expect(nav.getByRole('link', { name: 'Receipt review demo' })).toHaveAttribute('aria-current', 'page');
 await expect(page.locator('main')).toContainText('the staff overview totals every sample booking');
 expect(g.mutations).toEqual([]); expect(g.external).toEqual([]);
});

test('5A schedule: daily grid shows five courts, open play with pending Reclub state, details and court filter', async ({ page, context }) => {
 const g = guard(page, context);
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto('/staff/schedule');
 const grid = page.locator('table.day-grid');
 await expect(grid).toBeVisible();
 await expect(grid.locator('tbody tr')).toHaveCount(5);
 await expect(grid.locator('tbody th')).toHaveText([/Court 1/, /Court 2/, /Court 3/, /Court 4/, /Court 5/]);
 const court5 = grid.locator('tbody tr').nth(4);
 await expect(court5.getByRole('button', { name: /Court 5, Open play/ })).toBeVisible();
 await expect(court5.locator('td.item')).toHaveAttribute('colspan', '4'); // one coherent 8 AM–12 PM block
 await expect(court5.locator('.reclub-pending')).toHaveText('Reclub Meet link pending for Saturday community open play, Sat, 7 Nov 2026, 8:00 AM – 12:00 PM');
 await expect(page.locator('a[href*="reclub"]')).toHaveCount(0); // pending is never a link
 await expect(court5.locator('td.item button button, td.item a button, td.item button a')).toHaveCount(0); // nothing nested
 await court5.getByRole('button', { name: /Court 5, Open play/ }).click();
 const detail = page.locator('.staff-detail');
 await expect(detail.getByRole('heading', { name: 'Open play · Court 5' })).toBeFocused();
 await expect(detail).toContainText('Saturday community open play');
 await expect(detail).toContainText('Unavailable on these courts during this event');
 await expect(detail).toContainText('8:00 AM – 12:00 PM');
 await expect(detail).toContainText('2026-11-07T00:00:00.000Z');
 await expect(detail.locator('.reclub-pending')).toBeVisible();
 await grid.getByRole('button', { name: /Court 4, Review \(Pending review\)/ }).click();
 await expect(detail).toContainText('Sample Customer B');
 await expect(detail.getByRole('link', { name: 'Open the booking record' })).toHaveAttribute('href', `/staff/bookings?ref=${REF(302)}`);
 // Court filter from the shared CourtMap, and the select.
 await page.locator('.staff-map').getByRole('button', { name: 'Court 3, Available' }).click();
 await expect(grid.locator('tbody tr')).toHaveCount(1);
 await expect(page.getByRole('status').filter({ hasText: 'Court 3 only' })).toBeVisible();
 await page.locator('#schedule-court').selectOption('all');
 await expect(grid.locator('tbody tr')).toHaveCount(5);
 // Type filter keeps occupied time visible as "Filtered", never free.
 await page.locator('#schedule-filter').selectOption('maintenance');
 await expect(court5.locator('td.hidden')).toHaveCount(1);
 await expect(court5.getByText('Court 5 occupied 8:00 AM – 12:00 PM, hidden by the current filter')).toBeAttached();
 expect(g.mutations).toEqual([]); expect(g.reclub).toEqual([]);
});

test('5A schedule: weekly view, date selection and maintenance blocks', async ({ page }) => {
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto('/staff/schedule');
 await page.getByRole('button', { name: 'Week', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Week', exact: true })).toHaveAttribute('aria-pressed', 'true');
 const week = page.locator('table.week-grid');
 await expect(week.locator('tbody tr')).toHaveCount(7);
 await expect(week.locator('tbody th').first()).toContainText('Sat, 7 Nov');
 await expect(week.locator('tbody tr').nth(2)).toContainText('Maintenance'); // Mon 9 Nov MC-1
 await expect(week.locator('tbody tr').nth(4).locator('.reclub-pending')).toHaveCount(2); // OP-3 on Courts 4 and 5
 await page.locator('#schedule-date').selectOption('2026-11-01');
 await expect(week.locator('tbody th').first()).toContainText('Sat, 31 Oct');
 await expect(week).toContainText('Completed');
});

test('5A schedule mobile: list alternative with details and pending Reclub text at 390px', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto('/staff/schedule');
 await expect(page.locator('table.day-grid')).toBeHidden();
 const list = page.getByRole('list', { name: /Court schedule list/ });
 await expect(list).toBeVisible();
 await expect(list.locator(':scope > li')).toHaveCount(5);
 const court5 = list.locator(':scope > li').nth(4);
 await expect(court5.locator('.reclub-pending')).toBeVisible();
 await court5.getByRole('button', { name: /^Details for Court 5, 8:00 AM – 12:00 PM, Open play$/ }).click();
 await expect(page.getByRole('heading', { name: 'Open play · Court 5' })).toBeFocused();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.getByRole('button', { name: /Staff menu/ }).click();
 await expect(page.getByRole('button', { name: /Staff menu/ })).toHaveAttribute('aria-expanded', 'true');
 await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Bookings' }).click();
 await expect(page.getByRole('heading', { name: 'Sample bookings' })).toBeVisible();
});

test('5A bookings: search, seven detail sections, no receipt-based confirmation, confirmed simulated cancellation resets on reload', async ({ page, context }) => {
 const g = guard(page, context);
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto('/staff/bookings');
 await page.getByLabel('Search by reference or customer name').fill('302');
 await expect(page.getByRole('status').filter({ hasText: 'sample bookings shown' })).toHaveText('1 of 15 sample bookings shown');
 await page.getByRole('button', { name: `View booking ${REF(302)}, Sample Customer B` }).click();
 const detail = page.locator('.staff-detail');
 await expect(detail.getByRole('heading', { name: 'Sample Customer B · Court 4' })).toBeFocused();
 for (const heading of ['1. Customer and booking reference', '2. Court and session', '3. Original agreement', '4. Current booking status', '5. Payment evidence', '6. Verification history', '7. Cancellation and rescheduling requests']) await expect(detail.getByRole('heading', { name: heading })).toBeVisible();
 await expect(detail).toContainText('customer-b@example.invalid');
 await expect(detail).toContainText('Receipt submitted (a claim)');
 await expect(detail.getByRole('button', { name: /confirm/i })).toHaveCount(0);
 await expect(detail).toContainText('A receipt alone cannot confirm a booking');
 await expect(detail.locator('dd', { hasText: /^₱0$/ })).toHaveCount(1); // verified money received
 await detail.getByRole('button', { name: 'Simulate: cancel booking' }).click();
 await expect(detail.getByRole('button', { name: 'Confirm simulated cancellation' })).toBeFocused();
 await detail.getByRole('button', { name: 'Keep booking' }).click();
 await expect(detail.getByText('Pending review', { exact: true }).first()).toBeVisible();
 await detail.getByRole('button', { name: 'Simulate: cancel booking' }).click();
 await detail.getByRole('button', { name: 'Confirm simulated cancellation' }).click();
 const notice = detail.locator('.simulation-notice');
 await expect(notice).toBeFocused();
 await expect(notice).toContainText(LABEL);
 await expect(detail.locator('.status-pill').first()).toHaveText('Cancelled');
 await expect(detail).toContainText('₱600'); // original agreement unchanged
 await expect(page.locator('.simulation-count')).toContainText('1 simulated change');
 await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Overview' }).click();
 await expect(metric(page, 'Today’s sessions')).toHaveText('2'); // shared in-memory simulation
 await page.reload();
 await expect(metric(page, 'Today’s sessions')).toHaveText('3'); // reload resets
 await storageIsEmpty(page, context);
 expect(g.mutations).toEqual([]); expect(g.external).toEqual([]);
});

test('5A bookings: future confirmed session cannot be completed and expired holds cannot be revived', async ({ page }) => {
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto(`/staff/bookings?ref=${REF(310)}`);
 const detail = page.locator('.staff-detail');
 await expect(detail.getByRole('button', { name: 'Simulate: mark session completed' })).toBeDisabled();
 await expect(detail).toContainText('the session has not ended at the demo clock');
 await page.goto(`/staff/bookings?ref=${REF(305)}`);
 await expect(detail).toContainText('An expired hold cannot be revived');
 await expect(detail.getByRole('button', { name: /Simulate/ })).toHaveCount(0);
 await page.goto('/staff/bookings?ref=not-a-reference');
 await expect(detail.getByRole('heading', { name: 'No booking selected' })).toBeVisible();
});

test('5A open play: validation, occupancy conflict, Reclub link validation, create with a test link and remove link', async ({ page, context }) => {
 const g = guard(page, context);
 await page.setViewportSize({ width: 1440, height: 1100 });
 await page.goto('/staff/open-play');
 await expect(page.locator('a[href*="reclub"]')).toHaveCount(0);
 await expect(page.locator('.event-card .reclub-pending')).toHaveCount(3);
 const form = page.locator('form.staff-form');
 await form.getByRole('button', { name: 'Check and add to preview' }).click();
 await expect(form.getByRole('alert')).toContainText('Fix 2 fields');
 await expect(page.getByLabel('Event title')).toBeFocused();
 await expect(page.getByLabel('Event title')).toHaveAttribute('aria-invalid', 'true');
 // Conflict with Saturday open play and booking 308 on Court 1.
 await page.getByLabel('Event title').fill('Fictional evening rally');
 await form.getByRole('checkbox', { name: 'Court 1' }).check();
 await form.getByRole('checkbox', { name: 'Court 5' }).check();
 await page.getByLabel('Start (Asia/Manila)').selectOption('8');
 await page.getByLabel('End (Asia/Manila)').selectOption('10');
 await expect(form.locator('.affected-schedule')).toContainText('Overlaps the proposal');
 await form.getByRole('button', { name: 'Check and add to preview' }).click();
 const warning = form.locator('.conflict-warning');
 await expect(warning).toBeFocused();
 await expect(warning).toContainText('Occupancy conflict — event not added');
 await expect(warning).toContainText('Sample Customer G');
 await expect(warning).toContainText('Open play');
 await expect(page.locator('.event-card')).toHaveCount(3);
 // Reclub URL validation feedback.
 const url = page.getByLabel('Reclub Meet link (optional)');
 for (const [value, text] of [['javascript:alert(1)', 'Only secure https://'], ['http://reclub.co/SAMPLE', 'Only secure https://'], ['https://reclub.co.evil.example/SAMPLE', 'Only links on reclub.co'], ['https://reclub.co/clubs/@sample', 'not a specific Meet']]) {
  await url.fill(value);
  await expect(page.locator('#op-reclub-status')).toContainText(text);
 }
 await form.getByRole('checkbox', { name: 'Court 1' }).uncheck();
 await form.getByRole('checkbox', { name: 'Court 5' }).uncheck();
 await form.getByRole('checkbox', { name: 'Court 2' }).check();
 await page.getByLabel('Start (Asia/Manila)').selectOption('17');
 await page.getByLabel('End (Asia/Manila)').selectOption('19');
 await form.getByRole('button', { name: 'Check and add to preview' }).click();
 await expect(page.getByLabel('Reclub Meet link (optional)')).toBeFocused();
 await expect(form.locator('#op-reclub-error')).toContainText('not a specific Meet');
 await url.fill(TEST_MEET);
 await expect(page.locator('#op-reclub-status')).toContainText('Valid Reclub link. Preview: reclub.co/SAMPLE-TEST-ONLY-not-a-real-meet');
 await form.getByRole('button', { name: 'Check and add to preview' }).click();
 const notice = page.locator('.simulation-notice');
 await expect(notice).toBeFocused();
 await expect(notice).toContainText(LABEL);
 await expect(notice).toContainText('Reclub Meet link set');
 const card = page.locator('.event-card', { hasText: 'Fictional evening rally' });
 const link = card.getByRole('link', { name: /^View Meet on Reclub for Fictional evening rally, Sat, 7 Nov 2026, 5:00 PM – 7:00 PM \(opens Reclub in a new tab\)$/ });
 await expect(link).toHaveAttribute('href', TEST_MEET);
 await expect(link).toHaveAttribute('target', '_blank');
 await expect(link).toHaveAttribute('rel', /noopener/);
 await expect(link).toHaveAttribute('rel', /noreferrer/);
 // Event-specific: only the new event links out; the fixtures stay pending.
 await expect(page.locator(`a[href="${TEST_MEET}"]`)).toHaveCount(1);
 await expect(page.locator('.event-card .reclub-pending')).toHaveCount(3);
 // The link opens only that Meet (intercepted) and changes nothing in Rally Grounds.
 const popupPromise = page.waitForEvent('popup');
 await link.click();
 const popup = await popupPromise;
 await expect.poll(() => g.reclub).toEqual([TEST_MEET]);
 await popup.close();
 await expect(page.locator('.simulation-count')).toContainText('1 simulated change');
 // The new event blocks the schedule (shared in-memory state) and shows the same Meet link.
 await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Schedule' }).click();
 const court2 = page.locator('table.day-grid tbody tr').nth(1);
 await expect(court2.getByRole('button', { name: /Court 2, Open play/ })).toBeVisible();
 await expect(court2.getByRole('link', { name: /^View Meet on Reclub for Fictional evening rally/ })).toHaveAttribute('href', TEST_MEET);
 await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Open play' }).click();
 await page.locator('.event-card', { hasText: 'Fictional evening rally' }).getByRole('button', { name: /Remove Reclub link/ }).click();
 await expect(page.locator('.event-card', { hasText: 'Fictional evening rally' }).locator('.reclub-pending')).toBeVisible();
 await expect(page.locator('a[href*="reclub"]')).toHaveCount(0);
 expect(g.mutations).toEqual([]); expect(g.external).toEqual([]);
 await storageIsEmpty(page, context);
});

test('5A open play: edit and cancel are local simulations with confirmation', async ({ page }) => {
 await page.goto('/staff/open-play');
 const card = page.locator('.event-card', { hasText: 'Sunday morning social' });
 await card.getByRole('button', { name: 'Edit Sunday morning social' }).click();
 await expect(page.getByRole('heading', { name: 'Edit open-play event' })).toBeFocused();
 await expect(page.getByLabel('Event title')).toHaveValue('Sunday morning social');
 await page.getByLabel('End (Asia/Manila)').selectOption('11'); // would overlap booking 315 at 10 AM
 await page.getByRole('button', { name: 'Check and save preview' }).click();
 await expect(page.locator('.conflict-warning')).toContainText('Sample Customer E');
 await page.getByLabel('End (Asia/Manila)').selectOption('10'); // touching 10 AM is allowed (half-open)
 await page.getByRole('button', { name: 'Check and save preview' }).click();
 await expect(page.locator('.simulation-notice')).toContainText('updated');
 await card.getByRole('button', { name: 'Cancel event Sunday morning social' }).click();
 await page.getByRole('button', { name: 'Confirm simulated cancellation' }).click();
 await expect(page.locator('.event-card', { hasText: 'Sunday morning social' })).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.event-card', { hasText: 'Sunday morning social' })).toHaveCount(1);
});

test('5A maintenance: affected-schedule review, conflict warning, creation only without conflicts, cancellation', async ({ page, context }) => {
 const g = guard(page, context);
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto('/staff/maintenance');
 const create = page.getByRole('button', { name: 'Create simulated closure' });
 await expect(create).toBeDisabled();
 await page.getByRole('button', { name: 'Review affected schedule' }).click();
 await expect(page.getByLabel('Maintenance reason (fictional)')).toBeFocused();
 await page.getByLabel('Maintenance reason (fictional)').fill('surface sweep');
 await page.locator('#mc-court').selectOption('court-1');
 await page.getByLabel('Start (Asia/Manila)').selectOption('8');
 await page.getByLabel('End (Asia/Manila)').selectOption('10');
 await page.getByRole('button', { name: 'Review affected schedule' }).click();
 const warning = page.locator('.conflict-warning');
 await expect(warning).toBeFocused();
 await expect(warning).toContainText('Occupancy conflict — closure not added');
 await expect(warning).toContainText('Booking · Court 1 · 8:00 AM – 9:00 AM · Confirmed (Sample Customer G)');
 await expect(warning).toContainText('never silently displaced');
 await expect(create).toBeDisabled();
 await page.locator('#mc-court').selectOption('court-2');
 await expect(create).toBeDisabled(); // any change invalidates the review
 await page.getByRole('button', { name: 'Review affected schedule' }).click();
 await expect(page.locator('#mc-review-ok')).toBeFocused();
 await create.click();
 await expect(page.locator('.simulation-notice')).toContainText(LABEL);
 const closure = page.locator('.event-card', { hasText: 'surface sweep' });
 await expect(closure).toContainText('Fictional: surface sweep');
 await expect(closure.locator('.simulated-tag')).toHaveText('Simulated');
 await closure.getByRole('button', { name: /Cancel closure/ }).click();
 await page.getByRole('button', { name: 'Confirm simulated cancellation' }).click();
 await expect(page.locator('.event-card', { hasText: 'surface sweep' })).toHaveCount(0);
 expect(g.mutations).toEqual([]);
});

test('5A customers: search by name or reference only, filters and chronological history', async ({ page }) => {
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto('/staff/customers');
 const search = page.getByLabel('Search by name or sample customer reference');
 await search.fill('customer-a@example.invalid');
 await expect(page.locator('.staff-empty')).toContainText('No fictional customers match');
 await search.fill('CUST-DEMO-A');
 await expect(page.locator('table.staff-table tbody tr')).toHaveCount(1);
 await search.fill('');
 await page.getByLabel('Show').selectOption('claims');
 await expect(page.locator('table.staff-table tbody tr')).toHaveCount(2);
 await page.getByLabel('Show').selectOption('all');
 await page.getByRole('button', { name: 'History for Sample Customer A' }).click();
 const detail = page.locator('.staff-detail');
 await expect(detail.getByRole('heading', { name: 'Sample Customer A' })).toBeFocused();
 const history = detail.locator('.customer-history li');
 await expect(history).toHaveCount(2);
 await expect(history.first()).toContainText('Sun, 1 Nov 2026');
 await expect(history.last()).toContainText('Sat, 7 Nov 2026');
 await expect(detail).toContainText('₱1,200');
});

test('5A requests: refund steps stay separate; approval records no payout; reschedule conflicts block approval', async ({ page }) => {
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto('/staff/requests');
 await page.getByRole('button', { name: 'Review CR-2' }).click();
 const detail = page.locator('.staff-detail');
 await expect(detail.getByRole('heading', { name: 'CR-2 · Cancellation' })).toBeFocused();
 await expect(detail).toContainText('Yes — sample payout of ₱600 recorded');
 await page.getByRole('button', { name: 'Review CR-1' }).click();
 await expect(detail).toContainText('Not decided');
 await expect(detail).toContainText('No payout recorded');
 await expect(detail).toContainText('a verified (fictional) payment of ₱1,200 exists');
 await detail.getByRole('button', { name: 'Simulate: approve cancellation' }).click();
 await detail.getByRole('button', { name: 'Confirm simulated approval' }).click();
 await expect(detail.locator('.simulation-notice')).toContainText(LABEL);
 await expect(detail.locator('.simulation-notice')).toContainText('no payout was recorded');
 await expect(detail.locator('.refund-steps')).toContainText('2. Refund approvedYes');
 await expect(detail.locator('.refund-steps')).toContainText('3. Refund completedNo payout recorded');
 await page.getByRole('button', { name: 'Review RR-2' }).click();
 await expect(detail).toContainText('Sample availability check: 1 conflict');
 await expect(detail.getByRole('button', { name: 'Simulate: approve reschedule' })).toBeDisabled();
 await page.getByRole('button', { name: 'Review RR-1' }).click();
 await expect(detail).toContainText('no conflict right now. Nothing has been reserved');
 await detail.getByRole('button', { name: 'Simulate: approve reschedule' }).click();
 await expect(detail.locator('.simulation-notice')).toContainText('The booking was not moved');
 await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Overview' }).click();
 await expect(metric(page, 'Completed refunds (sample)')).toHaveText('₱600'); // approval ≠ payout
 await expect(metric(page, 'Rescheduling requests')).toHaveText('1');
});

test('5A keyboard: staff navigation and schedule details reachable by Tab with visible focus', async ({ page }) => {
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto('/staff/schedule');
 const outline = () => page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0; });
 const reach = async (locator, limit = 80) => { let guardCount = 0; while (!(await locator.evaluate((el) => el === document.activeElement)) && guardCount++ < limit) await page.keyboard.press('Tab'); expect(guardCount).toBeLessThan(limit); };
 await reach(page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Bookings' }));
 expect(await outline()).toBe(true);
 const openPlay = page.locator('table.day-grid').getByRole('button', { name: /Court 5, Open play/ });
 await reach(openPlay);
 expect(await outline()).toBe(true);
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading', { name: 'Open play · Court 5' })).toBeFocused();
 expect(serious(await new AxeBuilder({ page }).withTags(wcag).analyze())).toEqual([]);
});

for (const width of [320, 360, 390, 768, 1440]) {
 test(`5A staff pages fit ${width}px with no serious accessibility violations`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  for (const route of staffRoutes) {
   await page.goto(route);
   await expect(page.locator('main h1')).toBeVisible();
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} overflow`).toBe(true);
   expect(serious(await new AxeBuilder({ page }).withTags(wcag).analyze()), route).toEqual([]);
  }
  await page.goto('/staff/schedule');
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(serious(await new AxeBuilder({ page }).withTags(wcag).analyze())).toEqual([]);
 });
}

test('5A geometry: the shared CourtMap keeps the approved layout on the staff schedule and booking page', async ({ page }) => {
 for (const route of ['/staff/schedule', '/book']) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(route);
  const map = route === '/book' ? page.locator('.booking-map .court-map') : page.locator('.staff-map .court-map');
  await expect(map).toBeVisible();
  const box = async (n) => map.getByRole('button', { name: new RegExp(`^Court ${n},`) }).boundingBox();
  const a = await box(3), b = await box(4), c = await box(5), d = await box(2), e = await box(1);
  const close = (x, y) => expect(Math.abs(x - y)).toBeLessThanOrEqual(1);
  for (const top of [b, c]) { close(a.width, top.width); close(a.height, top.height); close(a.y, top.y); }
  expect(a.height / a.width).toBeCloseTo(44 / 20, 1);
  close(d.width, a.height); close(d.height, a.width);
  for (const bottom of [d, e]) close(bottom.x + bottom.width, c.x + c.width);
  expect(a.x).toBeLessThan(b.x); expect(b.x).toBeLessThan(c.x); expect(e.y).toBeGreaterThan(d.y); expect(d.y).toBeGreaterThan(c.y);
 }
});
