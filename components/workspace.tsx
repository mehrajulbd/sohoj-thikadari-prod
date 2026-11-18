'use client';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Wheat,
  House,
  Truck,
  Wallet,
  Grid2X2,
  Search,
  ChevronDown,
  Plus,
  RefreshCw,
  WifiOff,
  LogOut,
  Check,
  Menu,
  X,
  Building2,
  Users,
  ChartNoAxesCombined,
  Files,
  Settings,
  BookOpen,
  ArrowUpRight,
  LoaderCircle,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '@/lib/provider';
import { t, text, date, number } from '@/lib/i18n';
import { type Kind, type Data, type Row, str, num, today } from '@/lib/types';
import { normalizePhone } from '@/lib/phone';
import { Auth } from './auth';
import { Editor, type Field, Modal, optionRows, SearchBox } from './ui';
import {
  Dashboard,
  Programs,
  ProgramDetail,
  Directory,
  Expenses,
  StaffMoney,
  SettingsPage,
  MorePage,
  HistoryPage,
} from './pages';
import { Bills, BillBuilder, Settlement, ExtraReceipt } from './billing';
import { Reports, Register } from './reports';
export interface OpenForm {
  kind: Kind;
  row?: Row;
  initial?: Data;
}
export type Open = (form: OpenForm) => void;
export function WorkspaceApp() {
  const app = useApp();
  const {
    workspace,
    lang,
    setLang,
    store,
    firm,
    setFirm,
    loading,
    large,
    online,
    pending,
    demo,
    notice,
    setNotice,
  } = app;
  const params = useSearchParams(),
    router = useRouter();
  const view = params.get('view') || 'home';
  const id = params.get('id') || '';
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, id, workspace?.user_id]);
  const [form, setForm] = useState<OpenForm | null>(null),
    [switcher, setSwitcher] = useState(false),
    [firmQuery, setFirmQuery] = useState(''),
    [special, setSpecial] = useState(''),
    [specialId, setSpecialId] = useState(''),
    [banner, setBanner] = useState('');
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [notice, setNotice]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  if (loading)
    return (
      <div className="loading-screen">
        <Wheat size={40} />
        <LoaderCircle className="spin" />
        <p>{t(lang, 'loading')}</p>
      </div>
    );
  if (!workspace) return <Auth />;
  const owner = workspace.role === 'owner';
  const ownerOnly = ['bills', 'reports', 'register', 'history'].includes(view);
  const safeView = ownerOnly && !owner ? 'home' : view;
  const go = (page: string) => router.push('/?view=' + page);
  const open: Open = (f) => setForm(f);
  const showSpecial = (name: string, recordId = '') => {
    setSpecial(name);
    setSpecialId(recordId);
  };
  const currentFirm = store.firms.find((f) => f.id === firm);
  const primary = [
    { key: 'home', icon: House, label: 'home' },
    { key: 'programs', icon: Truck, label: 'programs' },
    { key: owner ? 'accounts' : 'expenses', icon: Wallet, label: owner ? 'accounts' : 'expenses' },
    { key: 'more', icon: Grid2X2, label: 'more' },
  ] as const;
  const secondary = owner
    ? [
        { key: 'bills', label: 'bills', icon: Files },
        { key: 'staff', label: 'staff', icon: Users },
        { key: 'reports', label: 'reports', icon: ChartNoAxesCombined },
        { key: 'register', label: 'register', icon: BookOpen },
      ]
    : [{ key: 'money', label: 'balance', icon: Wallet }];
  let fields: Field[] = [];
  let title = '';
  let initial: Data = form?.initial || {};
  if (form) {
    const required = (
      key: string,
      label: string,
      type: Field['type'] = 'text',
      options?: Field['options'],
    ): Field => ({ key, label, type, required: true, options });
    if (form.kind === 'firms') {
      title = t(lang, 'firms');
      fields = [
        required('name', 'name'),
        { key: 'proprietor', label: text(lang, 'স্বত্বাধিকারী', 'Proprietor') },
        { key: 'reg_no', label: text(lang, 'রেজিস্ট্রেশন নম্বর', 'Registration number') },
        { key: 'trade_license', label: text(lang, 'ট্রেড লাইসেন্স', 'Trade license') },
        { key: 'phone', label: 'phone' },
        { key: 'email', label: 'email', type: 'email' },
        { key: 'address', label: text(lang, 'ঠিকানা', 'Address'), type: 'textarea' },
        { key: 'active', label: 'active', type: 'checkbox' },
      ];
      initial = { active: true, ...initial };
    }
    if (form.kind === 'staff') {
      title = t(lang, 'staff');
      fields = [
        required('name', 'name'),
        required('phone', 'phone'),
        {
          key: 'email',
          label: 'email',
          type: 'email',
          hint: text(lang, 'লগইন চালু করতে ইমেইল প্রয়োজন', 'Email is required to enable login'),
        },
        { key: 'active', label: 'active', type: 'checkbox' },
      ];
      initial = { active: true, ...initial };
    }
    if (form.kind === 'expense_heads') {
      title = t(lang, 'heads');
      fields = [required('name', 'name'), { key: 'active', label: 'active', type: 'checkbox' }];
      initial = { active: true, ...initial };
    }
    if (form.kind === 'programs') {
      title = form.row ? t(lang, 'edit') : t(lang, 'newProgram');
      fields = [
        required('firm_id', 'firm', 'select', optionRows(store.firms)),
        required('number', 'programNo'),
        required('date', 'date', 'date'),
        required('commodity', 'commodity', 'select', [
          { value: 'চাল', label: text(lang, 'চাল', 'Rice') },
          { value: 'গম', label: text(lang, 'গম', 'Wheat') },
          { value: 'বস্তা', label: text(lang, 'বস্তা', 'Sacks') },
          { value: 'অন্যান্য', label: text(lang, 'অন্যান্য', 'Other') },
        ]),
        required('sending', 'sending'),
        required('receiving', 'destination'),
        { ...required('quantity', 'quantity', 'number'), min: 0.001 },
        {
          key: 'staff_id',
          label: text(lang, 'দায়িত্বে থাকা কর্মী (ঐচ্ছিক)', 'Responsible staff (optional)'),
          type: 'select',
          options: optionRows(store.staff),
        },
      ];
      initial = {
        firm_id: firm || store.firms[0]?.id || '',
        date: today(),
        closed: false,
        ...initial,
      };
    }
    if (form.kind === 'dispatches') {
      title = form.row ? t(lang, 'addReceiving') : t(lang, 'addTruck');
      fields = [
        required('program_id', 'program', 'select', optionRows(store.programs, 'number')),
        required('invoice_no', 'invoiceNo'),
        required('truck_no', 'truck'),
        required('sending_date', text(lang, 'প্রেরণের তারিখ', 'Dispatch date'), 'date'),
        required('sending_bags', 'bags', 'number'),
        required('sending_net', 'net', 'number'),
        required('sending_gross', 'gross', 'number'),
      ];
      if (form.row)
        fields.push(
          required('receiving_date', text(lang, 'প্রাপ্তির তারিখ', 'Receiving date'), 'date'),
          required('receiving_bags', text(lang, 'প্রাপ্ত নেট বস্তা', 'Received net bags'), 'number'),
          required(
            'receiving_gross_bags',
            text(lang, 'প্রাপ্ত গ্রস বস্তা', 'Received gross bags'),
            'number',
          ),
          required(
            'receiving_net',
            text(lang, 'প্রাপ্ত নেট ওজন (টন)', 'Received net weight (tonnes)'),
            'number',
          ),
          required(
            'receiving_gross',
            text(lang, 'প্রাপ্ত গ্রস ওজন (টন)', 'Received gross weight (tonnes)'),
            'number',
          ),
          { key: 'shortage', label: text(lang, 'ঘাটতি (টন)', 'Shortage (tonnes)'), type: 'number' },
        );
      initial = { sending_date: today(), ...initial };
    }
    if (form.kind === 'expenses') {
      title = t(lang, 'newExpense');
      fields = [
        required('scope', 'scope', 'select', [
          { value: 'program', label: t(lang, 'programExpense') },
          { value: 'firm', label: t(lang, 'firmExpense') },
          { value: 'organization', label: t(lang, 'orgExpense') },
        ]),
        {
          ...required('firm_id', 'firm', 'select', optionRows(store.firms)),
          show: (d) => d.scope === 'firm',
        },
        {
          ...required('program_id', 'program', 'select', optionRows(store.programs, 'number')),
          show: (d) => d.scope === 'program',
        },
        required('head_id', 'head', 'select', optionRows(store.expense_heads)),
        {
          key: 'staff_id',
          label: 'spender',
          type: 'select',
          required: !owner,
          options: owner
            ? [{ value: 'self', label: t(lang, 'self') }, ...optionRows(store.staff)]
            : optionRows(store.staff.filter((s) => s.id === workspace.staff_id)),
        },
        required('date', 'date', 'date'),
        { ...required('amount', 'amount', 'number'), min: 0.01 },
        required('reason', 'reason', 'textarea'),
      ];
      initial = {
        scope: 'program',
        date: today(),
        staff_id: owner ? 'self' : workspace.staff_id,
        firm_id: firm,
        ...initial,
      };
    }
    if (form.kind === 'bills') {
      title = text(lang, 'সরকারি বিল নম্বর', 'Government reference');
      fields = [
        {
          key: 'govt_number',
          label: text(lang, 'সরকারি বিল নম্বর', 'Government bill number'),
          required: true,
        },
        {
          key: 'govt_date',
          label: text(lang, 'সরকারি বিলের তারিখ', 'Government bill date'),
          type: 'date',
          required: true,
        },
      ];
    }
    if (form.kind === 'money_movements') {
      title = t(lang, 'money');
      fields = [
        required(
          'type',
          text(lang, 'লেনদেনের ধরন', 'Movement type'),
          'select',
          ['give', 'return', 'transfer', 'opening'].map((v) => ({
            value: v,
            label: t(lang, v as 'give'),
          })),
        ),
        required('staff_id', 'staff', 'select', optionRows(store.staff)),
        {
          ...required(
            'to_staff_id',
            text(lang, 'যে কর্মী টাকা পাবেন', 'Receiving staff'),
            'select',
            optionRows(store.staff),
          ),
          show: (d) => d.type === 'transfer',
        },
        required('date', 'date', 'date'),
        required('amount', 'amount', 'number'),
        required('reason', 'reason', 'textarea'),
      ];
      initial = { type: 'give', date: today(), ...initial };
    }
  }
  const submit = async (data: Data, reason: string) => {
    if (!form) return;
    if (data.staff_id === 'self') data.staff_id = '';
    if (data.phone) data.phone = normalizePhone(str(data.phone));
    const ref =
      form.kind === 'programs' ? 'number' : form.kind === 'dispatches' ? 'invoice_no' : null;
    if (
      ref &&
      store[form.kind].some((r) => r.id !== form.row?.id && str(r.data[ref]) === str(data[ref])) &&
      !confirm(
        text(
          lang,
          'এই নম্বর আগে আছে। তবুও সংরক্ষণ করবেন?',
          'This number already exists. Save another entry with the same number?',
        ),
      )
    )
      return;
    if (
      form.kind === 'dispatches' &&
      num(data.receiving_gross) > num(data.sending_gross) &&
      !confirm(
        text(
          lang,
          'প্রাপ্ত ওজন প্রেরিত ওজনের বেশি। তথ্য ঠিক আছে?',
          'Received weight exceeds dispatched weight. Is this correct?',
        ),
      )
    )
      throw new Error(text(lang, 'ওজন যাচাই করুন', 'Review the weights'));
    await app.save(form.kind, data, form.row, reason);
  };
  return (
    <div className={'app-shell ' + (large ? 'large-text' : '')}>
      <a className="skip-link" href="#main">
        {text(lang, 'মূল অংশে যান', 'Skip to content')}
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Wheat />
          </span>
          <span>
            সহজ ঠিকাদারি<small>Sohoz Thikadari</small>
          </span>
        </Link>
        <div className="workspace-caption">{text(lang, 'আপনার কর্মক্ষেত্র', 'Your workspace')}</div>
        <nav aria-label={text(lang, 'মূল নেভিগেশন', 'Main navigation')}>
          {primary.map((n) => (
            <Link
              key={n.key}
              href={'/?view=' + n.key}
              className={
                'nav-item ' +
                (safeView === n.key || (n.key === 'programs' && safeView === 'program')
                  ? 'active'
                  : '')
              }
            >
              <n.icon size={21} />
              {t(lang, n.label)}
              {n.key === 'programs' && (
                <span className="nav-count">
                  {number(store.programs.filter((p) => !p.data.closed).length, lang)}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        <nav>
          {secondary.map((n) => (
            <Link
              key={n.key}
              href={'/?view=' + n.key}
              className={'nav-item ' + (safeView === n.key ? 'active' : '')}
            >
              <n.icon size={20} />
              {t(lang, n.label as 'bills')}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-box">
            <Wheat size={21} />
            <b>{text(lang, 'সহজে কাজ করুন', 'Keep work simple')}</b>
            <p>
              {text(
                lang,
                'প্রথমে প্রোগ্রাম, তারপর চালান, খরচ ও বিল।',
                'Start with a program. Add dispatches, expenses and a bill.',
              )}
            </p>
            <button className="text-button" onClick={() => go('settings')}>
              {t(lang, 'help')} <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="nav-item" onClick={() => go('settings')}>
            <Settings size={20} />
            {t(lang, 'settings')}
          </button>
          <div className="profile">
            <span className="avatar">{workspace.name.slice(0, 1)}</span>
            <div>
              <b>{workspace.name}</b>
              <small>{t(lang, owner ? 'owner' : 'staff')}</small>
            </div>
            <button
              className="icon-button"
              aria-label={t(lang, 'logout')}
              onClick={() => app.exit().catch((e) => setBanner(e.message))}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button className="firm-switcher" onClick={() => setSwitcher(true)}>
            <span className="firm-icon">
              <Building2 size={21} />
            </span>
            <span>
              <small>{text(lang, 'বর্তমান ফার্ম', 'Current firm')}</small>
              <b>{currentFirm ? str(currentFirm.data.name) : t(lang, 'allFirms')}</b>
            </span>
            <ChevronDown size={18} />
          </button>
          <div className="topbar-right">
            <button
              className={'sync-indicator ' + (!online ? 'offline' : '')}
              onClick={() => go('settings')}
            >
              <span className="status-dot" />
              {!online
                ? t(lang, 'offline')
                : pending.length
                  ? text(lang, `${pending.length}টি সিঙ্ক বাকি`, `${pending.length} waiting to sync`)
                  : t(lang, 'online')}
            </button>
            <button
              className="language-button"
              onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            >
              {lang === 'bn' ? 'English' : 'বাংলা'}
            </button>
            <span className="avatar small">{workspace.name.slice(0, 1)}</span>
          </div>
        </header>
        {(!online || pending.length > 0) && (
          <Link href="/?view=settings" className="mobile-sync">
            <WifiOff size={16} />
            {!online
              ? t(lang, 'offline')
              : text(
                  lang,
                  `${pending.length}টি এন্ট্রি সিঙ্ক বাকি`,
                  `${pending.length} entries waiting to sync`,
                )}
            <ChevronDown size={16} />
          </Link>
        )}
        {demo && (
          <div className="demo-strip">
            {t(lang, 'demoLabel')}
            <button onClick={() => app.exit()}>{t(lang, 'logout')}</button>
          </div>
        )}
        {app.error && (
          <div className="alert error" role="alert">
            <AlertCircle size={19} />
            {app.error}
            <button className="button secondary" onClick={() => app.sync()}>
              {t(lang, 'retry')}
            </button>
          </div>
        )}
        {banner && (
          <div className="alert error">
            <AlertCircle size={19} />
            {banner}
            <button className="icon-button" onClick={() => setBanner('')}>
              <X size={18} />
            </button>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {safeView === 'home' ? (
            <Dashboard open={open} special={showSpecial} />
          ) : safeView === 'programs' ? (
            <Programs open={open} />
          ) : safeView === 'program' ? (
            <ProgramDetail id={id} open={open} special={showSpecial} />
          ) : ['firms', 'staff', 'expense_heads'].includes(safeView) ? (
            <Directory kind={safeView as 'firms' | 'staff' | 'expense_heads'} open={open} />
          ) : safeView === 'expenses' ? (
            <Expenses open={open} />
          ) : safeView === 'money' ? (
            <StaffMoney open={open} />
          ) : safeView === 'bills' ? (
            <Bills special={showSpecial} open={open} />
          ) : safeView === 'reports' ? (
            <Reports />
          ) : safeView === 'register' ? (
            <Register />
          ) : safeView === 'settings' ? (
            <SettingsPage />
          ) : safeView === 'history' ? (
            <HistoryPage />
          ) : safeView === 'accounts' ? (
            <MorePage accounts />
          ) : (
            <MorePage />
          )}
        </main>
        <footer className="app-footer">
          সহজ ঠিকাদারি{' '}
          <span>{text(lang, 'প্রতিটি কাজের পরিষ্কার হিসাব', 'A clear account of every job')}</span>
        </footer>
      </div>
      <nav className="bottom-nav">
        {primary.map((n) => (
          <Link
            href={'/?view=' + n.key}
            key={n.key}
            className={
              safeView === n.key || (n.key === 'programs' && safeView === 'program') ? 'active' : ''
            }
          >
            <n.icon size={23} />
            <span>{t(lang, n.label)}</span>
          </Link>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={19} />
          {notice}
          <button
            className="icon-button"
            onClick={() => setNotice('')}
            aria-label={t(lang, 'cancel')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {switcher && (
        <Modal
          title={text(lang, 'ফার্ম নির্বাচন করুন', 'Choose a firm')}
          onClose={() => setSwitcher(false)}
        >
          <div className="switcher-body">
            <SearchBox
              value={firmQuery}
              onChange={setFirmQuery}
              placeholder={text(lang, 'ফার্মের নাম খুঁজুন', 'Search firm names')}
            />
            <button
              className="firm-option"
              onClick={() => {
                setFirm('');
                setSwitcher(false);
              }}
            >
              <Building2 />
              {t(lang, 'allFirms')}
              {!firm && <Check size={19} />}
            </button>
            {store.firms
              .filter((f) => str(f.data.name).toLowerCase().includes(firmQuery.toLowerCase()))
              .map((f) => (
                <button
                  key={f.id}
                  className="firm-option"
                  onClick={() => {
                    setFirm(f.id);
                    setSwitcher(false);
                  }}
                >
                  <Building2 size={21} />
                  <span>
                    {str(f.data.name)}
                    <small>{str(f.data.address)}</small>
                  </span>
                  {firm === f.id && <Check size={19} />}
                </button>
              ))}
            {owner && (
              <button
                className="button secondary full"
                onClick={() => {
                  setSwitcher(false);
                  open({ kind: 'firms' });
                }}
              >
                <Plus size={18} />
                {text(lang, 'নতুন ফার্ম', 'New firm')}
              </button>
            )}
          </div>
        </Modal>
      )}
      {form && (
        <Editor
          key={form.kind + form.row?.id + str(form.initial?.program_id)}
          title={title}
          kind={form.kind}
          fields={fields}
          row={form.row}
          initial={initial}
          onClose={() => setForm(null)}
          submit={submit}
          onlineOnly={form.kind === 'money_movements'}
          extra={
            form.kind === 'expenses'
              ? () => (
                  <div className="inline-help">
                    <span>{text(lang, 'খাত পাওয়া যাচ্ছে না?', 'Head not listed?')}</span>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        const name = prompt(
                          text(lang, 'নতুন খাতের নাম', 'Name of new expense head'),
                        );
                        if (name)
                          void app
                            .save('expense_heads', { name, active: true })
                            .catch((e) => setBanner(e.message));
                      }}
                    >
                      {text(lang, 'নতুন খাত যোগ করুন', 'Add a head')}
                    </button>
                  </div>
                )
              : undefined
          }
        />
      )}
      {special === 'bill' && <BillBuilder billId={specialId} onClose={() => setSpecial('')} />}{' '}
      {special === 'settlement' && <Settlement billId={specialId} onClose={() => setSpecial('')} />}{' '}
      {special === 'extra' && <ExtraReceipt programId={specialId} onClose={() => setSpecial('')} />}
    </div>
  );
}
