import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const sample='day=2026-11-07&court=court-3&start=08%3A00&duration=120&players=4';
const wcag=['wcag2a','wcag2aa','wcag21aa','wcag22aa'];
const serious=results=>results.violations.filter(v=>['serious','critical'].includes(v.impact));
async function toDetails(page){await page.getByLabel('Session duration').selectOption('120');await page.getByRole('button',{name:'8:00 AM Available',exact:true}).click();await page.getByRole('button',{name:'Review demo details'}).click();await expect(page.getByRole('heading',{name:'Your crew, your session'})).toBeFocused();}

test('3D.2: submitting without consent shows one announced error, moves focus and does not navigate',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/book');await toDetails(page);
 const checkbox=page.getByRole('checkbox'),submit=page.getByRole('button',{name:'Create demo preview'});
 await expect(submit).toBeEnabled();await submit.click();
 const alert=page.locator('main').getByRole('alert');await expect(alert).toHaveCount(1);await expect(alert).toContainText('Tick the box to confirm');
 await expect(checkbox).toBeFocused();await expect(checkbox).toHaveAttribute('aria-invalid','true');
 expect(await checkbox.getAttribute('aria-describedby')).toBe('consent-error');
 await expect(page).toHaveURL(/\/book$/);
 // The live status region must not repeat the error (announce once).
 await expect(page.locator('.booking-notice-region')).toHaveText('');
 await page.keyboard.press('Space');await expect(alert).toHaveCount(0);await expect(checkbox).not.toHaveAttribute('aria-invalid','true');
 await submit.click();await expect(page).toHaveURL(/\/booking\/confirmation\?/);
 expect(await new AxeBuilder({page}).withTags(wcag).analyze().then(serious)).toEqual([]);
});

test('3D.2: consent error state passes automated accessibility checks',async({page})=>{
 await page.goto('/book');await toDetails(page);await page.getByRole('button',{name:'Create demo preview'}).click();await expect(page.locator('main').getByRole('alert')).toBeVisible();
 expect(serious(await new AxeBuilder({page}).withTags(wcag).analyze())).toEqual([]);
});

test('3D.2: clearing a chosen start announces why, once per change, and the next hint explains the disabled button',async({page})=>{
 await page.goto('/book');const next=page.getByRole('button',{name:'Review demo details'}),region=page.locator('.booking-notice-region');
 await expect(next).toBeDisabled();await expect(page.locator('#next-hint')).toContainText('Choose an available start time');expect(await next.getAttribute('aria-describedby')).toBe('next-hint');
 await expect(region).toHaveText('');
 await page.getByRole('button',{name:'8:00 AM Available',exact:true}).click();await expect(page.locator('#next-hint')).toContainText('Court 3, 8:00 AM – 9:00 AM');await expect(region).toHaveText('');
 await page.getByLabel('Session duration').selectOption('120');await expect(region).toContainText('Start time cleared because the session duration changed');await expect(next).toBeDisabled();
 await page.getByRole('button',{name:'9:00 AM Available',exact:true}).click();await expect(region).toHaveText('');
 await page.getByLabel('Demo date').selectOption('2026-11-08');await expect(region).toContainText('demo date changed');
 await page.getByRole('button',{name:'9:00 AM Available',exact:true}).click();await page.getByRole('button',{name:'Court 4, Available',exact:true}).click();await expect(region).toContainText('court changed');
 // Changing inputs with nothing selected is silent.
 await page.getByLabel('Session duration').selectOption('60');await expect(region).toHaveText('');
 expect(await region.getAttribute('role')).toBe('status');
});

test('3D.2: start times are grouped by period, unavailable slots are not tab stops but keep an accessible reason',async({page})=>{
 await page.goto('/book');await page.getByLabel('Session duration').selectOption('120');
 for(const name of ['Morning','Afternoon','Evening'])await expect(page.getByRole('group',{name})).toBeVisible();
 const morning=page.getByRole('group',{name:'Morning'});await expect(morning.getByRole('button')).toHaveCount(4);
 await expect(page.locator('#slot-summary')).toContainText(/\d+ of 15 sample starts fit a 2-hour session/);
 const closed=page.getByRole('button',{name:'10:00 PM Outside demo hours',exact:true});await expect(closed).toBeDisabled();
 expect(await closed.evaluate(el=>{el.focus();return el.hasAttribute('disabled')&&document.activeElement!==el;})).toBe(true);
 const reasonId=await closed.getAttribute('aria-describedby');await expect(page.locator(`#${reasonId}`)).toHaveText('Would end after the demo closing time');
 const maintenance=page.getByRole('button',{name:'11:00 AM Maintenance',exact:true});await expect(page.locator(`#${await maintenance.getAttribute('aria-describedby')}`)).toHaveText('Sample maintenance closure');
 const open=page.getByRole('button',{name:'8:00 AM Available',exact:true});await expect(page.locator(`#${await open.getAttribute('aria-describedby')}`)).toHaveText('Ends 10:00 AM');
 // Tabbing from the 8:00 AM slot skips unavailable buttons.
 await open.focus();await page.keyboard.press('Tab');const focused=await page.evaluate(()=>({disabled:document.activeElement.disabled,text:document.activeElement.textContent}));expect(focused.disabled).toBe(false);
 await closed.click({force:true}).catch(()=>{});await expect(page.getByRole('button',{name:'Review demo details'})).toBeDisabled();
});

test('3D.2: list view shows per-court availability counts as accessible descriptions; map view keeps names unchanged',async({page})=>{
 await page.goto('/book');const court5=page.getByRole('button',{name:'Court 5, Open play',exact:true});
 await expect(court5).toBeVisible();expect(await court5.evaluate(el=>document.getElementById(el.getAttribute('aria-describedby'))?.textContent)).toBe('0 of 15 sample starts');
 await expect(page.locator('.court-map .court-detail').first()).toBeAttached();
 await page.getByRole('button',{name:'List',exact:true}).click();
 await expect(page.locator('.court-list .court-detail').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Court 3, Available',exact:true}).locator('.court-detail')).toHaveText(/^\d+ of 15 sample starts$/);
 await page.getByLabel('Session duration').selectOption('180');await expect(page.getByRole('button',{name:'Court 3, Available',exact:true}).locator('.court-detail')).toHaveText(/^\d+ of 15 sample starts$/);
});

test('3D.2: the court group carries a text description of the approved layout on the booking page and homepage',async({page})=>{
 for(const route of ['/book','/']){
  await page.goto(route);const group=page.getByRole('group',{name:'Select a demo court'});await expect(group).toBeVisible();
  const description=await group.evaluate(el=>document.getElementById(el.getAttribute('aria-describedby'))?.textContent);
  expect(description).toContain('Courts 3, 4 and 5');expect(description).toContain('right edges line up with Court 5');
 }
});

test('3D.2: compact mobile summary stays current and never covers focused controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/book');
 const compact=page.getByRole('region',{name:'Compact sample session summary'});await expect(compact).toBeVisible();await expect(compact).toContainText('No start time yet');await expect(compact).toContainText('₱600');
 await page.getByLabel('Session duration').selectOption('120');await page.getByRole('button',{name:'8:00 AM Available',exact:true}).click();await expect(compact).toContainText('8:00 AM – 10:00 AM');await expect(compact).toContainText('₱1,200');
 const bar=await compact.boundingBox();
 // Focus scrolls (smoothly) with scroll-padding-bottom, so poll until the focused control sits above the bar.
 const bottomOf=locator=>locator.boundingBox().then(b=>b.y+b.height);
 for(const name of ['Review demo details']){await page.getByRole('button',{name}).focus();await expect.poll(()=>bottomOf(page.getByRole('button',{name}))).toBeLessThanOrEqual(bar.y+1);}
 await page.getByRole('button',{name:'Review demo details'}).click();await page.getByRole('checkbox').focus();await expect.poll(()=>bottomOf(page.getByRole('checkbox'))).toBeLessThanOrEqual(bar.y+1);
 await page.getByRole('button',{name:'Create demo preview'}).focus();await expect.poll(()=>bottomOf(page.getByRole('button',{name:'Create demo preview'}))).toBeLessThanOrEqual(bar.y+1);
 await compact.getByRole('link',{name:'Full summary'}).click();await expect(page.getByRole('complementary',{name:'Demo price summary'})).toBeInViewport();
 await page.setViewportSize({width:1440,height:1000});await expect(compact).toBeHidden();
});

test('3D.2: canonical sample-link parameters only',async({page})=>{
 for(const query of [sample.replace('duration=120','duration=0120'),sample.replace('players=4','players=04'),sample.replace('players=4','players=%2B4'),sample.replace('duration=120','duration=1e2')]){
  await page.goto('/booking/confirmation?'+query);await expect(page.getByRole('heading',{name:'Session preview unavailable'})).toBeVisible();
 }
 await page.goto('/booking/confirmation?'+sample);await expect(page.getByRole('heading',{name:'Your rally, imagined.'})).toBeVisible();
});

test('3D.2: confirmation and status pages explain themselves and show Manila times with machine-readable instants',async({page})=>{
 await page.goto('/booking/confirmation?'+sample);
 await expect(page.getByRole('listitem').filter({hasText:'Preview'})).toHaveAttribute('aria-current','step');
 await expect(page.getByText('This page is not',{exact:true})).toBeVisible();await expect(page.getByText('Nothing was saved or sent.',{exact:false})).toBeVisible();
 const created=page.locator('time[datetime="2026-11-03T00:00:00.000Z"]');await expect(created).toHaveText(/(3 Nov 2026|Nov 3, 2026),? 8:00\s?AM/i);
 await expect(page.locator('time[datetime="2026-11-03T02:00:00.000Z"]')).toHaveText(/10:00\s?AM/i);
 await expect(page.getByRole('heading',{name:'Sample receipt (fixed at creation)'})).toBeVisible();await expect(page.getByRole('heading',{name:/Current demo status/})).toBeVisible();
 await page.getByRole('link',{name:'View demo private status'}).click();await expect(page.getByRole('heading',{name:'Your private-status preview'})).toBeVisible();
 await page.getByLabel('Choose a demo status').selectOption('expired');await expect(page.locator('time[datetime="2026-11-03T02:01:00.000Z"]')).toBeVisible();
 await expect(page.locator('time[datetime="2026-11-03T02:00:00.000Z"]')).toHaveText(/10:00\s?AM/i); // receipt deadline unchanged
 await expect(page.getByRole('status')).toHaveCount(1);
});

test('3D.2: booking pages carry the booking demo notice and current navigation state; no artificial delay before the preview',async({page})=>{
 await page.goto('/book');await expect(page.locator('.demo-notice')).toContainText('Booking demonstration · Synthetic data only');
 await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Booking demo'})).toHaveAttribute('aria-current','page');
 await page.goto('/');await expect(page.locator('.demo-notice')).toContainText('A first look at Rally Grounds');await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Booking demo'})).not.toHaveAttribute('aria-current','page');
 await page.goto('/book');await toDetails(page);await page.getByRole('checkbox').check();const started=Date.now();await page.getByRole('button',{name:'Create demo preview'}).click();await expect(page.getByRole('heading',{name:'Your rally, imagined.'})).toBeVisible();expect(Date.now()-started).toBeLessThan(2500);
 await expect(page.locator('.demo-notice')).toContainText('Booking demonstration');
});

test('3D.2: keyboard-only journey at 390px from map to status page with visible focus at every stop',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/book');
 const outlineVisible=async()=>page.evaluate(()=>{const el=document.activeElement;const s=getComputedStyle(el);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;});
 // Keyboard only: no programmatic focus. Tab from the top of the page to the duration select, then on through the map and slots.
 const duration=page.getByLabel('Session duration');let guard=0;while(!(await duration.evaluate(el=>el===document.activeElement))&&guard++<40)await page.keyboard.press('Tab');
 expect(guard).toBeLessThan(40);expect(await outlineVisible()).toBe(true);await duration.selectOption('120');
 const court4=page.getByRole('button',{name:'Court 4, Available',exact:true});
 guard=0;while(!(await court4.evaluate(el=>el===document.activeElement))&&guard++<40)await page.keyboard.press('Tab');
 expect(guard).toBeLessThan(40);expect(await outlineVisible()).toBe(true);await page.keyboard.press('Enter');await expect(court4).toHaveAttribute('aria-pressed','true');
 const slot=page.getByRole('button',{name:'9:00 AM Available',exact:true});guard=0;while(!(await slot.evaluate(el=>el===document.activeElement))&&guard++<40)await page.keyboard.press('Tab');
 expect(guard).toBeLessThan(40);expect(await outlineVisible()).toBe(true);await page.keyboard.press('Enter');await expect(slot).toHaveAttribute('aria-pressed','true');
 const next=page.getByRole('button',{name:'Review demo details'});guard=0;while(!(await next.evaluate(el=>el===document.activeElement))&&guard++<40)await page.keyboard.press('Tab');
 expect(await outlineVisible()).toBe(true);await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Your crew, your session'})).toBeFocused();
 const submit=page.getByRole('button',{name:'Create demo preview'});guard=0;while(!(await submit.evaluate(el=>el===document.activeElement))&&guard++<40)await page.keyboard.press('Tab');
 await page.keyboard.press('Enter');await expect(page.getByRole('checkbox')).toBeFocused();expect(await outlineVisible()).toBe(true);await page.keyboard.press('Space');
 guard=0;while(!(await submit.evaluate(el=>el===document.activeElement))&&guard++<40)await page.keyboard.press('Tab');await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Your rally, imagined.'})).toBeVisible();
 const status=page.getByRole('link',{name:'View demo private status'});guard=0;while(!(await status.evaluate(el=>el===document.activeElement))&&guard++<60)await page.keyboard.press('Tab');
 expect(await outlineVisible()).toBe(true);await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Your private-status preview'})).toBeVisible();
 expect(serious(await new AxeBuilder({page}).withTags(wcag).analyze())).toEqual([]);
});

for(const width of [320,360,390,768,1440]){
 test(`3D.2: no horizontal overflow and grouped slots fit at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  for(const route of ['/book','/booking/confirmation?'+sample,'/booking/status?'+sample,'/booking/status','/booking/confirmation']){
   await page.goto(route);await expect(page.locator('main h1')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(route==='/book'){await page.getByLabel('Session duration').selectOption('180');await expect(page.getByRole('group',{name:'Evening'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const slotBoxes=await page.locator('.booking-slots .slot > button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));expect(Math.min(...slotBoxes)).toBeGreaterThanOrEqual(44);}
  }
 });
}
