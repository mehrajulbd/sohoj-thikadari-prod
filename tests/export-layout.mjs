import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Requires Poppler (pdftohtml) on PATH.
// Check both text and shaped Bangla images against every PDF page's bounds.
function checkPdf(file, expectedInvoices) {
  const temp = mkdtempSync(join(tmpdir(), 'sohoz-pdf-'));
  try {
    const xml = execFileSync(
      'pdftohtml',
      ['-xml', '-hidden', '-stdout', file, join(temp, 'page')],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
    );
    const pages = [...xml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)];
    expect(pages.length).toBeGreaterThan(1);
    const attrs = (s) =>
      Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], Number(m[2])]));
    for (const [, pageAttrs, body] of pages) {
      const bounds = attrs(pageAttrs);
      expect(bounds.width).toBe(1512); // Legal landscape, at Poppler's 150% scale.
      const items = [...body.matchAll(/<(?:text|image)\b([^>]*)>/g)];
      expect(items.length).toBeGreaterThan(0);
      for (const [, itemAttrs] of items) {
        const item = attrs(itemAttrs);
        expect(item.left).toBeGreaterThanOrEqual(40);
        expect(item.left + item.width).toBeLessThanOrEqual(bounds.width - 40);
        expect(item.top).toBeGreaterThanOrEqual(40);
        expect(item.top + item.height).toBeLessThanOrEqual(bounds.height - 10);
      }
      expect(body).toContain('<image'); // Bangla header repeats on continuation pages.
    }
    const tokens = new Set(
      [...xml.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].flatMap((m) => m[1].split(/\s+/)),
    );
    for (const invoice of expectedInvoices)
      expect(tokens.has(invoice), `Missing invoice ${invoice} in ${file}`).toBe(true);
    return pages.length;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
const base = process.env.APP_URL || 'http://localhost:3000';
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
try {
  await page.goto(base);
  await page.getByRole('button', { name: 'নমুনা অ্যাপ দেখুন' }).click();
  await page.locator('main h1').waitFor();
  await page.waitForFunction(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('sohoz-workspace-v1', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    return await new Promise((res) => {
      const r = db
        .transaction('private')
        .objectStore('private')
        .get('demo-owner:demo-organization');
      r.onsuccess = () => res(!!r.result);
    });
  });
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('sohoz-workspace-v1', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const cached = await new Promise((res) => {
      const r = db
        .transaction('private')
        .objectStore('private')
        .get('demo-owner:demo-organization');
      r.onsuccess = () => res(r.result);
    });
    const lines = Array.from({ length: 120 }, (_, i) => ({
      program_id: 'demo-program-0',
      program_number: i === 0 ? 'চট্ট/৭২/২০২৬-২৭/দীর্ঘপ্রোগ্রামনম্বর১২৩৪৫৬৭৮৯' : '১২৪/২০২৬',
      program_date: '2026-11-19',
      invoice_no: String(i + 1).padStart(5, '0'),
      sending_date: '2026-11-19',
      sending: 'চট্টগ্রাম খাদ্য সংরক্ষণ কেন্দ্র',
      receiving: 'কুমিল্লা স্থানীয় খাদ্য সংরক্ষণ কেন্দ্র',
      commodity: 'গম',
      sending_bags: 300,
      sending_net: 15,
      sending_gross: 15.03,
      receiving_bags: 299,
      receiving_net: 14.99,
      receiving_gross: 15.02,
      shortage: 0.01,
      distance: 110,
      rate: 100,
      amount: 1502,
    }));
    const program = cached.store.programs.find((p) => p.id === 'demo-program-0');
    program.data.number = 'চট্ট/৭২/২০২৬-২৭/দীর্ঘপ্রোগ্রামনম্বর১২৩৪৫৬৭৮৯';
    program.data.sending = 'চট্টগ্রাম খাদ্য সংরক্ষণ কেন্দ্র';
    program.data.receiving = 'কুমিল্লা স্থানীয় খাদ্য সংরক্ষণ কেন্দ্র';
    cached.store.dispatches = lines.map((line, i) => ({
      ...cached.store.dispatches[0],
      id: 'stress-dispatch-' + i,
      data: { ...line, receiving_date: '2026-11-20', truck_no: 'চট্ট-মেট্রো-ট-১২-১২৩৪' },
    }));
    cached.store.bills = [
      {
        id: 'stress-bill',
        org_id: 'demo-organization',
        version: 1,
        created_by: 'demo-owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        data: {
          firm_id: 'demo-firm-1',
          number: 'দীর্ঘ বিল ১২৩/২০২৬',
          date: '2026-11-19',
          recipient: 'চলাচল ও সংরক্ষণ নিয়ন্ত্রক, চট্টগ্রাম',
          program_ids: ['demo-program-0'],
          status: 'finalized',
          lines,
          program_totals: [{ program_id: 'demo-program-0', amount: 180240 }],
          total: 180240,
          govt_number: 'সরকারি/চট্ট/১২৩৪৫৬৭৮৯/২০২৬-২৭',
          govt_date: '2026-11-21',
          firm_snapshot: [cached.store.firms[0].data],
        },
      },
    ];
    await new Promise((res, rej) => {
      const tx = db.transaction('private', 'readwrite');
      tx.objectStore('private').put(cached, 'demo-owner:demo-organization');
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  });
  await page.reload();
  await page.locator('main h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '/private/tmp/sohoz-final-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/private/tmp/sohoz-final-mobile.png', fullPage: false });
  await page.goto(base + '/?view=bills');
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'দীর্ঘ বিল ১২৩/২০২৬', exact: true }) });
  for (const format of ['PDF', 'XLSX']) {
    const downloadEvent = page.waitForEvent('download', { timeout: 60000 });
    await section.getByRole('button', { name: format, exact: true }).click();
    const download = await downloadEvent;
    await download.saveAs('/private/tmp/sohoz-stress.' + format.toLowerCase());
  }
  const invoices = Array.from({ length: 120 }, (_, i) => String(i + 1).padStart(5, '0'));
  const billPages = checkPdf('/private/tmp/sohoz-stress.pdf', invoices);
  await page.goto(base + '/?view=register');
  const registerDownload = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await (await registerDownload).saveAs('/private/tmp/sohoz-register.pdf');
  const registerPages = checkPdf('/private/tmp/sohoz-register.pdf', invoices);
  console.log(
    `Verified all 120 invoices and page bounds in bill (${billPages} pages) and register (${registerPages} pages), including Bangla images, long references and final columns. Also exported XLSX.`,
  );
} finally {
  await browser.close();
}
