// Generates the three synthetic Phase 4A sample receipt images (PNG, JPEG, WebP).
// Every value is fictional and each image carries a conspicuous SAMPLE / NOT A REAL PAYMENT mark.
// Run from the repository root: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... node scripts/generate-sample-receipts.mjs
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const html = (title, amount, ref, colour) => `<!doctype html><html><body style="margin:0;width:390px;height:620px;font-family:Arial,sans-serif;background:#fff;color:#111">
<div style="background:${colour};color:#fff;padding:22px 20px"><div style="font-size:13px;letter-spacing:2px">${title}</div><div style="font-size:28px;font-weight:700;margin-top:6px">Sample transfer</div></div>
<div style="padding:20px"><div style="font-size:13px;color:#666">Amount (fictional)</div><div style="font-size:40px;font-weight:700">${amount}</div>
<div style="margin-top:18px;font-size:13px;color:#666">Reference (fictional)</div><div style="font-size:18px;font-weight:600">${ref}</div>
<div style="margin-top:18px;font-size:13px;color:#666">Recipient</div><div style="font-size:16px">DEMO ONLY — NO REAL TRANSFER</div>
<div style="margin-top:18px;font-size:13px;color:#666">Date</div><div style="font-size:16px">Nov 3, 2026 8:40 AM (sample)</div></div>
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none"><div style="transform:rotate(-24deg);border:6px solid #c0392b;color:#c0392b;font-weight:900;font-size:34px;padding:12px 18px;text-align:center;background:rgba(255,255,255,.75)">SAMPLE<br>NOT A REAL PAYMENT</div></div>
<div style="position:absolute;bottom:0;left:0;right:0;background:#111;color:#fff;font-size:12px;padding:10px 20px;text-align:center">Synthetic image for the Rally Grounds demo · No real account, phone number or QR code</div>
</body></html>`;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
const page = await browser.newPage({ viewport: { width: 390, height: 620 } });
await page.setContent(html('GCASH · SAMPLE', '₱600.00', 'SAMPLE-GC-0002', '#1a4fb8'));
await page.screenshot({ path: 'public/images/receipts/sample-gcash-receipt.png', type: 'png' });
await page.setContent(html('BANK TRANSFER · SAMPLE', '₱1,200.00', 'SAMPLE-BK-0003', '#102B50'));
await page.screenshot({ path: 'public/images/receipts/sample-bank-receipt.jpg', type: 'jpeg', quality: 85 });
await page.setContent(html('RECEIPT · SAMPLE', '₱600.00', 'SAMPLE-GC-0004', '#2d624c'));
const dataUrl = await page.evaluate(async () => {
  const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 620;
  // Rasterise the document via SVG foreignObject so the canvas can export WebP.
  const xml = new XMLSerializer().serializeToString(document.documentElement);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="620"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await new Promise((r, j) => { img.onload = r; img.onerror = j; });
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/webp', 0.85);
});
await writeFile('public/images/receipts/sample-receipt.webp', Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
