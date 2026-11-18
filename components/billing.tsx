'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Files,
  Check,
  Download,
  Edit3,
  Wallet,
  AlertCircle,
  ChevronDown,
  XCircle,
} from 'lucide-react';
import { useApp } from '@/lib/provider';
import { t, text, money, date, number, digits } from '@/lib/i18n';
import { type Data, type Row, str, num, today } from '@/lib/types';
import { stage, allocateTax, round, programBillTotals } from '@/lib/finance';
import { readCache, writeCache, deleteCache } from '@/lib/offline';
import { supabase } from '@/lib/supabase';
import { exportRows } from '@/lib/export';
import { Editor, type Field, Modal, Section, PageTitle, Empty, Badge, optionRows } from './ui';
import type { Open } from './workspace';
export function Bills({
  special,
  open,
}: {
  special: (s: string, id?: string) => void;
  open: Open;
}) {
  const { store, lang, reportLang, firm, demo, refresh, save } = useApp();
  const [error, setError] = useState(''),
    [filter, setFilter] = useState('all');
  const rows = store.bills.filter(
    (b) =>
      (!firm || b.data.firm_id === firm) &&
      (filter === 'all' || filter === 'paid'
        ? filter === 'all' || store.settlements.some((s) => s.data.bill_id === b.id)
        : b.data.status === filter),
  );
  const download = async (b: Row, format: 'pdf' | 'csv' | 'xlsx') => {
    const lang = reportLang;
    const lines = (b.data.lines || []) as Data[];
    const snapshot = (b.data.firm_snapshot as Data[])?.[0];
    const headers = [
      text(lang, 'প্রোগ্রাম', 'Program'),
      text(lang, 'প্রোগ্রামের তারিখ', 'Program date'),
      t(lang, 'invoiceNo'),
      text(lang, 'প্রেরণের তারিখ', 'Dispatch date'),
      t(lang, 'sending'),
      t(lang, 'destination'),
      t(lang, 'commodity'),
      text(lang, 'প্রেরিত বস্তা', 'Sent bags'),
      text(lang, 'প্রেরিত নেট টন', 'Sent net tonnes'),
      text(lang, 'প্রাপ্ত বস্তা', 'Received bags'),
      text(lang, 'প্রাপ্ত নেট টন', 'Received net tonnes'),
      text(lang, 'প্রাপ্ত গ্রস টন', 'Received gross tonnes'),
      text(lang, 'ঘাটতি', 'Shortage'),
      t(lang, 'distance'),
      t(lang, 'rate'),
      t(lang, 'amount'),
    ];
    try {
      await exportRows(
        format,
        t(lang, 'billNo') + ': ' + str(b.data.number),
        headers,
        (b.data.program_ids as string[]).flatMap((pid) => {
          const group = lines.filter((l) => l.program_id === pid);
          const rows = group.map((l) => [
            l.program_number,
            l.program_date,
            l.invoice_no,
            l.sending_date,
            l.sending,
            l.receiving,
            l.commodity,
            l.sending_bags,
            l.sending_net,
            l.receiving_bags,
            l.receiving_net,
            l.receiving_gross,
            l.shortage,
            l.distance || '',
            l.rate,
            round(l.amount),
          ]);
          const subtotal = programBillTotals(b.data).find((p) => p.id === pid)?.amount || 0;
          rows.push([
            text(lang, 'প্রোগ্রামের মোট', 'Program subtotal'),
            ...Array(14).fill(''),
            subtotal,
          ]);
          return rows;
        }),
        {
          subtitle:
            str(snapshot?.name) +
            '\n' +
            str(snapshot?.address) +
            '\n' +
            t(lang, 'recipient') +
            ': ' +
            str(b.data.recipient) +
            '\n' +
            t(lang, 'date') +
            ': ' +
            date(str(b.data.date), lang),
          total: money(num(b.data.total), lang),
          legal: true,
          signature: true,
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const cancel = async (b: Row) => {
    const reason = prompt(
      text(
        lang,
        'বিল বাতিলের কারণ লিখুন। প্রোগ্রামগুলো আবার বিল করা যাবে।',
        'Reason for cancelling this bill. Its programs will become available for billing.',
      ),
    );
    if (!reason) return;
    try {
      if (demo) {
        await save('bills', { ...b.data, status: 'cancelled' }, b, reason);
        return;
      }
      const { error } = await supabase()!.rpc('cancel_bill', { bill_id: b.id, reason });
      if (error) throw error;
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <>
      <PageTitle
        title={t(lang, 'bills')}
        description={text(
          lang,
          'সম্পূর্ণ প্রোগ্রাম নিয়ে বিল করুন, প্রাপ্ত টাকা লিখে রাখুন',
          'Bill whole programs and record actual receipts',
        )}
        action={
          <button className="button primary" onClick={() => special('bill')}>
            <Plus size={19} />
            {t(lang, 'newBill')}
          </button>
        }
      />
      <div className="tabs">
        {['all', 'draft', 'finalized', 'paid', 'cancelled'].map((s) => (
          <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
            {s === 'all'
              ? text(lang, 'সব বিল', 'All bills')
              : s === 'draft'
                ? text(lang, 'খসড়া', 'Drafts')
                : s === 'finalized'
                  ? text(lang, 'ইস্যু হয়েছে', 'Issued')
                  : s === 'paid'
                    ? text(lang, 'টাকা পাওয়া গেছে', 'Received')
                    : text(lang, 'বাতিল', 'Cancelled')}
          </button>
        ))}
      </div>
      {error && <div className="alert error">{error}</div>}
      {rows.length ? (
        <div className="bill-list">
          {rows.map((b) => {
            const receipt = store.settlements.find((s) => s.data.bill_id === b.id);
            return (
              <Section
                key={b.id}
                title={str(b.data.number)}
                description={
                  str(store.firms.find((f) => f.id === b.data.firm_id)?.data.name) +
                  ' · ' +
                  date(str(b.data.date), lang)
                }
                action={
                  <Badge
                    tone={receipt ? 'green' : b.data.status === 'cancelled' ? 'slate' : 'amber'}
                  >
                    {receipt
                      ? text(lang, 'টাকা পাওয়া গেছে', 'Money received')
                      : b.data.status === 'draft'
                        ? text(lang, 'খসড়া', 'Draft')
                        : b.data.status === 'cancelled'
                          ? text(lang, 'বাতিল', 'Cancelled')
                          : text(lang, 'ইস্যু হয়েছে', 'Issued')}
                  </Badge>
                }
              >
                <div className="bill-summary">
                  <div>
                    <span>
                      {text(lang, 'বিলের পরিমাণ (কর কাটার আগে)', 'Bill amount before tax')}
                    </span>
                    <strong>{money(num(b.data.total), lang)}</strong>
                  </div>
                  <div>
                    <span>{t(lang, 'programs')}</span>
                    <strong>{number((b.data.program_ids as string[])?.length || 0, lang)}</strong>
                  </div>
                  {receipt && (
                    <>
                      <div>
                        <span>{t(lang, 'tax')}</span>
                        <strong>{money(num(receipt.data.tax), lang)}</strong>
                      </div>
                      <div>
                        <span>{t(lang, 'netReceived')}</span>
                        <strong className="positive">
                          {money(num(receipt.data.amount), lang)}
                        </strong>
                      </div>
                    </>
                  )}
                </div>
                {b.data.govt_number && (
                  <p>
                    {text(lang, 'সরকারি বিল নম্বর', 'Government bill number')}:{' '}
                    {str(b.data.govt_number)} · {date(str(b.data.govt_date), lang)}
                  </p>
                )}
                <div className="button-row">
                  {b.data.status === 'draft' ? (
                    <button className="button primary" onClick={() => special('bill', b.id)}>
                      <Edit3 size={17} />
                      {text(lang, 'খসড়া খুলুন', 'Open draft')}
                    </button>
                  ) : (
                    b.data.status === 'finalized' && (
                      <>
                        <button
                          className="button primary"
                          onClick={() => special('settlement', b.id)}
                        >
                          <Wallet size={17} />
                          {receipt
                            ? text(lang, 'প্রাপ্তির সংশোধন', 'Correct receipt')
                            : t(lang, 'settlement')}
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => open({ kind: 'bills', row: b })}
                        >
                          <Edit3 size={17} />
                          {text(lang, 'সরকারি বিল নম্বর', 'Government reference')}
                        </button>
                        {!receipt && (
                          <button className="button secondary" onClick={() => cancel(b)}>
                            <XCircle size={17} />
                            {t(lang, 'cancel')}
                          </button>
                        )}
                      </>
                    )
                  )}
                  {b.data.status !== 'draft' &&
                    ['pdf', 'csv', 'xlsx'].map((format) => (
                      <button
                        className="button secondary"
                        key={format}
                        onClick={() => download(b, format as 'pdf')}
                      >
                        <Download size={16} />
                        {format.toUpperCase()}
                      </button>
                    ))}
                </div>
                {receipt && (
                  <details className="receipt-details">
                    <summary>{text(lang, 'প্রোগ্রাম অনুযায়ী প্রাপ্তি', 'Receipt by program')}</summary>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{t(lang, 'program')}</th>
                            <th>{text(lang, 'সমন্বিত পরিমাণ', 'Adjusted amount')}</th>
                            <th>{t(lang, 'tax')}</th>
                            <th>{t(lang, 'netReceived')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(receipt.data.allocations as Data[])?.map((a) => (
                            <tr key={str(a.program_id)}>
                              <td>
                                {str(
                                  store.programs.find((p) => p.id === a.program_id)?.data.number,
                                )}
                              </td>
                              <td>{money(num(a.base), lang)}</td>
                              <td>{money(num(a.tax), lang)}</td>
                              <td>{money(num(a.net), lang)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </Section>
            );
          })}
        </div>
      ) : (
        <Empty />
      )}
    </>
  );
}
export function BillBuilder({ onClose, billId }: { onClose: () => void; billId?: string }) {
  const { store, lang, firm, save, workspace } = useApp();
  const old = store.bills.find((b) => b.id === billId);
  const [distances, setDistances] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      ((old?.data.rates as Data[]) || []).map((r) => [str(r.program_id), num(r.distance)]),
    ),
  );
  const [selected, setSelected] = useState<string[]>((old?.data.program_ids as string[]) || []),
    [rates, setRates] = useState<Record<string, number>>(() =>
      Object.fromEntries(
        ((old?.data.rates as Data[]) || []).map((r) => [str(r.program_id), num(r.rate)]),
      ),
    ),
    [firmId, setFirmId] = useState(str(old?.data.firm_id) || firm || store.firms[0]?.id || ''),
    [error, setError] = useState('');
  const builderKey = 'builder:' + workspace?.user_id + ':' + (billId || 'new');
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    readCache<{
      selected: string[];
      rates: Record<string, number>;
      distances?: Record<string, number>;
      firmId: string;
    }>(builderKey).then((d) => {
      if (d) {
        setSelected(d.selected);
        setRates(d.rates);
        setDistances(d.distances || {});
        setFirmId(d.firmId);
      }
      setDraftReady(true);
    });
  }, [builderKey]);
  useEffect(() => {
    if (draftReady) void writeCache(builderKey, { selected, rates, distances, firmId });
  }, [builderKey, draftReady, selected, rates, distances, firmId]);
  const eligible = store.programs.filter(
    (p) =>
      p.data.firm_id === firmId &&
      stage(store, p) === 'received' &&
      !store.bills.some(
        (b) =>
          b.id !== billId &&
          b.data.status === 'finalized' &&
          (b.data.program_ids as string[])?.includes(p.id),
      ),
  );
  const initial = { number: '', date: today(), recipient: '', status: 'draft', ...old?.data };
  const total = round(
    store.dispatches
      .filter((d) => selected.includes(str(d.data.program_id)))
      .reduce((s, d) => s + num(d.data.receiving_gross) * (rates[str(d.data.program_id)] || 0), 0),
  );
  const submit = async (data: Data, reason: string) => {
    if (!selected.length)
      throw new Error(text(lang, 'অন্তত একটি প্রোগ্রাম নির্বাচন করুন', 'Choose at least one program'));
    if (selected.some((id) => !eligible.some((p) => p.id === id)))
      throw new Error(
        text(lang, 'প্রোগ্রামের প্রাপ্তির তথ্য যাচাই করুন', 'Review program receiving information'),
      );
    if (data.status === 'finalized' && selected.some((id) => !rates[id] || rates[id] <= 0))
      throw new Error(
        text(lang, 'প্রতিটি প্রোগ্রামের টনপ্রতি দর দিন', 'Enter a per-tonne rate for every program'),
      );
    if (
      store.bills.some((b) => b.id !== old?.id && b.data.number === data.number) &&
      !confirm(
        text(
          lang,
          'বিল নম্বর আগে আছে। একই নম্বরে সংরক্ষণ করবেন?',
          'Bill number already exists. Save with the same number?',
        ),
      )
    )
      throw new Error(text(lang, 'বিল নম্বর পরিবর্তন করুন', 'Change the bill number'));
    await save(
      'bills',
      {
        ...data,
        firm_id: firmId,
        program_ids: selected,
        rates: selected.map((id) => ({
          program_id: id,
          rate: rates[id] || 0,
          distance: distances[id] || 0,
        })),
        total,
      },
      old,
      reason,
    );
    await deleteCache(builderKey);
    onClose();
  };
  return (
    <Editor
      title={t(lang, 'newBill')}
      kind="bills"
      row={old}
      initial={initial}
      onClose={onClose}
      onlineOnly
      draftKey={billId || 'builder'}
      fields={[
        { key: 'number', label: 'billNo', required: true },
        { key: 'date', label: 'date', type: 'date', required: true },
        { key: 'recipient', label: 'recipient', required: true },
        {
          key: 'status',
          label: text(lang, 'সংরক্ষণের ধরন', 'Save as'),
          type: 'select',
          required: true,
          options: [
            { value: 'draft', label: text(lang, 'খসড়া বিল', 'Draft bill') },
            { value: 'finalized', label: text(lang, 'চূড়ান্ত বিল ইস্যু করুন', 'Issue final bill') },
          ],
        },
      ]}
      submit={submit}
      extra={() => (
        <div className="bill-builder">
          <label className="field">
            <span>{t(lang, 'firm')}</span>
            <select
              value={firmId}
              onChange={(e) => {
                setFirmId(e.target.value);
                setSelected([]);
              }}
            >
              {optionRows(store.firms).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <h3>{text(lang, 'সম্পূর্ণ প্রোগ্রাম নির্বাচন করুন', 'Choose whole programs')}</h3>
          <p className="muted">
            {text(
              lang,
              'প্রতিটি ট্রাকের প্রাপ্তির তথ্য থাকা প্রয়োজন। পরিমাণ কম হলে সতর্কতা দেখাবে।',
              'All truck receipts are required. A quantity difference will show a warning.',
            )}
          </p>
          {!eligible.length ? (
            <Empty
              title={text(
                lang,
                'বিল করার মতো প্রোগ্রাম নেই',
                'No received programs ready for billing',
              )}
            />
          ) : (
            eligible.map((p) => {
              const gross = store.dispatches
                .filter((d) => d.data.program_id === p.id)
                .reduce((s, d) => s + num(d.data.receiving_gross), 0);
              return (
                <div className="bill-program" key={p.id}>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, p.id]
                            : selected.filter((id) => id !== p.id),
                        )
                      }
                    />
                    <span>
                      <b>{str(p.data.number)}</b>
                      <small>
                        {str(p.data.sending)} → {str(p.data.receiving)} · {number(gross, lang)}{' '}
                        {text(lang, 'টন গ্রস', 'tonnes gross')}
                      </small>
                      {Math.abs(gross - num(p.data.quantity)) > 0.001 && (
                        <small className="warning-text">
                          {text(
                            lang,
                            'পরিমাণে পার্থক্য আছে। সংরক্ষণ করলে পার্থক্য মেনে নেওয়া হবে।',
                            'Quantity differs. Saving acknowledges this difference.',
                          )}
                        </small>
                      )}
                    </span>
                  </label>
                  {selected.includes(p.id) && (
                    <div className="form-grid">
                      <label className="field">
                        <span>{t(lang, 'distance')}</span>
                        <input
                          inputMode="decimal"
                          value={distances[p.id] || ''}
                          onChange={(e) =>
                            setDistances({ ...distances, [p.id]: Number(digits(e.target.value)) })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t(lang, 'rate')}</span>
                        <input
                          inputMode="decimal"
                          value={rates[p.id] || ''}
                          onChange={(e) =>
                            setRates({ ...rates, [p.id]: Number(digits(e.target.value)) })
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div className="calculation-total">
            <span>{t(lang, 'total')}</span>
            <strong>{money(total, lang)}</strong>
          </div>
        </div>
      )}
    />
  );
}
export function Settlement({ billId, onClose }: { billId: string; onClose: () => void }) {
  const { store, lang, save, workspace } = useApp();
  const bill = store.bills.find((b) => b.id === billId);
  const old = store.settlements.find((s) => s.data.bill_id === billId);
  const [adjustments, setAdjustments] = useState<Data[]>((old?.data.adjustments as Data[]) || []);
  const adjKey = 'adjustments:' + workspace?.user_id + ':' + billId;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    readCache<Data[]>(adjKey).then((d) => {
      if (d) setAdjustments(d);
      setReady(true);
    });
  }, [adjKey]);
  useEffect(() => {
    if (ready) void writeCache(adjKey, adjustments);
  }, [adjKey, adjustments, ready]);
  if (!bill) return null;
  const ids = bill.data.program_ids as string[];
  const lines = bill.data.lines as Data[];
  const totals = programBillTotals(bill.data);
  const bases = ids.map((id) => {
    const a = adjustments.find((a) => a.program_id === id);
    return {
      id,
      base: round(
        (totals.find((x) => x.id === id)?.amount || 0) +
          num(a?.extra) -
          num(a?.shortage) -
          num(a?.deduction),
      ),
    };
  });
  const calculated = (data: Data) => {
    try {
      const allocations = allocateTax(bases, str(data.tax_mode), num(data.tax_value));
      return {
        net: round(allocations.reduce((s, a) => s + a.net, 0)),
        tax: round(allocations.reduce((s, a) => s + a.tax, 0)),
      };
    } catch {
      return { net: 0, tax: 0 };
    }
  };
  const fields: Field[] = [
    { key: 'date', label: 'date', type: 'date', required: true },
    {
      key: 'tax_mode',
      label: text(lang, 'আয়কর দেওয়ার ধরন', 'Tax entry method'),
      type: 'select',
      required: true,
      options: [
        { value: 'percent', label: text(lang, 'শতাংশ (%)', 'Percentage (%)') },
        { value: 'amount', label: text(lang, 'টাকার পরিমাণ (৳)', 'Amount (৳)') },
      ],
    },
    {
      key: 'tax_value',
      label: text(lang, 'আয়করের শতাংশ / পরিমাণ', 'Tax percentage / amount'),
      type: 'number',
      required: true,
      min: 0,
    },
    { key: 'amount', label: 'netReceived', type: 'number', required: true },
    { key: 'reason', label: 'reason', type: 'textarea' },
  ];
  return (
    <Editor
      title={t(lang, 'settlement') + ' · ' + str(bill.data.number)}
      kind="settlements"
      row={old}
      initial={{
        date: today(),
        tax_mode: 'percent',
        tax_value: 0,
        amount: num(bill.data.total),
        reason: '',
      }}
      fields={fields}
      onlineOnly
      draftKey={billId}
      onClose={onClose}
      submit={async (data, reason) => {
        for (const a of adjustments)
          if (num(a.extra) + num(a.shortage) + num(a.deduction) > 0 && !str(a.reason).trim())
            throw new Error(text(lang, 'সমন্বয়ের কারণ লিখুন', 'Enter a reason for adjustments'));
        const calc = calculated(data);
        if (Math.abs(num(data.amount) - calc.net) > 0.009)
          throw new Error(
            text(
              lang,
              'প্রাপ্ত টাকা হিসাবের সাথে মিলছে না। কর ও সমন্বয় যাচাই করুন।',
              'Actual receipt does not match the calculation. Review tax and adjustments.',
            ),
          );
        await save('settlements', { ...data, bill_id: billId, adjustments }, old, reason);
        await deleteCache(adjKey);
      }}
      extra={(data) => (
        <div>
          <h3>{text(lang, 'প্রোগ্রাম অনুযায়ী সমন্বয়', 'Adjustments by program')}</h3>
          <p className="muted">
            {text(
              lang,
              'আয়কর সব সমন্বয়ের পরের পরিমাণের উপর গণনা হয়।',
              'Tax applies after all allowances and deductions.',
            )}
          </p>
          {ids.map((id) => {
            const a = adjustments.find((a) => a.program_id === id) || { program_id: id };
            const change = (key: string, value: string) =>
              setAdjustments([
                ...adjustments.filter((x) => x.program_id !== id),
                { ...a, [key]: key === 'reason' ? value : Number(digits(value)) },
              ]);
            return (
              <fieldset className="adjustment" key={id}>
                <legend>{str(store.programs.find((p) => p.id === id)?.data.number)}</legend>
                <div className="form-grid">
                  {[
                    ['extra', text(lang, 'অতিরিক্ত ভাতা', 'Extra allowance')],
                    ['shortage', text(lang, 'ঘাটতির কর্তন', 'Shortage deduction')],
                    ['deduction', text(lang, 'অন্যান্য কর্তন', 'Other deduction')],
                  ].map(([key, label]) => (
                    <label className="field" key={key}>
                      <span>{label} (৳)</span>
                      <input
                        inputMode="decimal"
                        value={num(a[key]) || ''}
                        onChange={(e) => change(key, e.target.value)}
                      />
                    </label>
                  ))}
                  <label className="field">
                    <span>{t(lang, 'reason')}</span>
                    <input
                      value={str(a.reason)}
                      onChange={(e) => change('reason', e.target.value)}
                    />
                  </label>
                </div>
              </fieldset>
            );
          })}
          <div className="receipt-calculation">
            <div>
              <span>{text(lang, 'সব সমন্বয়ের পরে', 'After adjustments')}</span>
              <b>
                {money(
                  bases.reduce((s, a) => s + a.base, 0),
                  lang,
                )}
              </b>
            </div>
            <div>
              <span>{t(lang, 'tax')}</span>
              <b>− {money(calculated(data).tax, lang)}</b>
            </div>
            <div className="calculation-total">
              <span>{text(lang, 'প্রত্যাশিত নিট প্রাপ্তি', 'Calculated net receipt')}</span>
              <strong>{money(calculated(data).net, lang)}</strong>
            </div>
          </div>
        </div>
      )}
    />
  );
}
export function ExtraReceipt({ programId, onClose }: { programId: string; onClose: () => void }) {
  const { store, lang } = useApp();
  return (
    <Editor
      title={t(lang, 'extra')}
      kind="supplementary_receipts"
      initial={{ program_id: programId, date: today(), tax_amount: 0 }}
      fields={[
        {
          key: 'program_id',
          label: 'program',
          type: 'select',
          required: true,
          options: optionRows(
            store.programs.filter((p) => p.data.closed),
            'number',
          ),
        },
        { key: 'date', label: 'date', type: 'date', required: true },
        { key: 'amount', label: 'netReceived', type: 'number', required: true, min: 0.01 },
        {
          key: 'tax_amount',
          label: text(lang, 'প্রযোজ্য আয়কর (৳, ঐচ্ছিক)', 'Tax withheld (৳, optional)'),
          type: 'number',
          min: 0,
        },
        { key: 'reason', label: 'reason', type: 'textarea', required: true },
      ]}
      onClose={onClose}
      onlineOnly
      draftKey={programId}
    />
  );
}
