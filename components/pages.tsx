'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Plus,
  Truck,
  CheckCircle2,
  Clock3,
  Wallet,
  Building2,
  Users,
  Files,
  Tags,
  BookOpen,
  Settings,
  ChartNoAxesCombined,
  ChevronRight,
  ArrowLeft,
  Edit3,
  Mail,
  RefreshCw,
  Download,
  LogOut,
  AlertCircle,
  WifiOff,
  History,
  Smartphone,
  Link2,
} from 'lucide-react';
import { useApp } from '@/lib/provider';
import { t, text, money, number, date, digits } from '@/lib/i18n';
import { type Kind, type Row, type Data, str, num, today } from '@/lib/types';
import { stage, balance, analysis, staffStatement } from '@/lib/finance';
import { supabase } from '@/lib/supabase';
import { readCache } from '@/lib/offline';
import { exportRows } from '@/lib/export';
import { Empty, Section, PageTitle, Badge, SearchBox, Modal } from './ui';
import type { Open } from './workspace';
export function ProgramCard({ row }: { row: Row }) {
  const { store, lang, workspace } = useApp();
  const ds = store.dispatches.filter((d) => d.data.program_id === row.id);
  const status = stage(store, row);
  const done = ds.filter((d) => d.data.receiving_date).length;
  const received = ds.reduce((s, d) => s + num(d.data.receiving_gross), 0);
  const firm = store.firms.find((f) => f.id === row.data.firm_id);
  return (
    <Link className="program-card" href={'/?view=program&id=' + row.id}>
      <div className="program-card-top">
        <span className="program-ref">
          {text(lang, 'প্রোগ্রাম', 'Program')} {str(row.data.number)}
        </span>
        <Badge
          tone={
            status === 'closed'
              ? 'slate'
              : status === 'received'
                ? 'green'
                : status === 'sent'
                  ? 'amber'
                  : 'slate'
          }
        >
          {t(lang, status)}
        </Badge>
      </div>
      <h3>
        {str(row.data.sending)} <ArrowRight size={18} /> {str(row.data.receiving)}
      </h3>
      <div className="program-meta">
        <span>{str(row.data.commodity)}</span>
        <span>
          {number(num(row.data.quantity), lang)} {text(lang, 'টন', 'tonnes')}
        </span>
        <span>
          <Truck size={15} />
          {number(ds.length, lang)} {text(lang, 'ট্রাক', 'trucks')}
        </span>
      </div>
      <div className="progress-track">
        <span style={{ width: Math.min(100, (received / num(row.data.quantity)) * 100) + '%' }} />
      </div>
      <div className="program-card-bottom">
        <span>{str(firm?.data.name)}</span>
        <span>
          {number(done, lang)}/{number(ds.length, lang)} {t(lang, 'received')}{' '}
          <ChevronRight size={16} />
        </span>
      </div>
    </Link>
  );
}
export function Dashboard({
  open,
  special,
}: {
  open: Open;
  special: (name: string, id?: string) => void;
}) {
  const { store, workspace, lang, firm } = useApp();
  const owner = workspace?.role === 'owner';
  const ps = store.programs.filter((p) => !firm || p.data.firm_id === firm);
  const openPs = ps.filter((p) => !p.data.closed);
  const awaiting = ps.filter((p) => stage(store, p) === 'sent');
  const ready = ps.filter(
    (p) =>
      stage(store, p) === 'received' &&
      !store.bills.some(
        (b) => (b.data.program_ids as string[])?.includes(p.id) && b.data.status === 'finalized',
      ),
  );
  const result = analysis(store, {
    firm,
    program: '',
    staff: '',
    head: '',
    from: '',
    to: '',
    mode: 'transaction',
  });
  return (
    <>
      <PageTitle
        title={text(
          lang,
          `স্বাগতম, ${workspace?.name.split(' ')[0]}`,
          `Welcome, ${workspace?.name.split(' ')[0]}`,
        )}
        description={
          date(today(), lang) +
          ' · ' +
          text(lang, 'আপনার কাজের সংক্ষিপ্ত চিত্র', 'A clear view of your work')
        }
        action={
          <Link href="/?view=reports" className="button secondary desktop-only">
            <ChartNoAxesCombined size={18} />
            {t(lang, 'reports')}
          </Link>
        }
      />
      <section className="work-banner">
        <div>
          <div className="banner-eyebrow">
            <span className="status-dot" />
            {text(lang, 'আজকের প্রস্তুতি', 'Ready for the day')}
          </div>
          <h2>{text(lang, 'সব কাজের হিসাব, এক জায়গায়।', 'Every job. One clear workspace.')}</h2>
          <p>
            {owner
              ? text(
                  lang,
                  'প্রোগ্রাম শুরু করুন, খরচ লিখুন, বিলের টাকা বুঝে নিন।',
                  'Start a program, record costs, and keep track of your bill receipts.',
                )
              : text(
                  lang,
                  'চালান ও প্রাপ্তির তথ্য দিন। নিজের খরচের হিসাব রাখুন।',
                  'Update dispatches and receipts. Keep your spending recorded.',
                )}
          </p>
          <div className="button-row">
            {owner && (
              <button className="button primary" onClick={() => open({ kind: 'programs' })}>
                <Plus size={20} />
                {t(lang, 'newProgram')}
              </button>
            )}
            <button className="button white" onClick={() => open({ kind: 'expenses' })}>
              <Wallet size={19} />
              {t(lang, 'newExpense')}
            </button>
          </div>
        </div>
        <div className="banner-visual" aria-hidden="true">
          <div className="route-location">
            <span />
            <b>{text(lang, 'প্রেরণ কেন্দ্র', 'Sending center')}</b>
          </div>
          <div className="route-road">
            <Truck size={55} strokeWidth={1.3} />
            <span />
          </div>
          <div className="route-location destination">
            <span />
            <b>{text(lang, 'প্রাপ্তি কেন্দ্র', 'Receiving center')}</b>
          </div>
          <div className="visual-caption">
            {text(lang, 'নিরাপদ যাত্রা, পরিষ্কার হিসাব', 'Work moves. Your records stay clear.')}
          </div>
        </div>
      </section>
      <div className="stat-grid">
        <Link href="/?view=programs" className="stat">
          <span className="stat-icon green">
            <Truck size={24} />
          </span>
          <div>
            <span>{text(lang, 'চলমান প্রোগ্রাম', 'Active programs')}</span>
            <strong>{number(openPs.length, lang)}</strong>
          </div>
          <ArrowUpRight className="stat-link" size={20} />
        </Link>
        <Link href="/?view=programs&status=sent" className="stat">
          <span className="stat-icon amber">
            <Clock3 size={24} />
          </span>
          <div>
            <span>{t(lang, 'receiving')}</span>
            <strong>{number(awaiting.length, lang)}</strong>
          </div>
          <ArrowUpRight className="stat-link" size={20} />
        </Link>
        <Link href={owner ? '/?view=bills' : '/?view=money'} className="stat">
          <span className="stat-icon blue">
            {owner ? <Files size={24} /> : <Wallet size={24} />}
          </span>
          <div>
            <span>
              {owner ? text(lang, 'বিল করার জন্য প্রস্তুত', 'Ready for billing') : t(lang, 'balance')}
            </span>
            <strong>
              {owner
                ? number(ready.length, lang)
                : money(balance(store, workspace?.staff_id || ''), lang)}
            </strong>
          </div>
          <ArrowUpRight className="stat-link" size={20} />
        </Link>
      </div>
      <div className="dashboard-columns">
        <Section
          title={text(lang, 'সাম্প্রতিক প্রোগ্রাম', 'Recent programs')}
          description={text(
            lang,
            'কাজের অগ্রগতি দেখুন ও পরের ধাপে যান',
            'See progress and take the next step',
          )}
          action={
            <Link className="text-button" href="/?view=programs">
              {t(lang, 'viewAll')}
              <ChevronRight size={17} />
            </Link>
          }
        >
          {ps.length ? (
            <div className="program-grid">
              {ps.slice(0, 4).map((p) => (
                <ProgramCard key={p.id} row={p} />
              ))}
            </div>
          ) : (
            <Empty
              action={
                owner ? (
                  <button className="button primary" onClick={() => open({ kind: 'firms' })}>
                    <Plus size={19} />
                    {text(lang, 'প্রথম ফার্ম যোগ করুন', 'Add your first firm')}
                  </button>
                ) : undefined
              }
            />
          )}
        </Section>
        <div className="dashboard-side">
          <Section title={text(lang, 'পরের কাজ', 'Next actions')}>
            <div className="task-list">
              <Link href="/?view=programs&status=sent">
                <span className="task-icon amber">
                  <Truck size={21} />
                </span>
                <div>
                  <b>{t(lang, 'addReceiving')}</b>
                  <small>
                    {number(awaiting.length, lang)}{' '}
                    {text(lang, 'প্রোগ্রাম অপেক্ষায়', 'programs waiting')}
                  </small>
                </div>
                <ChevronRight size={18} />
              </Link>
              {owner && (
                <button onClick={() => special('bill')}>
                  <span className="task-icon green">
                    <Files size={21} />
                  </span>
                  <div>
                    <b>{t(lang, 'newBill')}</b>
                    <small>
                      {number(ready.length, lang)} {text(lang, 'প্রোগ্রাম প্রস্তুত', 'programs ready')}
                    </small>
                  </div>
                  <ChevronRight size={18} />
                </button>
              )}
              <button onClick={() => open({ kind: 'expenses' })}>
                <span className="task-icon blue">
                  <Wallet size={21} />
                </span>
                <div>
                  <b>{t(lang, 'newExpense')}</b>
                  <small>{text(lang, 'প্রতিটি খরচ সময়মতো লিখুন', 'Keep spending up to date')}</small>
                </div>
                <ChevronRight size={18} />
              </button>
            </div>
          </Section>
          <div className="cash-summary">
            <span>
              {owner
                ? text(lang, 'এ পর্যন্ত মোট খরচ', 'Spending to date')
                : text(lang, 'নিজের মোট খরচ', 'Your total spending')}
            </span>
            <strong>{money(result.cost, lang)}</strong>
            <p>
              {text(
                lang,
                'অগ্রিম দেওয়া টাকা খরচ হিসেবে যোগ হয় না।',
                'Staff advances are not counted as expenses.',
              )}
            </p>
            <Link href="/?view=expenses">
              {text(lang, 'খরচের খাতা দেখুন', 'Open expense ledger')}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
export function Programs({ open }: { open: Open }) {
  const { store, lang, firm, workspace } = useApp();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState(
      typeof window !== 'undefined'
        ? new URLSearchParams(location.search).get('status') || 'all'
        : 'all',
    );
  const q = digits(query).toLowerCase();
  const ps = store.programs.filter(
    (p) =>
      (!firm || p.data.firm_id === firm) &&
      (filter === 'all' || stage(store, p) === filter) &&
      (digits(Object.values(p.data).join(' ')).toLowerCase().includes(q) ||
        store.dispatches.some(
          (d) =>
            d.data.program_id === p.id &&
            digits(str(d.data.invoice_no) + ' ' + str(d.data.truck_no))
              .toLowerCase()
              .includes(q),
        )),
  );
  return (
    <>
      <PageTitle
        title={t(lang, 'programList')}
        description={text(
          lang,
          'প্রতিটি প্রোগ্রাম, তার ট্রাক ও কাজের অগ্রগতি',
          'Every program, its trucks and its progress',
        )}
        action={
          workspace?.role === 'owner' && (
            <button className="button primary" onClick={() => open({ kind: 'programs' })}>
              <Plus size={20} />
              {t(lang, 'newProgram')}
            </button>
          )
        }
      />
      <div className="filterbar">
        <SearchBox value={query} onChange={setQuery} />
        <select
          aria-label={text(lang, 'অবস্থা', 'Status')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {['all', 'draft', 'sent', 'received', 'closed'].map((v) => (
            <option value={v} key={v}>
              {v === 'all' ? text(lang, 'সকল অবস্থা', 'All statuses') : t(lang, v as 'sent')}
            </option>
          ))}
        </select>
      </div>
      {ps.length ? (
        <div className="program-grid standalone">
          {ps.map((p) => (
            <ProgramCard row={p} key={p.id} />
          ))}
        </div>
      ) : (
        <Empty />
      )}
    </>
  );
}
export function ProgramDetail({
  id,
  open,
  special,
}: {
  id: string;
  open: Open;
  special: (s: string, id?: string) => void;
}) {
  const { store, lang, workspace } = useApp();
  const p = store.programs.find((p) => p.id === id);
  if (!p) return <Empty title={text(lang, 'প্রোগ্রাম পাওয়া যায়নি', 'Program not found')} />;
  const owner = workspace?.role === 'owner',
    ds = store.dispatches.filter((d) => d.data.program_id === id),
    es = store.expenses.filter((e) => e.data.program_id === id);
  const status = stage(store, p);
  const billed = store.bills.some(
    (b) => b.data.status === 'finalized' && (b.data.program_ids as string[])?.includes(id),
  );
  const received = ds.reduce((s, d) => s + num(d.data.receiving_gross), 0);
  const sent = ds.reduce((s, d) => s + num(d.data.sending_gross), 0);
  const result = analysis(store, {
    firm: '',
    program: id,
    staff: '',
    head: '',
    from: '',
    to: '',
    mode: 'program',
  });
  return (
    <>
      <Link className="back-link" href="/?view=programs">
        <ArrowLeft size={18} />
        {t(lang, 'programs')}
      </Link>
      <PageTitle
        title={text(lang, 'প্রোগ্রাম ', 'Program ') + str(p.data.number)}
        description={str(p.data.sending) + ' → ' + str(p.data.receiving)}
        action={
          <div className="button-row">
            <Badge tone={status === 'sent' ? 'amber' : 'green'}>{t(lang, status)}</Badge>
            {owner && (
              <button
                className="button secondary"
                onClick={() => open({ kind: 'programs', row: p })}
              >
                <Edit3 size={17} />
                {t(lang, 'edit')}
              </button>
            )}
          </div>
        }
      />
      <div className="stat-grid">
        <div className="stat">
          <div>
            <span>{t(lang, 'quantity')}</span>
            <strong>{number(num(p.data.quantity), lang)}</strong>
          </div>
        </div>
        <div className="stat">
          <div>
            <span>{text(lang, 'প্রেরিত গ্রস (টন)', 'Dispatched gross (tonnes)')}</span>
            <strong>{number(sent, lang)}</strong>
          </div>
        </div>
        <div className="stat">
          <div>
            <span>{text(lang, 'প্রাপ্ত গ্রস (টন)', 'Received gross (tonnes)')}</span>
            <strong>{number(received, lang)}</strong>
          </div>
        </div>
      </div>
      {received > 0 && Math.abs(received - num(p.data.quantity)) > 0.001 && (
        <div className="alert warning">
          <AlertCircle size={20} />
          {text(
            lang,
            'প্রাপ্ত পরিমাণ নির্ধারিত পরিমাণ থেকে আলাদা। যাচাই করে কাজ চালিয়ে যেতে পারবেন।',
            'Received quantity differs from the instruction. Review it; you can still proceed.',
          )}
        </div>
      )}
      <div className="button-row action-row">
        {(!p.data.closed || owner) && (
          <>
            {!billed && (
              <button
                className="button primary"
                onClick={() => open({ kind: 'dispatches', initial: { program_id: id } })}
              >
                <Plus size={18} />
                {t(lang, 'addTruck')}
              </button>
            )}
            <button
              className="button secondary"
              onClick={() =>
                open({ kind: 'expenses', initial: { program_id: id, scope: 'program' } })
              }
            >
              <Wallet size={18} />
              {t(lang, 'newExpense')}
            </button>
          </>
        )}
        {owner && p.data.closed && (
          <button className="button secondary" onClick={() => special('extra', id)}>
            <Plus size={18} />
            {t(lang, 'extra')}
          </button>
        )}
      </div>
      <Section
        title={text(lang, 'ট্রাক ও চালান', 'Trucks & invoices')}
        description={text(
          lang,
          'প্রতিটি ট্রাকের প্রেরণ এবং প্রাপ্তির তথ্য',
          'Dispatch and receiving information for each truck',
        )}
      >
        {ds.length ? (
          <div className="record-list">
            {ds.map((d) => (
              <div className="record" key={d.id}>
                <span className="record-icon">
                  <Truck size={23} />
                </span>
                <div className="record-main">
                  <b>
                    {str(d.data.invoice_no)} <span className="muted">{str(d.data.truck_no)}</span>
                  </b>
                  <small>
                    {date(str(d.data.sending_date), lang)} ·{' '}
                    {number(num(d.data.sending_gross), lang)}{' '}
                    {text(lang, 'টন গ্রস প্রেরিত', 'tonnes gross dispatched')}
                  </small>
                  {d.data.receiving_date && (
                    <small>
                      {number(num(d.data.receiving_gross), lang)}{' '}
                      {text(lang, 'টন গ্রস প্রাপ্ত', 'tonnes gross received')} · {t(lang, 'net')}:{' '}
                      {number(num(d.data.receiving_net), lang)} · {t(lang, 'bags')}:{' '}
                      {number(num(d.data.receiving_bags), lang)}
                    </small>
                  )}
                </div>
                <Badge tone={d.data.receiving_date ? 'green' : 'amber'}>
                  {t(lang, d.data.receiving_date ? 'received' : 'sent')}
                </Badge>
                {(!p.data.closed || owner) && (
                  <button
                    className="button secondary small-button"
                    onClick={() => open({ kind: 'dispatches', row: d })}
                  >
                    {d.data.receiving_date ? t(lang, 'edit') : t(lang, 'addReceiving')}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Section>
      <Section title={text(lang, 'এই প্রোগ্রামের খরচ', 'Program expenses')}>
        {es.length ? <ExpenseTable rows={es} open={open} /> : <Empty />}
      </Section>
      {owner && (
        <Section title={text(lang, 'প্রাপ্তি ও ফলাফল', 'Receipts & result')}>
          <div className="metric-row">
            <div>
              <span>{t(lang, 'income')}</span>
              <strong>{money(result.income, lang)}</strong>
            </div>
            <div>
              <span>{t(lang, 'spent')}</span>
              <strong>{money(result.cost, lang)}</strong>
            </div>
            <div>
              <span>{t(lang, 'profit')}</span>
              <strong className={result.profit < 0 ? 'negative' : 'positive'}>
                {money(result.profit, lang)}
              </strong>
            </div>
          </div>
          <p className="section-note">
            {text(
              lang,
              'শুধু এই প্রোগ্রামের খরচ ও প্রকৃত প্রাপ্ত টাকা। সাধারণ অফিস খরচ এখানে বরাদ্দ হয় না।',
              'Only this program’s costs and actual receipts. General office costs are not allocated here.',
            )}
          </p>
        </Section>
      )}
    </>
  );
}
export function Directory({
  kind,
  open,
}: {
  kind: 'firms' | 'staff' | 'expense_heads';
  open: Open;
}) {
  const { store, lang, workspace, demo, setNotice, refresh } = useApp();
  const [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const owner = workspace?.role === 'owner';
  const records = store[kind].filter((r) =>
    str(r.data.name).toLowerCase().includes(query.toLowerCase()),
  );
  const invite = async (r: Row) => {
    setBusy(r.id);
    setError('');
    try {
      if (demo)
        throw new Error(
          text(lang, 'নমুনা মোডে আমন্ত্রণ পাঠানো হয় না।', 'Invitations are not sent in demo mode.'),
        );
      if (!r.data.email)
        throw new Error(text(lang, 'আগে কর্মীর ইমেইল দিন।', 'Add the staff email first.'));
      const {
        data: { session },
      } = await supabase()!.auth.getSession();
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session?.access_token,
        },
        body: JSON.stringify({ staff_id: r.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      setNotice(text(lang, 'আমন্ত্রণ পাঠানো হয়েছে', 'Invitation sent'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <PageTitle
        title={t(lang, kind === 'expense_heads' ? 'heads' : kind)}
        description={
          kind === 'staff'
            ? text(
                lang,
                'এক কর্মী তালিকা, আপনার সকল ফার্মের জন্য',
                'One staff directory across all your firms',
              )
            : kind === 'expense_heads'
              ? text(
                  lang,
                  'খাত সাজান, প্রতিটি খরচ সহজে খুঁজুন',
                  'Organize heads so every expense is easy to find',
                )
              : text(
                  lang,
                  'ফার্ম বদলান উপরের নামের উপর চাপ দিয়ে',
                  'Tap the firm name above to switch firms',
                )
        }
        action={
          (owner || kind === 'expense_heads') && (
            <button className="button primary" onClick={() => open({ kind })}>
              <Plus size={19} />
              {t(lang, 'add')}
            </button>
          )
        }
      />
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder={text(lang, 'নাম খুঁজুন', 'Search names')}
      />
      {error && <div className="alert error">{error}</div>}
      <div className="directory-grid">
        {records.map((r) => (
          <div className="directory-card" key={r.id}>
            <div className="directory-icon">
              {kind === 'firms' ? <Building2 /> : kind === 'staff' ? <Users /> : <Tags />}
            </div>
            <div className="directory-title">
              <h2>{str(r.data.name)}</h2>
              <Badge tone={r.data.active === false ? 'slate' : 'green'}>
                {t(lang, r.data.active === false ? 'inactive' : 'active')}
              </Badge>
            </div>
            {r.data.address && <p>{str(r.data.address)}</p>}
            {r.data.phone && <p>{str(r.data.phone)}</p>}
            {r.data.email && <p className="break-word">{str(r.data.email)}</p>}
            {kind === 'staff' && owner && (
              <div className="staff-card-balance">
                <span>{t(lang, 'balance')}</span>
                <b>{money(balance(store, r.id), lang)}</b>
              </div>
            )}
            <div className="button-row">
              {owner && (
                <button className="button secondary" onClick={() => open({ kind, row: r })}>
                  <Edit3 size={16} />
                  {t(lang, 'edit')}
                </button>
              )}
              {kind === 'staff' && owner && (
                <button
                  className="button secondary"
                  disabled={busy === r.id || r.data.active === false}
                  onClick={() => invite(r)}
                >
                  <Mail size={16} />
                  {t(lang, 'invite')}
                </button>
              )}
              {kind === 'staff' && (
                <Link className="text-button" href={'/?view=money&staff=' + r.id}>
                  {text(lang, 'খাতা দেখুন', 'View statement')}
                  <ChevronRight size={17} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {!records.length && <Empty />}
    </>
  );
}
export function ExpenseTable({ rows, open }: { rows: Row[]; open?: Open }) {
  const { store, lang, workspace } = useApp();
  return (
    <>
      <div className="mobile-expense-list">
        {rows.map((r) => (
          <div className="mobile-expense" key={r.id}>
            <div>
              <b>{str(r.data.reason)}</b>
              <small>
                {date(str(r.data.date), lang)} ·{' '}
                {str(store.expense_heads.find((h) => h.id === r.data.head_id)?.data.name)}
              </small>
              <small>
                {str(store.programs.find((p) => p.id === r.data.program_id)?.data.number) ||
                  t(lang, r.data.scope === 'firm' ? 'firmExpense' : 'orgExpense')}{' '}
                ·{' '}
                {str(store.staff.find((s) => s.id === r.data.staff_id)?.data.name) ||
                  t(lang, 'self')}
              </small>
              <strong>{money(num(r.data.amount), lang)}</strong>
            </div>
            {open &&
              (workspace?.role === 'owner' ||
                !store.programs.find((p) => p.id === r.data.program_id)?.data.closed) && (
                <button
                  className="icon-button"
                  aria-label={t(lang, 'edit')}
                  onClick={() => open({ kind: 'expenses', row: r })}
                >
                  <Edit3 size={19} />
                </button>
              )}
          </div>
        ))}
      </div>
      <div className="table-scroll desktop-expense-table">
        <table>
          <thead>
            <tr>
              <th>{t(lang, 'date')}</th>
              <th>{t(lang, 'reason')}</th>
              <th>{t(lang, 'head')}</th>
              <th>{t(lang, 'spender')}</th>
              <th className="right">{t(lang, 'amount')}</th>
              {open && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{date(str(r.data.date), lang)}</td>
                <td>
                  <b>{str(r.data.reason)}</b>
                  <small>
                    {str(store.programs.find((p) => p.id === r.data.program_id)?.data.number) ||
                      t(lang, r.data.scope === 'firm' ? 'firmExpense' : 'orgExpense')}
                  </small>
                </td>
                <td>{str(store.expense_heads.find((h) => h.id === r.data.head_id)?.data.name)}</td>
                <td>
                  {str(store.staff.find((s) => s.id === r.data.staff_id)?.data.name) ||
                    t(lang, 'self')}
                </td>
                <td className="right nowrap">
                  <b>{money(num(r.data.amount), lang)}</b>
                </td>
                {open && (
                  <td>
                    {(workspace?.role === 'owner' ||
                      !store.programs.find((p) => p.id === r.data.program_id)?.data.closed) && (
                      <button
                        className="icon-button"
                        onClick={() => open({ kind: 'expenses', row: r })}
                        aria-label={t(lang, 'edit')}
                      >
                        <Edit3 size={18} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function Expenses({ open }: { open: Open }) {
  const { store, lang, firm } = useApp();
  const [q, setQ] = useState(''),
    [head, setHead] = useState(''),
    [staff, setStaff] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const rows = store.expenses.filter(
    (e) =>
      (!firm || e.data.firm_id === firm) &&
      (!head || e.data.head_id === head) &&
      (!staff || e.data.staff_id === staff) &&
      (!from || str(e.data.date) >= from) &&
      (!to || str(e.data.date) <= to) &&
      str(e.data.reason).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title={text(lang, 'খরচের খাতা', 'Expense ledger')}
        description={text(
          lang,
          'প্রোগ্রাম, ফার্ম ও অফিসের প্রতিটি খরচ',
          'Every program, firm and office expense',
        )}
        action={
          <button className="button primary" onClick={() => open({ kind: 'expenses' })}>
            <Plus size={20} />
            {t(lang, 'newExpense')}
          </button>
        }
      />
      <div className="filterbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={text(lang, 'খরচের বিবরণ খুঁজুন', 'Search expense descriptions')}
        />
        <select aria-label={t(lang, 'head')} value={head} onChange={(e) => setHead(e.target.value)}>
          <option value="">{text(lang, 'সব খাত', 'All heads')}</option>
          {store.expense_heads.map((h) => (
            <option key={h.id} value={h.id}>
              {str(h.data.name)}
            </option>
          ))}
        </select>
        <select
          aria-label={t(lang, 'staff')}
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
        >
          <option value="">{text(lang, 'সকল কর্মী / নিজে', 'All staff / self')}</option>
          {store.staff.map((h) => (
            <option key={h.id} value={h.id}>
              {str(h.data.name)}
            </option>
          ))}
        </select>
      </div>
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
      <Section
        title={text(lang, 'নির্বাচিত খরচ', 'Selected expenses')}
        action={
          <strong>
            {money(
              rows.reduce((s, r) => s + num(r.data.amount), 0),
              lang,
            )}
          </strong>
        }
      >
        {rows.length ? <ExpenseTable rows={rows} open={open} /> : <Empty />}
      </Section>
    </>
  );
}
export function StaffMoney({ open }: { open: Open }) {
  const { store, lang, reportLang, workspace, demo, save, refresh } = useApp();
  const owner = workspace?.role === 'owner';
  const [selected, setSelected] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(location.search).get('staff') || '',
  );
  const staff = owner ? store.staff : store.staff.filter((s) => s.id === workspace?.staff_id);
  const id = owner ? selected || staff[0]?.id || '' : workspace?.staff_id || '';
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [error, setError] = useState('');
  const all = staffStatement(store, id),
    rows = all.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  const opening = from
    ? balance(
        store,
        id,
        new Date(new Date(from + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10),
      )
    : 0;
  const reverse = async (movementId: string) => {
    const reason = prompt(
      text(
        lang,
        'সংশোধনের কারণ লিখুন। উল্টো এন্ট্রি হবে, পুরনো তথ্য থাকবে।',
        'Reason for reversal. A compensating entry will retain the original.',
      ),
    );
    if (!reason) return;
    try {
      const r = store.money_movements.find((r) => r.id === movementId)!;
      if (demo) {
        const d: Data = { ...r.data, date: today(), reason, reverses: r.id };
        if (r.data.type === 'transfer') {
          d.staff_id = str(r.data.to_staff_id);
          d.to_staff_id = str(r.data.staff_id);
        } else if (r.data.type === 'opening') d.amount = -num(r.data.amount);
        else d.type = r.data.type === 'give' ? 'return' : 'give';
        await save('money_movements', d);
      } else {
        const { error } = await supabase()!.rpc('reverse_money', {
          movement_id: movementId,
          reason,
          business_date: today(),
        });
        if (error) throw error;
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const download = async (f: 'pdf' | 'csv' | 'xlsx') => {
    const l = reportLang;
    try {
      await exportRows(
        f,
        text(l, 'কর্মীর খাতা', 'Staff statement'),
        [
          t(l, 'date'),
          t(l, 'reason'),
          text(l, 'জমা', 'Money in'),
          text(l, 'খরচ / ফেরত', 'Money out'),
          t(l, 'balance'),
        ],
        rows.map((r) => [r.date, r.description, r.in, r.out, r.balance]),
        {
          subtitle:
            str(staff.find((s) => s.id === id)?.data.name) +
            '\n' +
            text(l, 'শুরুর জের: ', 'Opening balance: ') +
            money(opening, l),
          total: money(balance(store, id, to || undefined), l),
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <>
      <PageTitle
        title={t(lang, 'money')}
        description={text(
          lang,
          'অগ্রিম, খরচ, ফেরত ও হাতে থাকা টাকা',
          'Advances, expenses, returns and money held',
        )}
        action={
          owner && (
            <button
              className="button primary"
              onClick={() => open({ kind: 'money_movements', initial: { staff_id: id } })}
            >
              <Plus size={19} />
              {t(lang, 'add')}
            </button>
          )
        }
      />
      <div className="filterbar">
        <select
          aria-label={t(lang, 'staff')}
          value={id}
          onChange={(e) => setSelected(e.target.value)}
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {str(s.data.name)}
            </option>
          ))}
        </select>
        <label className="field compact">
          <span>{t(lang, 'from')}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field compact">
          <span>{t(lang, 'to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <div>
            <span>{text(lang, 'সময় শুরুর জের', 'Opening balance for range')}</span>
            <strong>{money(opening, lang)}</strong>
          </div>
        </div>
        <div className="stat">
          <div>
            <span>{text(lang, 'নির্বাচিত সময়ের খরচ / ফেরত', 'Spent / returned in range')}</span>
            <strong>
              {money(
                rows.reduce((s, r) => s + r.out, 0),
                lang,
              )}
            </strong>
          </div>
        </div>
        <div className="stat">
          <div>
            <span>
              {to ? text(lang, 'শেষ তারিখের জের', 'Balance at end date') : t(lang, 'balance')}
            </span>
            <strong className={balance(store, id, to || undefined) < 0 ? 'negative' : 'positive'}>
              {money(balance(store, id, to || undefined), lang)}
            </strong>
          </div>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <Section
        title={text(lang, 'লেনদেনের বিবরণ', 'Statement')}
        description={text(
          lang,
          'ধনাত্মক জের = কর্মীর হাতে আছে। ঋণাত্মক জের = কর্মী টাকা পাবেন।',
          'Positive = money held. Negative = money owed to the staff member.',
        )}
        action={
          <div className="button-row">
            {['pdf', 'csv', 'xlsx'].map((f) => (
              <button
                key={f}
                className="button secondary small-button"
                onClick={() => download(f as 'pdf')}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        }
      >
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t(lang, 'date')}</th>
                  <th>{t(lang, 'reason')}</th>
                  <th className="right">{text(lang, 'জমা', 'Money in')}</th>
                  <th className="right">{text(lang, 'খরচ / ফেরত', 'Money out')}</th>
                  <th className="right">{t(lang, 'balance')}</th>
                  {owner && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{date(r.date, lang)}</td>
                    <td>{r.description}</td>
                    <td className="right positive">{r.in ? money(r.in, lang) : '—'}</td>
                    <td className="right">{r.out ? money(r.out, lang) : '—'}</td>
                    <td className="right">
                      <b>{money(r.balance, lang)}</b>
                    </td>
                    {owner && (
                      <td>
                        {r.movement_id &&
                          !store.money_movements.find((m) => m.id === r.movement_id)?.data
                            .reverses &&
                          !store.money_movements.some((m) => m.data.reverses === r.movement_id) && (
                            <button className="text-button" onClick={() => reverse(r.movement_id!)}>
                              {text(lang, 'উল্টো এন্ট্রি', 'Reverse')}
                            </button>
                          )}
                      </td>
                    )}
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
export function MorePage({ accounts = false }: { accounts?: boolean }) {
  const { lang, workspace } = useApp();
  const owner = workspace?.role === 'owner';
  const items = accounts
    ? [
        ['expenses', 'expenses', Wallet],
        ['money', 'money', Users],
        ...(owner
          ? [
              ['bills', 'bills', Files],
              ['reports', 'reports', ChartNoAxesCombined],
            ]
          : []),
      ]
    : [
        ['firms', 'firms', Building2],
        ['staff', 'staff', Users],
        ['expense_heads', 'heads', Tags],
        ...(owner
          ? [
              ['register', 'register', BookOpen],
              ['history', 'history', History],
            ]
          : []),
        ['settings', 'settings', Settings],
      ];
  return (
    <>
      <PageTitle
        title={t(lang, accounts ? 'accounts' : 'more')}
        description={text(lang, 'যে কাজটি করতে চান, নির্বাচন করুন', 'Choose what you want to do')}
      />
      <div className="menu-grid">
        {items.map(([key, label, Icon]) => {
          const I = Icon as typeof Wallet;
          return (
            <Link className="menu-tile" href={'/?view=' + key} key={str(key)}>
              <span className="stat-icon green">
                <I size={25} />
              </span>
              <h2>{t(lang, label as 'accounts')}</h2>
              <ChevronRight size={21} />
            </Link>
          );
        })}
      </div>
    </>
  );
}
export function SettingsPage() {
  const app = useApp();
  const {
    lang,
    reportLang,
    setReportLang,
    setLang,
    large,
    setLarge,
    fiscal,
    setFiscal,
    pending,
    retry,
    workspace,
    demo,
  } = app;
  const [error, setError] = useState(''),
    [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  useEffect(() => {
    const listener = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', listener);
    return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);
  const linkGoogle = async () => {
    if (demo) {
      setError(
        text(lang, 'লাইভ অ্যাকাউন্টে এই সুবিধা পাওয়া যাবে।', 'Connect Google from a live account.'),
      );
      return;
    }
    const { error } = await supabase()!.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: location.origin + '/auth/callback' },
    });
    if (error) setError(error.message);
  };
  return (
    <>
      <PageTitle
        title={t(lang, 'settings')}
        description={text(
          lang,
          'আপনার জন্য আরামদায়ক করে নিন',
          'Make the workspace comfortable for you',
        )}
      />
      {error && <div className="alert error">{error}</div>}
      <Section title={text(lang, 'ভাষা ও লেখা', 'Language & reading')}>
        <div className="settings-row">
          <label htmlFor="language">{t(lang, 'language')}</label>
          <select id="language" value={lang} onChange={(e) => setLang(e.target.value as 'bn')}>
            <option value="bn">বাংলা</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="report-language">{t(lang, 'reportLanguage')}</label>
          <select
            id="report-language"
            value={reportLang}
            onChange={(e) => setReportLang(e.target.value as 'bn')}
          >
            <option value="bn">বাংলা</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="text-size">{t(lang, 'largeText')}</label>
          <input
            id="text-size"
            className="checkbox"
            type="checkbox"
            checked={large}
            onChange={(e) => setLarge(e.target.checked)}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="fiscal-month">{t(lang, 'fiscal')}</label>
          <select
            id="fiscal-month"
            disabled={workspace?.role !== 'owner'}
            value={fiscal}
            onChange={(e) => setFiscal(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option value={i + 1} key={i}>
                {new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en', { month: 'long' }).format(
                  new Date(2026, i, 1),
                )}
              </option>
            ))}
          </select>
        </div>
      </Section>
      <Section title={text(lang, 'ফোনে অ্যাপ ও সিঙ্ক', 'Installation & sync')}>
        <div className="settings-row">
          <p>
            {text(
              lang,
              'অফলাইনে প্রোগ্রাম, চালান ও খরচ লিখুন। বিল ও টাকা প্রাপ্তি অনলাইনে সম্পন্ন করুন।',
              'Enter programs, dispatches and expenses offline. Finalize bills and receipts online.',
            )}
          </p>
          <button className="button secondary" onClick={() => app.sync()}>
            <RefreshCw size={18} />
            {t(lang, 'sync')}
          </button>
        </div>
        {pending.map((op) => (
          <div className="sync-row" key={op.id}>
            <div>
              <b>{op.kind}</b>
              <p>{op.error || t(lang, 'offline')}</p>
              <p>
                {str(op.data.reason) || str(op.data.number) || str(op.data.invoice_no)}{' '}
                {op.data.amount ? money(num(op.data.amount), lang) : ''}
              </p>
              <small>
                {text(
                  lang,
                  'তথ্য ফোনে রাখা আছে। ত্রুটি ঠিক করে আবার চেষ্টা করুন।',
                  'Your entry stays on this phone. Correct the problem and retry.',
                )}
              </small>
            </div>
            <div className="button-row">
              <button className="button secondary" onClick={() => retry(op.id)}>
                {t(lang, 'retry')}
              </button>
              {op.status === 'conflict' && (
                <>
                  <button
                    className="button secondary"
                    onClick={() => {
                      if (
                        confirm(
                          text(
                            lang,
                            'সার্ভারের সর্বশেষ তথ্যের উপর আপনার এন্ট্রি প্রয়োগ করবেন? আগে তথ্য ও ত্রুটি যাচাই করুন।',
                            'Apply your entry over the latest server version? Review the entry and error first.',
                          ),
                        )
                      )
                        void app.resolve(op.id, true).catch((e) => setError(e.message));
                    }}
                  >
                    {text(lang, 'আমার এন্ট্রি প্রয়োগ', 'Apply my entry')}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        confirm(
                          text(
                            lang,
                            'এই অপেক্ষমাণ এন্ট্রি বাদ দিয়ে সার্ভারের তথ্য রাখবেন?',
                            'Discard this pending entry and keep server data?',
                          ),
                        )
                      )
                        void app.resolve(op.id, false).catch((e) => setError(e.message));
                    }}
                  >
                    {text(lang, 'সার্ভারের তথ্য রাখুন', 'Keep server data')}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        <div className="settings-row">
          <p>
            {text(
              lang,
              'iPhone: Safari শেয়ার মেনু থেকে “Add to Home Screen”। Android: ব্রাউজারের মেনু থেকে “Install app”।',
              'iPhone: Safari Share → Add to Home Screen. Android: browser menu → Install app.',
            )}
          </p>
          {installPrompt && (
            <button className="button primary" onClick={() => installPrompt.prompt()}>
              <Download size={18} />
              {t(lang, 'install')}
            </button>
          )}
        </div>
      </Section>
      <Section title={text(lang, 'অ্যাকাউন্ট', 'Account')}>
        <p>{workspace?.email}</p>
        <div className="button-row">
          <button className="button secondary" onClick={linkGoogle}>
            <Link2 size={18} />
            {text(lang, 'Google সংযুক্ত করুন', 'Connect Google')}
          </button>
          <button
            className="button secondary"
            onClick={() => app.exit().catch((e) => setError(e.message))}
          >
            <LogOut size={18} />
            {t(lang, 'logout')}
          </button>
        </div>
      </Section>
      <Section title={t(lang, 'help')}>
        <ol className="help-steps">
          <li>
            {text(lang, 'মালিক ফার্ম ও প্রোগ্রাম তৈরি করবেন।', 'Owner creates a firm and program.')}
          </li>
          <li>
            {text(
              lang,
              'প্রোগ্রাম খুলে ট্রাক ও প্রাপ্তির তথ্য দিন।',
              'Open the program to add trucks and receiving information.',
            )}
          </li>
          <li>
            {text(
              lang,
              'খরচের খাত, টাকা ও কে খরচ করেছেন লিখুন।',
              'Record the head, amount and spending person.',
            )}
          </li>
          <li>
            {text(
              lang,
              'মালিক প্রাপ্ত প্রোগ্রাম নিয়ে বিল ও টাকা প্রাপ্তি সম্পন্ন করবেন।',
              'Owner bills received programs and records the actual receipt.',
            )}
          </li>
        </ol>
      </Section>
    </>
  );
}
export function HistoryPage() {
  const { lang, demo, workspace, store } = useApp();
  const [rows, setRows] = useState<Data[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    if (demo) {
      readCache<Data[]>('demo-audit').then((r) => setRows(r || []));
      return;
    }
    supabase()
      ?.from('audit_events')
      .select('*')
      .eq('org_id', workspace!.org_id)
      .order('created_at', { ascending: false })
      .limit(250)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRows(data || []);
      });
  }, [demo, workspace]);
  return (
    <>
      <PageTitle
        title={t(lang, 'history')}
        description={text(
          lang,
          'সাম্প্রতিক ২৫০টি পরিবর্তন; পূর্ণ ইতিহাস ডেটাবেসে সংরক্ষিত',
          'Latest 250 changes; full history is retained in the database',
        )}
      />
      {error && <div className="alert error">{error}</div>}
      <Section title={text(lang, 'কে কখন কী পরিবর্তন করেছেন', 'Who changed what, and when')}>
        {rows.length ? (
          <div className="record-list">
            {rows.map((r, i) => (
              <details className="audit-row" key={i}>
                <summary>
                  <b>
                    {str(r.entity)} · {str(r.action)}
                  </b>
                  <span>{date(str(r.created_at), lang)}</span>
                  <small>
                    {str(r.actor_id) === workspace?.user_id
                      ? workspace.name
                      : str(
                          store.staff.find((s) => s.data.login_user_id === r.actor_id)?.data.name,
                        ) || str(r.actor_id).slice(0, 8)}{' '}
                    · {str(r.reason) || text(lang, 'নতুন এন্ট্রি', 'New entry')}
                  </small>
                </summary>
                <pre>{JSON.stringify({ before: r.old_data, after: r.new_data }, null, 2)}</pre>
              </details>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Section>
    </>
  );
}
