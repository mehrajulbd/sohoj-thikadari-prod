import {
  type Data,
  type Kind,
  type Store,
  type Row,
  type Workspace,
  emptyStore,
  today,
  uid,
  str,
  num,
} from './types';
import { allocateTax, round, programBillTotals } from './finance';
export const demoWorkspace: Workspace = {
  org_id: 'demo-organization',
  user_id: 'demo-owner',
  role: 'owner',
  staff_id: null,
  name: 'মেহরাজুল ইসলাম',
  email: 'demo@localhost',
};
export function seedDemo(): Store {
  const s = emptyStore();
  const row = (kind: Kind, id: string, data: Data) => {
    s[kind].push({
      id,
      org_id: demoWorkspace.org_id,
      data,
      version: 1,
      created_by: 'demo-owner',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return id;
  };
  const f1 = row('firms', 'demo-firm-1', {
    name: 'মেসার্স বলাকা ওভারসীজ',
    proprietor: 'মেহরাজুল ইসলাম',
    address: 'চট্টগ্রাম',
    phone: '',
    reg_no: '২৬১',
    active: true,
  });
  row('firms', 'demo-firm-2', {
    name: 'মেসার্স পূর্বাশা ট্রেডার্স',
    address: 'ঢাকা',
    reg_no: '৪১২',
    active: true,
  });
  const staff = row('staff', 'demo-staff-1', {
    name: 'মো. রফিকুল ইসলাম',
    phone: '',
    email: '',
    active: true,
  });
  row('staff', 'demo-staff-2', { name: 'মো. আব্দুল করিম', phone: '', email: '', active: true });
  ['ট্রাক ভাড়া', 'যাতায়াত', 'খাবার', 'লোড / আনলোড', 'অফিস খরচ'].forEach((name, i) =>
    row('expense_heads', 'demo-head-' + i, { name, active: true }),
  );
  const data = [
    ['১২৪/২০২৬', 'চট্টগ্রাম সাইলো', 'কুমিল্লা এলএসডি', 'গম', 30],
    ['১২৫/২০২৬', 'হালিশহর সিএসডি', 'ফেনী এলএসডি', 'চাল', 45],
    ['১২৬/২০২৬', 'নারায়ণগঞ্জ সাইলো', 'মিরসরাই এলএসডি', 'গম', 30],
    ['১২৭/২০২৬', 'চট্টগ্রাম সাইলো', 'নোয়াখালী এলএসডি', 'চাল', 60],
  ];
  data.forEach(([no, from, to, commodity, quantity], i) => {
    const id = row('programs', 'demo-program-' + i, {
      firm_id: f1,
      number: str(no),
      date: today(),
      commodity: str(commodity),
      sending: str(from),
      receiving: str(to),
      quantity: num(quantity),
      staff_id: staff,
      closed: false,
    });
    if (i < 3)
      row('dispatches', 'demo-dispatch-' + i, {
        program_id: id,
        invoice_no: '৩৭০৬৯৫' + i,
        truck_no: 'চট্ট মেট্রো ট ১১-১২৩' + i,
        sending_date: today(),
        sending_bags: 300,
        sending_net: 15,
        sending_gross: 15.03,
        ...(i === 2
          ? {}
          : {
              receiving_date: today(),
              receiving_bags: 300,
              receiving_gross_bags: 300,
              receiving_net: 14.99,
              receiving_gross: 15.02,
              shortage: 0.01,
            }),
      });
  });
  row('money_movements', 'demo-movement', {
    staff_id: staff,
    type: 'give',
    amount: 100000,
    date: today(),
    reason: 'প্রোগ্রাম পরিচালনার অগ্রিম',
  });
  row('expenses', 'demo-expense-1', {
    firm_id: f1,
    program_id: 'demo-program-0',
    scope: 'program',
    head_id: 'demo-head-0',
    staff_id: staff,
    amount: 28000,
    date: today(),
    reason: 'চট্টগ্রাম থেকে কুমিল্লা ট্রাক ভাড়া',
  });
  row('expenses', 'demo-expense-2', {
    firm_id: f1,
    program_id: 'demo-program-1',
    scope: 'program',
    head_id: 'demo-head-2',
    staff_id: staff,
    amount: 850,
    date: today(),
    reason: 'প্রেরণ কেন্দ্রের কর্মীদের খাবার',
  });
  return s;
}
export function applyDemo(s: Store, kind: Kind, id: string, data: Data, version: number): Store {
  const store = structuredClone(s);
  const old = store[kind].find((r) => r.id === id);
  if (old && old.version !== version) throw new Error('This entry changed. Refresh and review it.');
  const now = new Date().toISOString();
  if (kind === 'bills' && data.status === 'finalized') {
    const ids = data.program_ids as string[];
    if (!ids?.length) throw new Error('Choose a received program');
    const lines: Data[] = [];
    let total = 0;
    for (const pid of ids) {
      if (
        store.bills.some(
          (b) =>
            b.id !== id &&
            b.data.status === 'finalized' &&
            (b.data.program_ids as string[])?.includes(pid),
        )
      )
        throw new Error('A program is already billed');
      const p = store.programs.find((p) => p.id === pid);
      if (!p || p.data.firm_id !== data.firm_id)
        throw new Error('Choose programs from the same firm');
      const ds = store.dispatches.filter((d) => d.data.program_id === pid);
      if (!ds.length || ds.some((d) => !d.data.receiving_date))
        throw new Error('Add all receiving information first');
      const rate = num((data.rates as Data[])?.find((r) => r.program_id === pid)?.rate);
      if (rate <= 0) throw new Error('Enter a positive rate');
      let amount = 0;
      for (const d of ds) {
        amount += num(d.data.receiving_gross) * rate;
        lines.push({
          ...d.data,
          program_id: pid,
          program_number: str(p.data.number),
          program_date: str(p.data.date),
          distance: num((data.rates as Data[])?.find((r) => r.program_id === pid)?.distance),
          sending: str(p.data.sending),
          receiving: str(p.data.receiving),
          commodity: str(p.data.commodity),
          rate,
          amount: num(d.data.receiving_gross) * rate,
        });
      }
      total += amount;
    }
    data = {
      ...data,
      total: round(total),
      lines,
      program_totals: programBillTotals({ ...data, lines }).map((p) => ({
        program_id: p.id,
        amount: p.amount,
      })),
      firm_snapshot: [store.firms.find((f) => f.id === data.firm_id)?.data || {}],
    };
  }
  if (kind === 'settlements') {
    if (store.settlements.some((r) => r.data.bill_id === data.bill_id && r.id !== id))
      throw new Error('Bill already received');
    const bill = store.bills.find((b) => b.id === data.bill_id);
    if (!bill) throw new Error('Bill not found');
    const lines = bill.data.lines as Data[];
    const totals = programBillTotals(bill.data);
    const bases = (bill.data.program_ids as string[]).map((pid) => {
      const adj = (data.adjustments as Data[])?.find((a) => a.program_id === pid);
      return {
        id: pid,
        base: round(
          (totals.find((x) => x.id === pid)?.amount || 0) +
            num(adj?.extra) -
            num(adj?.shortage) -
            num(adj?.deduction),
        ),
      };
    });
    const allocations = allocateTax(bases, str(data.tax_mode), num(data.tax_value));
    const net = round(allocations.reduce((sum, a) => sum + a.net, 0));
    if (Math.abs(net - num(data.amount)) > 0.009)
      throw new Error('Net receipt must match the calculated total');
    data = {
      ...data,
      allocations: allocations as unknown as Data[],
      tax: round(allocations.reduce((s, a) => s + a.tax, 0)),
      firm_id: str(bill.data.firm_id),
    };
    for (const p of store.programs.filter((p) =>
      (bill.data.program_ids as string[]).includes(p.id),
    )) {
      p.data.closed = true;
      p.version++;
    }
  }
  if (kind === 'supplementary_receipts') {
    const p = store.programs.find((p) => p.id === data.program_id);
    if (!p?.data.closed) throw new Error('Choose a closed program');
    data = { ...data, firm_id: str(p.data.firm_id) };
  }
  const record: Row = {
    id,
    org_id: demoWorkspace.org_id,
    data,
    version: (old?.version || 0) + 1,
    created_by: old?.created_by || 'demo-owner',
    created_at: old?.created_at || now,
    updated_at: now,
  };
  store[kind] = [record, ...store[kind].filter((r) => r.id !== id)];
  return store;
}
