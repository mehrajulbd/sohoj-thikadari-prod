import { chromium, expect } from '@playwright/test';
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
      program_number: '১২৪/২০২৬',
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
  console.log(
    'Exported 120-row Bangla bill and Excel with long names, dates, leading-zero invoice numbers and a program subtotal.',
  );
} finally {
  await browser.close();
}
