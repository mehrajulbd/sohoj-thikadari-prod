import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const base = process.env.APP_URL || 'http://localhost:3000';
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page.getByRole('button', { name: 'নমুনা অ্যাপ দেখুন' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'নমুনা অ্যাপ দেখুন' }).click();
  await page.getByRole('heading', { name: /স্বাগতম/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '/private/tmp/sohoz-dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'English', exact: true }).click();
  // Create a complete program and dispatch on a real form.
  await page.getByRole('button', { name: 'New program', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Program number').fill('QA-30T');
  await dialog.getByLabel('Commodity').selectOption('গম');
  await dialog.getByLabel('Sending center').fill('Chattogram silo');
  await dialog.getByLabel('Receiving center').fill('Cumilla LSD');
  await dialog.getByLabel('Instructed quantity (tonnes)').fill('30');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto(base + '/?view=programs');
  await page.getByRole('link').filter({ hasText: 'QA-30T' }).click();
  await page.getByRole('button', { name: 'Add truck / dispatch' }).click();
  await dialog.getByLabel('Invoice number').fill('QA-INV-1');
  await dialog.getByLabel('Truck number').fill('QA Truck 1');
  await dialog.getByLabel('Net bag count').fill('300');
  await dialog.getByLabel('Net weight (tonnes)').fill('15');
  await dialog.getByLabel('Gross weight (tonnes)').fill('15.03');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Add receiving details', exact: true }).click();
  await dialog.getByLabel('Receiving date').fill('2026-11-19');
  await dialog.getByLabel('Received net bags').fill('299');
  await dialog.getByLabel('Received gross bags').fill('298');
  await dialog.getByLabel('Received net weight (tonnes)').fill('14.99');
  await dialog.getByLabel('Received gross weight (tonnes)').fill('15.02');
  await dialog.getByLabel('Shortage (tonnes)').fill('0');
  await dialog.getByLabel('Reason for correction').fill('Received and weighed');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  // Every app view renders without runtime errors.
  for (const view of [
    'home',
    'programs',
    'accounts',
    'firms',
    'staff',
    'expense_heads',
    'expenses',
    'money',
    'bills',
    'reports',
    'register',
    'settings',
    'history',
    'more',
  ]) {
    await page.goto(base + '/?view=' + view);
    await page.locator('main h1').waitFor();
    await expect(page.locator('main')).not.toContainText('তথ্য দেখাতে সমস্যা হয়েছে');
  }
  // Build and issue a grouped bill, then record adjusted tax and payment.
  await page.goto(base + '/?view=bills');
  await page.getByRole('button', { name: 'Create bill', exact: true }).click();
  await dialog.getByLabel('Bill number').fill('QA-BILL-1');
  await dialog.getByLabel('Submitted to').fill('CMS Office');
  await dialog.getByLabel('Save as').selectOption('finalized');
  const programChoice = dialog.locator('.bill-program').filter({ hasText: 'QA-30T' });
  await programChoice.getByRole('checkbox').check();
  await programChoice.getByLabel('Rate per tonne (৳)').fill('10000');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  const bill = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'QA-BILL-1', exact: true }) });
  await bill.getByRole('button', { name: 'Record bill receipt' }).click();
  await dialog.getByLabel('Tax percentage / amount').fill('2');
  await dialog.getByLabel('Net money received').fill('147196');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(bill).toContainText('Money received');
  // Download three formats from a finalized bill.
  for (const format of ['CSV', 'XLSX', 'PDF']) {
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await bill.getByRole('button', { name: format, exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs('/private/tmp/sohoz-export.' + format.toLowerCase());
    const stat = await fs.stat('/private/tmp/sohoz-export.' + format.toLowerCase());
    if (stat.size < 100) throw new Error(format + ' empty');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/?view=home');
  await page.locator('main h1').waitFor();
  await page.screenshot({ path: '/private/tmp/sohoz-dashboard-mobile.png', fullPage: true });
  for (const view of [
    'home',
    'programs',
    'accounts',
    'staff',
    'expenses',
    'bills',
    'reports',
    'settings',
  ]) {
    await page.goto(base + '/?view=' + view);
    await page.locator('main h1').waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    );
    if (overflow) throw new Error('Horizontal page overflow: ' + view);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(base + '/?view=home');
  await page.locator('main h1').waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2))
    throw new Error('360px overflow');
  if (process.env.CHECK_OFFLINE === '1') {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.locator('main h1').waitFor();
    await page.waitForFunction(async () => {
      const names = await caches.keys();
      if (!names.length) return false;
      const cache = await caches.open(names[0]);
      return (await cache.keys()).length > 8;
    });
    await context.setOffline(true);
    await page.reload();
    await page.locator('main h1').waitFor();
    await page.getByRole('button', { name: 'New program', exact: true }).click();
    const offlineForm = page.getByRole('dialog');
    await offlineForm.getByLabel('Program number').fill('OFFLINE-RECOVERED');
    await offlineForm.getByLabel('Commodity').selectOption('গম');
    await offlineForm.getByLabel('Sending center').fill('Offline sender');
    await offlineForm.getByLabel('Receiving center').fill('Offline receiver');
    await offlineForm.getByLabel('Instructed quantity (tonnes)').fill('30');
    await offlineForm.getByRole('button', { name: 'Save changes' }).click();
    await expect(offlineForm).not.toBeVisible();
    await page.reload();
    await page.locator('main h1').waitFor();
    await expect(page.locator('main')).toContainText('OFFLINE-RECOVERED');
    await context.setOffline(false);
  }
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        runtimeErrors: errors,
        flows: [
          'program creation',
          'dispatch',
          'distinct receiving fields',
          'all 14 views',
          'bill issue',
          'tax settlement',
          'PDF/CSV/Excel downloads',
          '390px mobile layout',
        ],
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
