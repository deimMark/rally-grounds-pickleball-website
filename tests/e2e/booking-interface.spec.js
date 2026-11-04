import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const sample='day=2026-11-07&court=court-3&start=08%3A00&duration=120&players=4';
async function chooseSession(page){await page.getByLabel('Session duration').selectOption('120');await page.getByRole('button',{name:'8:00 AM Available',exact:true}).click();await page.getByRole('button',{name:'Review demo details'}).click();}

test('mobile guest preview completes with synthetic details and no mutation, storage or booking API request',async({page})=>{
 await page.setViewportSize({width:390,height:844});const mutations=[],api=[];
 page.on('request',r=>{if(r.method()!=='GET')mutations.push(r.url());if(/\/api\/|supabase/.test(r.url()))api.push(r.url());});
 await page.goto('/book');await expect(page.getByRole('button',{name:'Review demo details'})).toBeDisabled();await chooseSession(page);
 await expect(page.getByRole('heading',{name:'Your crew, your session'})).toBeFocused();
 await page.getByLabel('Synthetic guest profile').selectOption('jamie');await expect(page.getByLabel('Guest name')).toHaveValue('Jamie Demo');await expect(page.getByLabel('Demo email')).toHaveAttribute('readonly','');
 const submit=page.getByRole('button',{name:'Create demo preview'});await expect(submit).toBeDisabled();await page.getByRole('checkbox').check();await submit.click();
 await expect(page).toHaveURL(/\/booking\/confirmation\?/);await expect(page.getByRole('heading',{name:'Your rally, imagined.'})).toBeVisible();await expect(page.getByText('Your demo confirmation is ready. No court has been reserved.')).toBeVisible();await expect(page.getByText('₱1,200',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'View demo private status'}).click();await expect(page.getByRole('heading',{name:'Your private-status preview'})).toBeVisible();await page.getByLabel('Choose a demo status').selectOption('expired');await expect(page.getByRole('status')).toContainText('An expired hold');await expect(page.getByText('Unpaid hold (demo)',{exact:true})).toBeVisible();await page.getByLabel('Choose a demo status').selectOption('cancelled');await expect(page.getByRole('status')).toContainText('remain cancelled');
 expect(mutations).toEqual([]);expect(api).toEqual([]);expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
});

test('duration/day/court changes invalidate selection and availability respects open play, maintenance and closing',async({page})=>{
 await page.goto('/book');const next=page.getByRole('button',{name:'Review demo details'});await page.getByRole('button',{name:'8:00 AM Available',exact:true}).click();await expect(next).toBeEnabled();await page.getByLabel('Session duration').selectOption('120');await expect(next).toBeDisabled();await expect(page.getByRole('button',{name:'11:00 AM Maintenance',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'10:00 PM Outside demo hours',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Court 5, Open play',exact:true}).click();await expect(page.getByText('No sample sessions match.',{exact:false})).toBeVisible();await expect(next).toBeDisabled();
 await page.getByRole('button',{name:'List',exact:true}).click();await page.getByRole('button',{name:'Court 2, Available',exact:true}).click();await page.getByLabel('Demo date').selectOption('2026-11-08');await expect(next).toBeDisabled();await expect(page.getByText('No sample sessions match.',{exact:false})).toBeVisible();
});

test('keyboard court selection and back navigation preserve a consistent price/session',async({page})=>{
 await page.goto('/book');const court=page.getByRole('button',{name:'Court 4, Available',exact:true});await court.focus();await page.keyboard.press('Enter');await expect(court).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'9:00 AM Available',exact:true}).click();await page.getByRole('button',{name:'Review demo details'}).click();await expect(page.getByRole('complementary',{name:'Demo price summary'})).toContainText('Court 4');await page.getByRole('button',{name:'Change session'}).click();await expect(page.getByRole('button',{name:'9:00 AM Available',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('complementary',{name:'Demo price summary'})).toContainText('₱600');
});

test('direct references and malformed sample URLs never authorize a booking',async({page})=>{
 await page.goto('/booking/status?reference=RG-DEMO-001');await expect(page.getByRole('heading',{name:'Private access required'})).toBeVisible();await page.goto('/booking/confirmation?'+sample+'&duration=60');await expect(page.getByRole('heading',{name:'Session preview unavailable'})).toBeVisible();await page.goto('/booking/confirmation?'+sample.replace('start=08%3A00','start=12%3A00'));await expect(page.getByRole('heading',{name:'Session preview unavailable'})).toBeVisible();
});

for(const width of [320,390,768,1440]){
 test(`booking screens fit ${width}px and preserve approved court proportions`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.goto('/book');await expect(page.getByRole('heading',{name:'Find your next rally.'})).toBeVisible();await expect(page.locator('.court-map')).toBeVisible();const box=async n=>page.getByRole('button',{name:new RegExp(`^Court ${n},`)}).boundingBox();const a=await box(3),b=await box(4),c=await box(5),d=await box(2),e=await box(1);
  expect(a.height/a.width).toBeCloseTo(44/20,1);expect(d.width/d.height).toBeCloseTo(44/20,1);expect(Math.abs(d.x+d.width-c.x-c.width)).toBeLessThanOrEqual(1);expect(Math.abs(e.x-d.x)).toBeLessThanOrEqual(1);expect(a.x).toBeLessThan(b.x);expect(b.x).toBeLessThan(c.x);expect(e.y).toBeGreaterThan(d.y);
  for(const route of ['/book','/booking/confirmation?'+sample,'/booking/status?'+sample,'/booking/status']){await page.goto(route);await expect(page.locator('main h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 });
}

for(const route of ['/book','/booking/confirmation?'+sample,'/booking/status?'+sample,'/booking/status']){
 test(`booking accessibility and privacy headers: ${route}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});const response=await page.goto(route);
  if(route.startsWith('/booking/')){expect(response.headers()['referrer-policy']).toBe('no-referrer');expect(response.headers()['cache-control']).toContain('no-store');}
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(results.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
  if(route==='/book'){await chooseSession(page);const form=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(form.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);}
 });
}
