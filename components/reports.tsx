'use client';
import { useState } from 'react';
import { Download, ChartNoAxesCombined, ArrowUpRight, Wallet, TrendingUp } from 'lucide-react';
import { useApp } from '@/lib/provider';
import { analysis, balance, stage, staffStatement, type Filters } from '@/lib/finance';
import { t, text, money, number, date } from '@/lib/i18n';
import { str, num, type Row } from '@/lib/types';
import { PageTitle, Section, Empty, optionRows } from './ui';
import { exportRows } from '@/lib/export';
export function Reports() {
  const { store, lang, reportLang, firm, fiscal } = useApp();
  const [staffMetric, setStaffMetric] = useState('spent');
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState<Omit<Filters, 'firm'>>({
      program: '',
      staff: '',
      head: '',
      from: '',
      to: '',
      mode: 'transaction',
    }),
    [error, setError] = useState('');
  const f = { ...filters, firm, status },
    result = analysis(store, f);
  const set = (key: string, v: string) => setFilters({ ...filters, [key]: v });
  const byHead = store.expense_heads
    .map((h) => ({
      name: str(h.data.name),
      amount: result.expenses
        .filter((e) => e.data.head_id === h.id)
        .reduce((s, e) => s + num(e.data.amount), 0),
    }))
    .filter((h) => h.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const max = Math.max(...byHead.map((h) => h.amount), 1);
  const programRows = result.programs.map((p) => {
    const r = analysis(store, {
      ...f,
      program: p.id,
      staff: filters.staff,
      head: filters.head,
      mode: 'program',
      from: '',
      to: '',
    });
    return { p, ...r };
  });
  const months = [
    ...new Set([
      ...result.expenses.map((e) => str(e.data.date).slice(0, 7)),
      ...result.receipts.map((r) => str(r.data.date).slice(0, 7)),
    ]),
  ]
    .filter(Boolean)
    .sort()
    .slice(-12);
  const timeline = months.map((month) => {
    const r = analysis(store, {
      ...f,
      mode: 'transaction',
      from: month + '-01',
      to: month + '-31',
    });
    return { month, ...r };
  });
  const download = async (format: 'pdf' | 'csv' | 'xlsx', raw = false) => {
    setError('');
    try {
      const l = reportLang;
      if (raw)
        await exportRows(
          format,
          text(l, 'খরচের তথ্য', 'Expense records'),
          [
            t(l, 'date'),
            t(l, 'firm'),
            t(l, 'program'),
            t(l, 'head'),
            t(l, 'spender'),
            t(l, 'reason'),
            t(l, 'amount'),
          ],
          result.expenses.map((e) => [
            str(e.data.date),
            str(store.firms.find((x) => x.id === e.data.firm_id)?.data.name),
            str(store.programs.find((x) => x.id === e.data.program_id)?.data.number),
            str(store.expense_heads.find((x) => x.id === e.data.head_id)?.data.name),
            str(store.staff.find((x) => x.id === e.data.staff_id)?.data.name) || t(l, 'self'),
            e.data.reason,
            num(e.data.amount),
          ]),
        );
      else
        await exportRows(
          format,
          text(l, 'নগদ ফলাফল', 'Cash results'),
          [t(l, 'program'), t(l, 'income'), t(l, 'spent'), t(l, 'profit')],
          programRows.map((r) => [
            r.p.data.number,
            result.costOnly ? '—' : r.income,
            r.cost,
            result.costOnly ? '—' : r.profit,
          ]),
          {
            subtitle:
              text(
                l,
                'প্রোগ্রামের জীবনকালভিত্তিক বিস্তারিত; সক্রিয় ফিল্টার: ',
                'Lifetime program detail; active filters: ',
              ) +
              (filters.from || '—') +
              ' / ' +
              (filters.to || '—'),
            total: money(
              programRows.reduce((sum, r) => sum + (result.costOnly ? r.cost : r.profit), 0),
              l,
            ),
          },
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const fy = () => {
    const d = new Date();
    const year = d.getMonth() + 1 < fiscal ? d.getFullYear() - 1 : d.getFullYear();
    const from = new Date(Date.UTC(year, fiscal - 1, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(year + 1, fiscal - 1, 0)).toISOString().slice(0, 10);
    setFilters({ ...filters, from, to });
  };
  const staffRows = store.staff
    .filter((s) => !filters.staff || s.id === filters.staff)
    .map((s) => ({
      staff: s,
      spent: result.expenses
        .filter((e) => e.data.staff_id === s.id)
        .reduce((n, e) => n + num(e.data.amount), 0),
      movements: store.money_movements.filter(
        (m) =>
          (!filters.from || str(m.data.date) >= filters.from) &&
          (!filters.to || str(m.data.date) <= filters.to),
      ),
      programs: new Set(
        [
          ...result.expenses
            .filter((e) => e.data.staff_id === s.id)
            .map((e) => str(e.data.program_id)),
          ...result.programs.filter((p) => p.data.staff_id === s.id).map((p) => p.id),
        ].filter(Boolean),
      ),
      balance: balance(store, s.id, filters.to || undefined),
    }));
  return (
    <>
      <PageTitle
        title={t(lang, 'reports')}
        description={text(
          lang,
          'টাকা প্রাপ্তি, খরচ ও নগদ ফলাফল বুঝুন',
          'Understand actual receipts, spending and cash results',
        )}
        action={
          <button className="button secondary" onClick={fy}>
            {text(lang, 'চলতি অর্থবছর', 'Current financial year')}
          </button>
        }
      />
      <div className="filter-panel">
        <div className="filterbar">
          <label className="field">
            <span>{text(lang, 'তারিখের ভিত্তি', 'Date basis')}</span>
            <select value={filters.mode} onChange={(e) => set('mode', e.target.value)}>
              <option value="transaction">{t(lang, 'transactionDate')}</option>
              <option value="program">{t(lang, 'programDate')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t(lang, 'from')}</span>
            <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
          </label>
          <label className="field">
            <span>{t(lang, 'to')}</span>
            <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
          </label>
          <label className="field">
            <span>{t(lang, 'program')}</span>
            <select value={filters.program} onChange={(e) => set('program', e.target.value)}>
              <option value="">{text(lang, 'সকল প্রোগ্রাম', 'All programs')}</option>
              {optionRows(
                store.programs.filter((p) => !firm || p.data.firm_id === firm),
                'number',
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filterbar">
          <select
            aria-label={text(lang, 'প্রোগ্রামের অবস্থা', 'Program status')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{text(lang, 'সকল অবস্থা', 'All program statuses')}</option>
            {['draft', 'sent', 'received', 'closed'].map((s) => (
              <option value={s} key={s}>
                {t(lang, s as 'sent')}
              </option>
            ))}
          </select>
          <select
            aria-label={t(lang, 'staff')}
            value={filters.staff}
            onChange={(e) => set('staff', e.target.value)}
          >
            <option value="">{text(lang, 'সকল কর্মী', 'All staff')}</option>
            {optionRows(store.staff).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            aria-label={t(lang, 'head')}
            value={filters.head}
            onChange={(e) => set('head', e.target.value)}
          >
            <option value="">{text(lang, 'সকল খাত', 'All heads')}</option>
            {optionRows(store.expense_heads).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <p className="section-note">
          {filters.mode === 'transaction'
            ? text(
                lang,
                'প্রাপ্তি ও খরচ তাদের নিজ নিজ লেনদেনের তারিখে দেখানো হচ্ছে।',
                'Receipts and expenses use their own transaction dates.',
              )
            : text(
                lang,
                'প্রোগ্রাম তারিখ দিয়ে নির্বাচন; নির্বাচিত প্রোগ্রামের সব সময়ের প্রাপ্তি ও খরচ। সাধারণ খরচ অন্তর্ভুক্ত নয়।',
                'Programs selected by program date; shows their lifetime receipts and costs. General expenses excluded.',
              )}
          {result.costOnly
            ? ' ' +
              text(
                lang,
                'কর্মী / খাত নির্বাচন করা হলে শুধু খরচ দেখানো হয়; আয় তাদের নামে বরাদ্দ করা হয় না।',
                'Staff/head filters show costs only; revenue is not assigned to people or heads.',
              )
            : ''}
        </p>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <div>
            <span>{t(lang, 'income')}</span>
            <strong>{result.costOnly ? '—' : money(result.income, lang)}</strong>
          </div>
        </div>
        <div className="stat">
          <div>
            <span>{t(lang, 'spent')}</span>
            <strong>{money(result.cost, lang)}</strong>
          </div>
        </div>
        <div className="stat result-stat">
          <div>
            <span>{t(lang, 'profit')}</span>
            <strong className={result.profit < 0 ? 'negative' : 'positive'}>
              {result.costOnly ? '—' : money(result.profit, lang)}
            </strong>
          </div>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="report-grid">
        <Section title={text(lang, 'খাত অনুযায়ী খরচ', 'Spending by head')}>
          {byHead.length ? (
            <div className="bar-chart">
              {byHead.map((h, i) => (
                <div className="bar-item" key={h.name}>
                  <div>
                    <span>{h.name}</span>
                    <b>{money(h.amount, lang)}</b>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: Math.max(2, (h.amount / max) * 100) + '%',
                        background: ['#176749', '#B58A2D', '#547F91', '#8F765D'][i % 4],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </Section>
        <Section title={text(lang, 'টাকা আসা ও খরচের তুলনা', 'Receipts and spending')}>
          <div className="comparison-chart">
            {[
              {
                label: t(lang, 'income'),
                amount: result.costOnly ? 0 : result.income,
                color: '#176749',
              },
              { label: t(lang, 'spent'), amount: result.cost, color: '#C89A3D' },
            ].map((r) => (
              <div key={r.label}>
                <div className="column-track">
                  <span
                    style={{
                      height:
                        Math.max(2, (r.amount / Math.max(result.income, result.cost, 1)) * 100) +
                        '%',
                      background: r.color,
                    }}
                  />
                </div>
                <b>{money(r.amount, lang)}</b>
                <span>{r.label}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Section
        title={text(lang, 'মাস অনুযায়ী টাকা আসা ও খরচ', 'Monthly receipts & spending')}
        description={text(
          lang,
          'লেনদেনের তারিখ অনুযায়ী শেষ ১২টি সক্রিয় মাস',
          'Last 12 active months, using transaction dates',
        )}
      >
        {timeline.length ? (
          <div className="timeline-chart">
            {timeline.map((r) => (
              <div className="timeline-item" key={r.month}>
                <b>{r.month}</b>
                <span>
                  {text(lang, 'প্রাপ্তি', 'In')}: {result.costOnly ? '—' : money(r.income, lang)}
                </span>
                <div className="bar-track">
                  <span
                    style={{
                      width:
                        (result.costOnly
                          ? 0
                          : Math.max(
                              2,
                              (r.income /
                                Math.max(...timeline.map((x) => Math.max(x.income, x.cost)), 1)) *
                                100,
                            )) + '%',
                      background: '#176749',
                    }}
                  />
                </div>
                <span>
                  {text(lang, 'খরচ', 'Out')}: {money(r.cost, lang)}
                </span>
                <div className="bar-track">
                  <span
                    style={{
                      width:
                        Math.max(
                          2,
                          (r.cost /
                            Math.max(...timeline.map((x) => Math.max(x.income, x.cost)), 1)) *
                            100,
                        ) + '%',
                      background: '#C89A3D',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Section>
      <Section
        title={text(lang, 'প্রোগ্রাম অনুযায়ী বিস্তারিত', 'Lifetime results by selected program')}
        description={text(
          lang,
          'লেনদেন তারিখের মূল মোটের সাথে জীবনকালের মোট আলাদা হতে পারে।',
          'Lifetime totals can differ from transaction-date totals above.',
        )}
        action={
          <div className="button-row">
            {['pdf', 'csv', 'xlsx'].map((format) => (
              <button
                className="button secondary small-button"
                key={format}
                onClick={() => download(format as 'pdf')}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        }
      >
        {programRows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t(lang, 'program')}</th>
                  <th>{t(lang, 'income')}</th>
                  <th>{t(lang, 'spent')}</th>
                  <th>{t(lang, 'profit')}</th>
                </tr>
              </thead>
              <tbody>
                {programRows.map((r) => (
                  <tr key={r.p.id}>
                    <td>{str(r.p.data.number)}</td>
                    <td>{result.costOnly ? '—' : money(r.income, lang)}</td>
                    <td>{money(r.cost, lang)}</td>
                    <td className={r.profit < 0 ? 'negative' : 'positive'}>
                      <b>{result.costOnly ? '—' : money(r.profit, lang)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Section>
      <Section
        title={text(lang, 'কর্মীদের কাজ ও টাকার তুলনা', 'Staff activity & money comparison')}
        description={text(
          lang,
          'খরচ বেশি মানেই খারাপ কাজ নয়। দায়িত্ব, কাজ ও হাতে থাকা টাকা একসাথে দেখুন।',
          'Higher spending is not poor performance. Compare activity and money in context.',
        )}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t(lang, 'staff')}</th>
                <th>{t(lang, 'programs')}</th>
                <th>{t(lang, 'give')}</th>
                <th>{t(lang, 'spent')}</th>
                <th>{t(lang, 'return')}</th>
                <th>{t(lang, 'balance')}</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((r) => (
                <tr key={r.staff.id}>
                  <td>{str(r.staff.data.name)}</td>
                  <td>{number(r.programs.size, lang)}</td>
                  <td>
                    {money(
                      r.movements
                        .filter((m) => m.data.staff_id === r.staff.id && m.data.type === 'give')
                        .reduce((s, m) => s + num(m.data.amount), 0),
                      lang,
                    )}
                  </td>
                  <td>{money(r.spent, lang)}</td>
                  <td>
                    {money(
                      r.movements
                        .filter((m) => m.data.staff_id === r.staff.id && m.data.type === 'return')
                        .reduce((s, m) => s + num(m.data.amount), 0),
                      lang,
                    )}
                  </td>
                  <td>{money(r.balance, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section
        title={text(lang, 'কর্মী তুলনার চার্ট', 'Staff comparison chart')}
        action={
          <select
            aria-label={text(lang, 'তুলনার বিষয়', 'Comparison metric')}
            value={staffMetric}
            onChange={(e) => setStaffMetric(e.target.value)}
          >
            <option value="spent">{t(lang, 'spent')}</option>
            <option value="programs">{t(lang, 'programs')}</option>
            <option value="balance">{t(lang, 'balance')}</option>
          </select>
        }
      >
        <div className="bar-chart">
          {staffRows.map((r) => {
            const value =
              staffMetric === 'programs'
                ? r.programs.size
                : staffMetric === 'balance'
                  ? r.balance
                  : r.spent;
            const max = Math.max(
              ...staffRows.map((s) =>
                Math.abs(
                  staffMetric === 'programs'
                    ? s.programs.size
                    : staffMetric === 'balance'
                      ? s.balance
                      : s.spent,
                ),
              ),
              1,
            );
            return (
              <div className="bar-item" key={r.staff.id}>
                <div>
                  <span>{str(r.staff.data.name)}</span>
                  <b>{staffMetric === 'programs' ? number(value, lang) : money(value, lang)}</b>
                </div>
                <div className="bar-track">
                  <span
                    style={{
                      width: Math.max(2, (Math.abs(value) / max) * 100) + '%',
                      background: value < 0 ? '#B55944' : '#176749',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      <Section
        title={text(lang, 'মূল তথ্য ডাউনলোড', 'Download underlying records')}
        description={text(
          lang,
          'বর্তমান ফিল্টারে নির্বাচিত খরচের তথ্য।',
          'Expense records matching the current filters.',
        )}
      >
        <div className="button-row">
          {['pdf', 'csv', 'xlsx'].map((format) => (
            <button
              className="button secondary"
              key={format}
              onClick={() => download(format as 'pdf', true)}
            >
              <Download size={17} />
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </Section>
      <RawExports />
    </>
  );
}
export function Register() {
  const { store, lang, reportLang, firm } = useApp();
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [error, setError] = useState('');
  const ps = store.programs.filter((p) => !firm || p.data.firm_id === firm);
  const ds = store.dispatches.filter(
    (d) =>
      ps.some((p) => p.id === d.data.program_id) &&
      (!from || str(d.data.sending_date) >= from) &&
      (!to || str(d.data.sending_date) <= to),
  );
  const get = (l: typeof lang) => {
    const headers = [
      t(l, 'programNo'),
      text(l, 'প্রোগ্রামের তারিখ', 'Program date'),
      t(l, 'quantity'),
      t(l, 'invoiceNo'),
      text(l, 'প্রেরণের তারিখ', 'Sending date'),
      t(l, 'sending'),
      t(l, 'destination'),
      text(l, 'প্রাপ্তির তারিখ', 'Receiving date'),
      t(l, 'commodity'),
      text(l, 'প্রেরিত গ্রস', 'Sent gross'),
      text(l, 'প্রাপ্ত গ্রস', 'Received gross'),
      text(l, 'ঘাটতি', 'Shortage'),
      t(l, 'truck'),
      t(l, 'billNo'),
      text(l, 'বিলের তারিখ', 'Bill date'),
      text(l, 'সরকারি বিল নম্বর', 'Government bill no.'),
      text(l, 'সরকারি বিলের তারিখ', 'Government bill date'),
    ];
    const rows = ds.map((d) => {
      const p = ps.find((p) => p.id === d.data.program_id)!;
      const b = store.bills.find(
        (b) => b.data.status === 'finalized' && (b.data.program_ids as string[])?.includes(p.id),
      );
      return [
        p.data.number,
        p.data.date,
        p.data.quantity,
        d.data.invoice_no,
        d.data.sending_date,
        p.data.sending,
        p.data.receiving,
        d.data.receiving_date,
        p.data.commodity,
        d.data.sending_gross,
        d.data.receiving_gross,
        d.data.shortage,
        d.data.truck_no,
        b?.data.number,
        b?.data.date,
        b?.data.govt_number,
        b?.data.govt_date,
      ];
    });
    return { headers, rows };
  };
  const current = get(lang);
  return (
    <>
      <PageTitle
        title={t(lang, 'register')}
        description={text(
          lang,
          'প্রেরণ থেকে সরকারি বিল, এক রেজিস্টারে',
          'Dispatch through government bill reference in one register',
        )}
        action={
          <div className="button-row">
            {['pdf', 'csv', 'xlsx'].map((format) => (
              <button
                key={format}
                className="button secondary"
                onClick={() => {
                  const r = get(reportLang);
                  void exportRows(format as 'pdf', t(reportLang, 'register'), r.headers, r.rows, {
                    subtitle:
                      str(store.firms.find((f) => f.id === firm)?.data.name) ||
                      t(reportLang, 'allFirms'),
                    legal: true,
                  }).catch((e) => setError(e.message));
                }}
              >
                <Download size={16} />
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />
      <div className="filterbar">
        <label className="field compact">
          <span>{t(lang, 'from')}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field compact">
          <span>{t(lang, 'to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {error && <div className="alert error">{error}</div>}
      <Section title={text(lang, 'চালানের বিবরণ', 'Invoice records')}>
        {ds.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {current.headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j}>{v == null ? '—' : str(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Section>
    </>
  );
}

function RawExports() {
  const { store, lang, reportLang } = useApp();
  const [kind, setKind] = useState<keyof typeof store>('programs'),
    [error, setError] = useState('');
  const labels: Record<keyof typeof store, string> = {
    firms: t(lang, 'firms'),
    staff: t(lang, 'staff'),
    expense_heads: t(lang, 'heads'),
    programs: t(lang, 'programs'),
    dispatches: text(lang, 'চালান', 'Dispatches'),
    expenses: t(lang, 'expenses'),
    money_movements: t(lang, 'money'),
    bills: t(lang, 'bills'),
    settlements: t(lang, 'settlement'),
    supplementary_receipts: t(lang, 'extra'),
  };
  const download = async (format: 'pdf' | 'csv' | 'xlsx') => {
    try {
      const records = store[kind];
      const keys = [...new Set(records.flatMap((r) => Object.keys(r.data)))];
      const headers = ['ID', ...keys, 'Created', 'Updated', 'Version'];
      const rows = records.map((r) => [
        r.id,
        ...keys.map((k) => (typeof r.data[k] === 'object' ? JSON.stringify(r.data[k]) : r.data[k])),
        r.created_at,
        r.updated_at,
        r.version,
      ]);
      if (format === 'pdf') {
        const entries = records.flatMap((r) =>
          keys.map((k) => [
            str(r.data.number) || str(r.data.name) || r.id,
            k,
            typeof r.data[k] === 'object' ? JSON.stringify(r.data[k]) : r.data[k],
          ]),
        );
        await exportRows(format, labels[kind], ['Record', 'Field', 'Value'], entries, {
          legal: true,
        });
        return;
      }
      await exportRows(format, labels[kind], headers, rows, {
        legal: true,
        subtitle: text(
          reportLang,
          'সম্পূর্ণ মূল তথ্য; সক্রিয় ভিউ ফিল্টার প্রযোজ্য নয়',
          'Complete underlying dataset; view filters do not apply',
        ),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Section
      title={text(lang, 'সকল মূল তথ্য রপ্তানি', 'Export all underlying data')}
      description={text(
        lang,
        'ডেটার ধরন নির্বাচন করুন। সম্পূর্ণ তথ্য ডাউনলোড হবে।',
        'Choose a dataset to download its complete records.',
      )}
    >
      {error && <p className="negative">{error}</p>}
      <div className="button-row">
        <select
          style={{ maxWidth: 250 }}
          aria-label={text(lang, 'ডেটার ধরন', 'Dataset')}
          value={kind}
          onChange={(e) => setKind(e.target.value as keyof typeof store)}
        >
          {Object.entries(labels).map(([k, label]) => (
            <option value={k} key={k}>
              {label}
            </option>
          ))}
        </select>
        {['pdf', 'csv', 'xlsx'].map((format) => (
          <button
            className="button secondary"
            key={format}
            onClick={() => download(format as 'pdf')}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
    </Section>
  );
}
