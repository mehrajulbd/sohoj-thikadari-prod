import Decimal from 'decimal.js';
import { type Store, type Row, type Data, num, str } from './types';
const d = (x: unknown) => new Decimal(String(x || 0));
export const round = (x: unknown) => d(x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
export function billAmount(dispatches: Row[], rates: Record<string, number>) {
  return dispatches
    .reduce(
      (sum, r) => sum.plus(d(r.data.receiving_gross).mul(rates[str(r.data.program_id)] || 0)),
      new Decimal(0),
    )
    .toDecimalPlaces(2)
    .toNumber();
}
export function balance(store: Store, staffId: string, end = '9999-12-31') {
  let value = new Decimal(0);
  for (const r of store.money_movements.filter((r) => str(r.data.date) <= end)) {
    if (str(r.data.staff_id) === staffId)
      value = value.plus(
        ['return', 'transfer'].includes(str(r.data.type))
          ? d(r.data.amount).negated()
          : d(r.data.amount),
      );
    if (r.data.type === 'transfer' && r.data.to_staff_id === staffId)
      value = value.plus(d(r.data.amount));
  }
  for (const r of store.expenses.filter(
    (r) => r.data.staff_id === staffId && str(r.data.date) <= end,
  ))
    value = value.minus(d(r.data.amount));
  return value.toDecimalPlaces(2).toNumber();
}
export function stage(store: Store, program: Row) {
  if (program.data.closed) return 'closed' as const;
  const ds = store.dispatches.filter((d) => d.data.program_id === program.id);
  return !ds.length
    ? ('draft' as const)
    : ds.every((d) => d.data.receiving_date)
      ? ('received' as const)
      : ('sent' as const);
}
export interface Filters {
  firm: string;
  program: string;
  staff: string;
  head: string;
  from: string;
  to: string;
  mode: 'transaction' | 'program';
  status?: string;
}
export function analysis(store: Store, f: Filters) {
  const inDate = (v: unknown) => (!f.from || str(v) >= f.from) && (!f.to || str(v) <= f.to);
  const programs = store.programs.filter(
    (p) =>
      (!f.firm || p.data.firm_id === f.firm) &&
      (!f.program || p.id === f.program) &&
      (f.mode !== 'program' || inDate(p.data.date)) &&
      (!f.status || stage(store, p) === f.status),
  );
  const ids = new Set(programs.map((p) => p.id));
  const expenses = store.expenses.filter(
    (e) =>
      (!f.firm || e.data.firm_id === f.firm) &&
      (!f.program || e.data.program_id === f.program) &&
      (!f.staff || e.data.staff_id === f.staff) &&
      (!f.head || e.data.head_id === f.head) &&
      (!f.status || ids.has(str(e.data.program_id))) &&
      (f.mode === 'program' ? ids.has(str(e.data.program_id)) : inDate(e.data.date)),
  );
  const receipts = [...store.settlements, ...store.supplementary_receipts].filter(
    (r) => (!f.firm || r.data.firm_id === f.firm) && (f.mode === 'program' || inDate(r.data.date)),
  );
  let income = new Decimal(0);
  for (const r of receipts) {
    if (r.data.allocations && Array.isArray(r.data.allocations)) {
      for (const a of r.data.allocations as Record<string, unknown>[])
        if (ids.has(str(a.program_id))) income = income.plus(d(a.net));
    } else if (ids.has(str(r.data.program_id))) income = income.plus(d(r.data.amount));
  }
  const cost = expenses.reduce((s, e) => s.plus(d(e.data.amount)), new Decimal(0));
  return {
    programs,
    expenses,
    receipts,
    income: round(income),
    cost: round(cost),
    profit: round(income.minus(cost)),
    costOnly: !!(f.staff || f.head),
  };
}
export function apportion(items: { id: string; weight: number }[], total: number) {
  const weight = items.reduce((s, x) => s.plus(d(x.weight)), new Decimal(0));
  if (weight.lt(0) || items.some((x) => x.weight < 0))
    throw new Error('Allocation amounts cannot be negative');
  if (weight.isZero()) {
    if (total !== 0) throw new Error('Cannot allocate to zero amounts');
    return items.map((x) => ({ id: x.id, amount: 0 }));
  }
  const values = items.map((x) => ({
    id: x.id,
    amount: d(total).mul(x.weight).div(weight).toDecimalPlaces(2, Decimal.ROUND_DOWN),
  }));
  let cents = d(total)
    .minus(values.reduce((s, x) => s.plus(x.amount), new Decimal(0)))
    .mul(100)
    .toDecimalPlaces(0)
    .toNumber();
  for (let i = 0; i < values.length && cents > 0; i++)
    if (items[i].weight > 0) {
      values[i].amount = values[i].amount.plus(0.01);
      cents--;
    }
  return values.map((x) => ({ id: x.id, amount: x.amount.toNumber() }));
}
export function programBillTotals(bill: Data) {
  if (Array.isArray(bill.program_totals))
    return (bill.program_totals as Data[]).map((x) => ({
      id: str(x.program_id),
      amount: num(x.amount),
    }));
  const ids = bill.program_ids as string[];
  const lines = (bill.lines || []) as Data[];
  const items = ids.map((id) => ({
    id,
    weight: lines
      .filter((l) => l.program_id === id)
      .reduce((s, l) => s.plus(d(l.amount)), new Decimal(0))
      .toNumber(),
  }));
  return apportion(items, round(items.reduce((s, x) => s.plus(x.weight), new Decimal(0))));
}
export function allocateTax(bases: { id: string; base: number }[], mode: string, value: number) {
  const base = bases.reduce((s, x) => s.plus(d(x.base)), new Decimal(0));
  if (base.lte(0)) throw new Error('Adjusted bill amount must be positive');
  if (bases.some((x) => x.base < 0)) throw new Error('Deductions exceed the program amount');
  const total =
    mode === 'percent' ? base.mul(value).div(100).toDecimalPlaces(2) : d(value).toDecimalPlaces(2);
  if (total.lt(0) || total.gt(base))
    throw new Error('Tax must be between zero and adjusted bill amount');
  const taxes = apportion(
    bases.map((x) => ({ id: x.id, weight: x.base })),
    total.toNumber(),
  );
  return bases.map((x) => {
    const tax = taxes.find((t) => t.id === x.id)!.amount;
    return { program_id: x.id, base: x.base, tax, net: round(d(x.base).minus(tax)) };
  });
}
export function staffStatement(store: Store, id: string) {
  const rows: {
    date: string;
    description: string;
    in: number;
    out: number;
    balance: number;
    order: string;
    movement_id?: string;
  }[] = [];
  for (const r of store.money_movements) {
    if (r.data.staff_id === id)
      rows.push({
        date: str(r.data.date),
        description: str(r.data.reason) || str(r.data.type),
        in: ['give', 'opening'].includes(str(r.data.type)) ? num(r.data.amount) : 0,
        out: ['return', 'transfer'].includes(str(r.data.type)) ? num(r.data.amount) : 0,
        balance: 0,
        order: r.created_at + r.id,
        movement_id: r.id,
      });
    if (r.data.type === 'transfer' && r.data.to_staff_id === id)
      rows.push({
        date: str(r.data.date),
        description: str(r.data.reason) || 'Transfer received',
        in: num(r.data.amount),
        out: 0,
        balance: 0,
        order: r.created_at + r.id,
        movement_id: r.id,
      });
  }
  for (const r of store.expenses.filter((r) => r.data.staff_id === id))
    rows.push({
      date: str(r.data.date),
      description: str(r.data.reason),
      in: 0,
      out: num(r.data.amount),
      balance: 0,
      order: r.created_at + r.id,
    });
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));
  let value = new Decimal(0);
  for (const r of rows) {
    value = value.plus(r.in).minus(r.out);
    r.balance = round(value);
  }
  return rows;
}
