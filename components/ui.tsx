'use client';
import { humanError } from '@/lib/errors';
import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ArrowLeft,
  Plus,
  Check,
  AlertCircle,
  Search,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react';
import { useApp } from '@/lib/provider';
import { t, text, digits, type Word } from '@/lib/i18n';
import { type Data, type Kind, type Row, str, num, today } from '@/lib/types';
import { readCache, writeCache, deleteCache } from '@/lib/offline';
export function Empty({
  title,
  body,
  action,
}: {
  title?: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const { lang } = useApp();
  return (
    <div className="empty">
      <div className="empty-mark">
        <Plus size={28} />
      </div>
      <h3>{title || t(lang, 'noRecords')}</h3>
      <p>{body || t(lang, 'getStarted')}</p>
      {action}
    </div>
  );
}
export function Badge({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function Money({ value }: { value: string }) {
  return <span className="money">{value}</span>;
}
export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { lang } = useApp();
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label={t(lang, 'cancel')}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export interface Field {
  key: string;
  label: Word | string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'email' | 'password';
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  hint?: string;
  show?: (d: Data) => boolean;
}
export function Editor({
  title,
  kind,
  fields,
  row,
  initial = {},
  onClose,
  submit,
  extra,
  onlineOnly = false,
  draftKey,
}: {
  title: string;
  kind: Kind;
  fields: Field[];
  row?: Row;
  initial?: Data;
  onClose: () => void;
  submit?: (data: Data, reason: string) => Promise<void>;
  extra?: (data: Data) => React.ReactNode;
  onlineOnly?: boolean;
  draftKey?: string;
}) {
  const { lang, save, workspace, online } = useApp();
  const [data, setData] = useState<Data>(row?.data || initial),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState(false);
  const key =
    'draft:' +
    workspace?.user_id +
    ':' +
    workspace?.org_id +
    ':' +
    kind +
    ':' +
    (row?.id || draftKey || 'new');
  useEffect(() => {
    let alive = true;
    readCache<{ data: Data; reason: string }>(key).then((d) => {
      if (alive && d) {
        setData(d.data);
        setReason(d.reason);
        setSaved(true);
      }
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      void writeCache(key, { data, reason }).then(() => setSaved(true));
    }, 300);
    return () => clearTimeout(id);
  }, [data, reason, key, ready]);
  const label = (l: string) => {
    try {
      return t(lang, l as Word) || l;
    } catch {
      return l;
    }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const cleaned: Data = { ...data };
      for (const f of fields) {
        if (f.type === 'number' && str(data[f.key]) !== '') {
          const parsed = Number(digits(str(data[f.key])));
          if (!Number.isFinite(parsed))
            throw new Error(
              label(f.label) + ': ' + text(lang, 'সঠিক সংখ্যা লিখুন', 'Enter a valid number'),
            );
          cleaned[f.key] = parsed;
        }
      }
      if (row && !reason.trim())
        throw new Error(text(lang, 'পরিবর্তনের কারণ লিখুন', 'Enter a correction reason'));
      const reference =
        kind === 'programs'
          ? 'number'
          : kind === 'dispatches'
            ? 'invoice_no'
            : kind === 'bills'
              ? 'number'
              : null;
      if (reference) {
        /* Duplicate references are allowed after an explicit warning. */
      }
      await (submit ? submit(cleaned, reason) : save(kind, cleaned, row, reason));
      await deleteCache(key);
      onClose();
    } catch (e) {
      setError(humanError(lang, e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={send} className="editor">
        <div className="form-grid">
          {fields
            .filter((f) => !f.show || f.show(data))
            .map((f) => (
              <label className={'field ' + (f.type === 'textarea' ? 'wide' : '')} key={f.key}>
                <span>
                  {label(f.label)}
                  {f.required && (
                    <span aria-hidden="true" className="required">
                      {' '}
                      *
                    </span>
                  )}
                </span>
                {f.type === 'select' ? (
                  <select
                    required={f.required}
                    value={str(data[f.key])}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                  >
                    <option value="">{t(lang, 'select')}</option>
                    {f.options?.map((o) => (
                      <option value={o.value} key={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    required={f.required}
                    value={str(data[f.key])}
                    rows={3}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                  />
                ) : f.type === 'checkbox' ? (
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={data[f.key] !== false}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.checked })}
                  />
                ) : (
                  <input
                    type={f.type === 'number' ? 'text' : f.type || 'text'}
                    inputMode={f.type === 'number' ? 'decimal' : undefined}
                    required={f.required}
                    value={str(data[f.key])}
                    onChange={(e) =>
                      setData({
                        ...data,
                        [f.key]: f.type === 'number' ? digits(e.target.value) : e.target.value,
                      })
                    }
                    onBlur={() => {
                      if (
                        f.type === 'number' &&
                        str(data[f.key]) !== '' &&
                        f.min !== undefined &&
                        num(data[f.key]) < f.min
                      )
                        setError(
                          label(f.label) + ': ' + text(lang, 'ন্যূনতম', 'Minimum') + ' ' + f.min,
                        );
                    }}
                  />
                )}
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
        </div>
        {extra?.(data)}
        {row && (
          <label className="field">
            <span>{t(lang, 'correction')} *</span>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        {error && (
          <div className="alert error" role="alert">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
        {onlineOnly && !online && (
          <div className="alert warning">
            {text(
              lang,
              'এই কাজের জন্য ইন্টারনেট প্রয়োজন। খসড়া ফোনে রাখা হবে।',
              'This action needs internet. Your draft stays on this phone.',
            )}
          </div>
        )}
        <div className="form-footer">
          <small className="draft-note">{saved ? t(lang, 'saveDraft') : ''}</small>
          <div className="button-row">
            <button type="button" className="button secondary" onClick={onClose}>
              {t(lang, 'cancel')}
            </button>
            <button className="button primary" disabled={busy || (onlineOnly && !online)}>
              {busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{' '}
              {t(lang, 'save')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { lang } = useApp();
  return (
    <label className="search">
      <Search size={20} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t(lang, 'search')}
        aria-label={placeholder || t(lang, 'search')}
      />
    </label>
  );
}
export const optionRows = (rows: Row[], key = 'name') =>
  rows
    .filter((r) => r.data.active !== false)
    .map((r) => ({ value: r.id, label: str(r.data[key]) }));
