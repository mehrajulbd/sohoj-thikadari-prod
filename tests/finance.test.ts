import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balance, allocateTax, analysis, round, staffStatement } from '../lib/finance';
import { emptyStore, type Row, type Store } from '../lib/types';
const row = (id: string, data: Row['data']): Row => ({
  id,
  data,
  org_id: 'org',
  version: 1,
  created_by: 'owner',
  created_at: '',
  updated_at: '',
});
test('staff advances span programs; general expense and staff transfers are counted once', () => {
  const s = emptyStore();
  s.money_movements = [
    row('1', { type: 'give', staff_id: 'a', amount: 100000, date: '2026-11-01' }),
    row('2', {
      type: 'transfer',
      staff_id: 'a',
      to_staff_id: 'b',
      amount: 3000,
      date: '2026-11-05',
    }),
  ];
  s.expenses = [
    row('e1', { staff_id: 'a', program_id: 'p1', amount: 50000, date: '2026-11-02' }),
    row('e2', { staff_id: 'a', program_id: 'p2', amount: 30000, date: '2026-11-03' }),
    row('e3', { staff_id: 'a', scope: 'organization', amount: 10000, date: '2026-11-04' }),
  ];
  assert.equal(balance(s, 'a'), 7000);
  assert.equal(balance(s, 'b'), 3000);
  assert.equal(staffStatement(s, 'a').at(-1)?.balance, 7000);
});
test('adjusted tax: 100000 + 5000 - 2000, less 2 percent = 100940', () => {
  const [r] = allocateTax([{ id: 'p', base: 103000 }], 'percent', 2);
  assert.equal(r.tax, 2060);
  assert.equal(r.net, 100940);
});
test('tax allocation reconciles exactly across programs with rounding', () => {
  const allocations = allocateTax(
    [
      { id: 'a', base: 100.05 },
      { id: 'b', base: 200.06 },
      { id: 'c', base: 300.07 },
    ],
    'percent',
    3,
  );
  assert.equal(round(allocations.reduce((n, a) => n + a.tax, 0)), 18.01);
  assert.equal(round(allocations.reduce((n, a) => n + a.net, 0)), 582.17);
});
test('transaction-date receipt and lifetime program modes differ; supplementary receipts use own date', () => {
  const s = emptyStore();
  s.programs = [row('p', { firm_id: 'f', date: '2026-10-01' })];
  s.expenses = [row('e', { program_id: 'p', firm_id: 'f', date: '2026-10-02', amount: 70000 })];
  s.settlements = [
    row('r', { firm_id: 'f', date: '2026-11-01', allocations: [{ program_id: 'p', net: 100940 }] }),
  ];
  s.supplementary_receipts = [
    row('x', { firm_id: 'f', program_id: 'p', date: '2026-12-01', amount: 4000 }),
  ];
  const f = {
    firm: '',
    program: '',
    staff: '',
    head: '',
    from: '2026-11-01',
    to: '2026-11-30',
    mode: 'transaction' as const,
  };
  assert.equal(analysis(s, f).profit, 100940);
  assert.equal(
    analysis(s, { ...f, from: '2026-10-01', to: '2026-10-31', mode: 'program' }).profit,
    34940,
  );
});
test('negative staff balances record own-pocket spending', () => {
  const s = emptyStore();
  s.expenses = [row('e', { staff_id: 'a', amount: 500, date: '2026-11-01' })];
  assert.equal(balance(s, 'a'), -500);
});

test('many small allocations never assign negative tax to the final program', async () => {
  const bases = Array.from({ length: 100 }, (_, i) => ({ id: String(i), base: 0.01 }));
  const r = allocateTax(bases, 'percent', 50);
  assert.equal(round(r.reduce((s, x) => s + x.tax, 0)), 0.5);
  assert.ok(r.every((x) => x.tax >= 0 && x.net >= 0));
});
test('Bangla local and international phone identifiers normalize to one account identifier', async () => {
  const { normalizePhone } = await import('../lib/phone');
  assert.equal(normalizePhone('০১৭১২৩৪৫৬৭৮'), '+8801712345678');
  assert.equal(normalizePhone('8801712345678'), '+8801712345678');
});
