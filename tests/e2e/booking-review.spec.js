import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const sample='day=2026-11-07&court=court-3&start=08%3A00&duration=120&players=4';
async function details(page){await page.getByLabel('Session duration').selectOption('120');await page.getByRole('button',{name:'8:00 AM Available',exact:true}).click();await page.getByRole('button',{name:'Review demo details'}).click();await expect(page.getByRole('heading',{name:'Your crew, your session'})).toBeFocused();}

test('review: direct valid links, refresh and client navigation preserve synthetic identity and recompute prices',async({page})=>{
 await page.goto('/booking/confirmation?'+sample+'&totalCentavos=1&paid=true&status=confirmed');
 await expect(page.getByText('₱1,200',{exact:true})).toBeVisible();await expect(page.getByText('Unpaid hold (demo)',{exact:true})).toBeVisible();await expect(page.getByText('No court has been reserved.',{exact:false})).toBeVisible();
 const reference=await page.locator('.booking-receipt dd').first().textContent();await page.reload();await expect(page.locator('.booking-receipt dd').first()).toHaveText(reference);
 await page.getByRole('link',{name:'View demo private status'}).click();await page.getByLabel('Choose a demo status').selectOption('cancelled');await expect(page.getByRole('status')).toContainText('remain cancelled');await page.reload();
 await expect(page.getByLabel('Choose a demo status')).toHaveValue('held');await expect(page.getByText('DEMONSTRATION ONLY',{exact:true})).toBeVisible();await expect(page.getByText('₱1,200',{exact:true})).toBeVisible();
});

test('review: browser back/forward does not leave the demo form permanently busy or create mutations',async({page})=>{
 const mutations=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))mutations.push(r.method());});
 await page.goto('/book');await details(page);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create demo preview'}).click();await expect(page.getByRole('heading',{name:'Your rally, imagined.'})).toBeVisible();
 await page.getByRole('link',{name:'View demo private status'}).click();await expect(page.getByRole('heading',{name:'Your private-status preview'})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'Your rally, imagined.'})).toBeVisible();
 await page.goBack();await expect(page.getByRole('heading',{name:'Find your next rally.'})).toBeVisible();
 if(await page.getByRole('heading',{name:'Your crew, your session'}).isVisible())await expect(page.getByRole('button',{name:'Create demo preview'})).toBeEnabled();
 else await expect(page.getByRole('button',{name:'Review demo details'})).toBeDisabled();
 await page.goForward();await expect(page.getByRole('heading',{name:'Your rally, imagined.'})).toBeVisible();expect(mutations).toEqual([]);
});

test('review: readonly contacts are not editable, transmitted, stored, or written to browser logs',async({page,context})=>{
 const outbound=[],messages=[];page.on('request',r=>outbound.push({url:r.url(),body:r.postData()||'',method:r.method()}));page.on('console',m=>messages.push(m.text()));page.on('pageerror',m=>messages.push(m.message));
 await page.goto('/book');await details(page);await page.getByLabel('Synthetic guest profile').selectOption('jamie');
 for(const field of ['Guest name','Demo email'])expect(await page.getByLabel(field).isEditable()).toBe(false);
 await page.getByLabel('Demo email').pressSequentially('review-probe@example.invalid');await expect(page.getByLabel('Demo email')).toHaveValue('jamie@example.invalid');
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create demo preview'}).click();await expect(page.getByRole('heading',{name:'Your rally, imagined.'})).toBeVisible();
 const contactText=/example\.invalid|Alex(?:%20|\+| )Demo|Jamie(?:%20|\+| )Demo/i;
 expect(outbound.some(r=>contactText.test(r.url+' '+r.body))).toBe(false);expect(outbound.some(r=>/\/api\/|supabase|gcash/i.test(r.url))).toBe(false);expect(outbound.every(r=>['GET','HEAD'].includes(r.method))).toBe(true);expect(messages.some(m=>contactText.test(m))).toBe(false);
 expect(await context.cookies()).toEqual([]);expect(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,indexed:(await indexedDB.databases()).length,caches:(await caches.keys()).length}))).toEqual({local:0,session:0,indexed:0,caches:0});
});

test('review: invalid, repeated and unavailable selections have accessible safe empty states with no reflected payload',async({page})=>{
 const invalid=[sample.replace('day=2026-11-07','day=2026-99-99'),sample.replace('court=court-3','court=%3Cscript%3Ereview-probe%3C%2Fscript%3E'),sample.replace('duration=120','duration=90'),sample+'&players=2',sample.replace('players=4','players=0'),sample.replace('court=court-3','court=court-5'),sample.replace('start=08%3A00','start=22%3A00')];
 for(const query of invalid){await page.goto('/booking/confirmation?'+query);await expect(page.getByRole('heading',{name:'Session preview unavailable'})).toBeVisible();await expect(page.getByRole('link',{name:'Explore the booking demo'})).toBeVisible();await expect(page.getByText('No customer record was searched or retrieved.',{exact:false})).toBeVisible();await expect(page.locator('main')).not.toContainText('review-probe');}
 await page.goto('/booking/status?reference=00000000-0000-4000-8000-000000000300');await expect(page.getByRole('heading',{name:'Private access required'})).toBeVisible();
});

test('review: all court dimensions, gaps and right edges remain stable under selection at five viewport widths',async({page})=>{
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('/book');await expect(page.getByRole('heading',{name:'Find your next rally.'})).toBeVisible();const court=n=>page.getByRole('button',{name:new RegExp(`^Court ${n},`)});const box=async n=>{const b=await court(n).boundingBox();const scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}));return {...b,x:b.x+scroll.x,y:b.y+scroll.y};};const a=await box(3),b=await box(4),c=await box(5),d=await box(2),e=await box(1);const close=(x,y)=>expect(Math.abs(x-y)).toBeLessThanOrEqual(1);
  for(const top of [b,c]){close(a.width,top.width);close(a.height,top.height);close(a.y,top.y);}close(b.x-a.x-a.width,c.x-b.x-b.width);close(d.width,a.height);close(d.height,a.width);close(d.width,e.width);close(d.height,e.height);close(d.x,e.x);for(const bottom of [d,e])close(bottom.x+bottom.width,c.x+c.width);
  await court(2).click();const selected=await box(2);for(const key of ['x','y','width','height'])close(selected[key],d[key]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('review: keyboard focus is visible, form progression is focused, and desktop result/error designs pass accessibility checks',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/book');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to main content'})).toBeFocused();const court=page.getByRole('button',{name:'Court 3, Available',exact:true});await court.focus();await expect(court).toBeFocused();expect(await court.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');await page.keyboard.press('Enter');await details(page);
 const label=page.locator('.booking-consent');expect((await label.boundingBox()).height).toBeGreaterThanOrEqual(44);await page.getByRole('checkbox').focus();await page.keyboard.press('Space');await expect(page.getByRole('button',{name:'Create demo preview'})).toBeEnabled();
 for(const route of ['/booking/confirmation?'+sample,'/booking/status?'+sample,'/booking/confirmation','/booking/status']){await page.goto(route);await expect(page.locator('main h1')).toBeVisible();const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);}
});
