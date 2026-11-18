'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { readCache, writeCache, clearCache } from './offline';
import { demoWorkspace, seedDemo, applyDemo } from './demo';
import {
  type Data,
  type Kind,
  type Row,
  type Store,
  type Workspace,
  type Operation,
  type Lang,
  kinds,
  emptyStore,
  uid,
} from './types';
interface Context {
  store: Store;
  workspace: Workspace | null;
  lang: Lang;
  setLang: (l: Lang) => void;
  reportLang: Lang;
  setReportLang: (l: Lang) => void;
  large: boolean;
  setLarge: (b: boolean) => void;
  fiscal: number;
  setFiscal: (n: number) => void;
  firm: string;
  setFirm: (id: string) => void;
  demo: boolean;
  online: boolean;
  pending: Operation[];
  loading: boolean;
  error: string;
  notice: string;
  setNotice: (s: string) => void;
  enterDemo: () => void;
  exit: () => Promise<void>;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  save: (kind: Kind, data: Data, row?: Row, reason?: string) => Promise<void>;
  retry: (id: string) => void;
  resolve: (id: string, keepLocal: boolean) => Promise<void>;
}
const Ctx = createContext<Context | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('Workspace missing');
  return c;
};
export function Provider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>(emptyStore),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [lang, setLangState] = useState<Lang>('bn'),
    [reportLang, setReportLangState] = useState<Lang>('bn');
  const [large, setLargeState] = useState(false),
    [fiscal, setFiscalState] = useState(7),
    [firm, setFirmState] = useState(''),
    [demo, setDemo] = useState(false),
    [online, setOnline] = useState(true),
    [pending, setPending] = useState<Operation[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const storeRef = useRef(store),
    queueRef = useRef(pending),
    wsRef = useRef(workspace),
    demoRef = useRef(demo),
    syncing = useRef(false);
  storeRef.current = store;
  queueRef.current = pending;
  wsRef.current = workspace;
  demoRef.current = demo;
  const pref = (key: string, value: unknown) =>
    localStorage.setItem('sohoz-' + key, JSON.stringify(value));
  const setLang = (l: Lang) => {
    setLangState(l);
    pref('lang', l);
    document.documentElement.lang = l;
  };
  const setReportLang = (l: Lang) => {
    setReportLangState(l);
    pref('reportLang', l);
  };
  const setLarge = (v: boolean) => {
    setLargeState(v);
    pref('large', v);
  };
  const setFiscal = (v: number) => {
    if (wsRef.current?.role !== 'owner') return;
    if (!demoRef.current && !navigator.onLine) {
      setNotice('Connect to the internet to change organization settings');
      return;
    }
    setFiscalState(v);
    pref('fiscal', v);
    if (!demoRef.current)
      void supabase()
        ?.rpc('set_fiscal_month', { month: v })
        .then(({ error }) => {
          if (error) setNotice(error.message);
        });
  };
  const setFirm = (v: string) => {
    setFirmState(v);
    pref('firm', v);
  };
  const key = (ws: Workspace) => ws.user_id + ':' + ws.org_id;
  const persist = async (s: Store, q: Operation[], w: Workspace) => {
    await writeCache(key(w), { store: s, pending: q, workspace: w });
  };
  const refresh = useCallback(async () => {
    if (demoRef.current) return;
    const sb = supabase();
    const ws = wsRef.current;
    if (!sb || !ws || !navigator.onLine) return;
    const results = await Promise.all(
      kinds.map(async (k) => {
        const all: Row[] = [];
        let offset = 0;
        while (true) {
          const { data, error } = await sb
            .from(k)
            .select('*')
            .eq('org_id', ws.org_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + 499);
          if (error) throw error;
          all.push(...(data as Row[]));
          if ((data?.length || 0) < 500) break;
          offset += 500;
        }
        return [k, all] as const;
      }),
    );
    const next = Object.fromEntries(results) as Store;
    for (const op of queueRef.current) {
      if (
        op.status === 'pending' &&
        !['bills', 'settlements', 'supplementary_receipts', 'money_movements'].includes(op.kind)
      ) {
        const prev = next[op.kind].find((r) => r.id === op.record_id);
        next[op.kind] = [
          {
            id: op.record_id,
            org_id: ws.org_id,
            data: op.data,
            version: op.expected_version + 1,
            created_by: ws.user_id,
            created_at: prev?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...next[op.kind].filter((r) => r.id !== op.record_id),
        ];
      }
    }
    const chosen = JSON.parse(localStorage.getItem('sohoz-firm') || '""');
    if (chosen && !next.firms.some((f) => f.id === chosen)) {
      setFirmState('');
      localStorage.removeItem('sohoz-firm');
    }
    setStore(next);
    storeRef.current = next;
    await persist(next, queueRef.current, ws);
  }, []);
  const sync = useCallback(async () => {
    if (syncing.current || demoRef.current || !navigator.onLine || !wsRef.current) return;
    syncing.current = true;
    try {
      const sb = supabase()!;
      for (const op of [...queueRef.current]) {
        if (op.status === 'conflict') continue;
        const { error } = await sb.rpc('apply_operation', {
          operation_id: op.id,
          entity: op.kind,
          record_id: op.record_id,
          payload: op.data,
          expected_version: op.expected_version,
          correction_reason: op.reason,
        });
        let queue = queueRef.current;
        if (error) {
          if (!navigator.onLine || /fetch|network/i.test(error.message)) break;
          queue = queue.map((o) =>
            o.id === op.id ? { ...o, status: 'conflict' as const, error: error.message } : o,
          );
        } else queue = queue.filter((o) => o.id !== op.id);
        queueRef.current = queue;
        setPending(queue);
        await persist(storeRef.current, queue, wsRef.current!);
      }
      await refresh();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      syncing.current = false;
    }
  }, [refresh]);
  useEffect(() => {
    for (const [k, set] of [
      ['lang', setLangState],
      ['reportLang', setReportLangState],
      ['large', setLargeState],
      ['fiscal', setFiscalState],
      ['firm', setFirmState],
    ] as const) {
      const saved = localStorage.getItem('sohoz-' + k);
      if (saved) {
        try {
          (set as (v: never) => void)(JSON.parse(saved) as never);
        } catch {}
      }
    }
    setOnline(navigator.onLine);
    const net = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    let alive = true;
    const init = async () => {
      if (localStorage.getItem('sohoz-demo') === 'true') {
        const cache = await readCache<{ store: Store }>(key(demoWorkspace));
        if (!alive) return;
        setStore(cache?.store || seedDemo());
        setWorkspace(demoWorkspace);
        wsRef.current = demoWorkspace;
        setDemo(true);
        demoRef.current = true;
        setLoading(false);
        return;
      }
      const sb = supabase();
      if (!sb) {
        setLoading(false);
        return;
      }
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const cached = await readCache<{ store: Store; pending: Operation[]; workspace: Workspace }>(
        'session:' + session.user.id,
      );
      if (cached) {
        setStore(cached.store);
        setPending(cached.pending);
        queueRef.current = cached.pending;
        setWorkspace(cached.workspace);
        wsRef.current = cached.workspace;
      }
      if (navigator.onLine) {
        const { data, error } = await sb.rpc('get_workspace');
        if (error) throw error;
        if (data) {
          const ws = data as Workspace;
          setFiscalState(Number((data as Record<string, unknown>).fiscal_month) || 7);
          setWorkspace(ws);
          wsRef.current = ws;
          const saved = await readCache<{ store: Store; pending: Operation[] }>(key(ws));
          if (saved) {
            setStore(saved.store);
            setPending(saved.pending);
            queueRef.current = saved.pending;
          }
          await sync();
          await writeCache('session:' + session.user.id, {
            store: storeRef.current,
            pending: queueRef.current,
            workspace: ws,
          });
        }
      }
      if (alive) setLoading(false);
    };
    init().catch((e) => {
      setError(e.message || String(e));
      if (/inactive|activate your invitation/i.test(e.message || '')) {
        setWorkspace(null);
        wsRef.current = null;
      }
      setLoading(false);
    });
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          navigator.serviceWorker.ready.then((ready) => {
            const urls = performance.getEntriesByType('resource').map((entry) => entry.name);
            ready.active?.postMessage({ type: 'CACHE_SHELL', urls });
          });
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller)
                setNotice('A new version is ready. Save your work, close and reopen the app.');
            });
          });
        })
        .catch(() => {});
    return () => {
      alive = false;
      window.removeEventListener('online', net);
      window.removeEventListener('offline', net);
    };
  }, [sync]);
  useEffect(() => {
    if (workspace && !demo)
      void writeCache('session:' + workspace.user_id, { store, pending, workspace });
  }, [workspace, store, pending, demo]);
  const enterDemo = async () => {
    const s = seedDemo();
    localStorage.setItem('sohoz-demo', 'true');
    setDemo(true);
    demoRef.current = true;
    setWorkspace(demoWorkspace);
    wsRef.current = demoWorkspace;
    setStore(s);
    setFirm('');
    await persist(s, [], demoWorkspace);
  };
  const save = async (kind: Kind, data: Data, row?: Row, reason = '') => {
    const ws = wsRef.current;
    if (!ws) throw new Error('Sign in first');
    if (row && !reason.trim())
      throw new Error(lang === 'bn' ? 'পরিবর্তনের কারণ লিখুন' : 'Enter a correction reason');
    const financial = [
      'bills',
      'settlements',
      'supplementary_receipts',
      'money_movements',
    ].includes(kind);
    if (!navigator.onLine && (financial || (row && !['programs', 'dispatches'].includes(kind))))
      throw new Error(
        lang === 'bn'
          ? 'এই পরিবর্তনের জন্য ইন্টারনেট প্রয়োজন'
          : 'Connect to the internet for this action',
      );
    const id = row?.id || uid();
    if (demoRef.current) {
      const next = applyDemo(storeRef.current, kind, id, data, row?.version || 0);
      setStore(next);
      storeRef.current = next;
      await persist(next, [], ws);
      const history = (await readCache<Record<string, unknown>[]>('demo-audit')) || [];
      await writeCache('demo-audit', [
        {
          entity: kind,
          record_id: id,
          action: row ? 'correct' : 'create',
          reason,
          old_data: row?.data,
          new_data: data,
          created_at: new Date().toISOString(),
        },
        ...history,
      ]);
      setNotice(lang === 'bn' ? 'নমুনা তথ্য সংরক্ষিত' : 'Demo saved on this device');
      return;
    }
    if (financial && queueRef.current.length)
      throw new Error(
        lang === 'bn'
          ? 'আগে অপেক্ষমাণ তথ্য সিঙ্ক করুন'
          : 'Sync pending entries before recording money or bills',
      );
    const op: Operation = {
      id: uid(),
      kind,
      record_id: id,
      data,
      expected_version: row?.version || 0,
      reason,
      status: 'pending',
    };
    const immediate = navigator.onLine && queueRef.current.length === 0;
    // Persist the operation ID BEFORE attempting the request. A timed-out financial write
    // is retried with this same ID, even after a reload, so a receipt or advance cannot duplicate.
    let q = [...queueRef.current, op];
    queueRef.current = q;
    setPending(q);
    await persist(storeRef.current, q, ws);
    if (immediate) {
      const { error } = await supabase()!.rpc('apply_operation', {
        operation_id: op.id,
        entity: kind,
        record_id: id,
        payload: data,
        expected_version: op.expected_version,
        correction_reason: reason,
      });
      if (!error) {
        q = queueRef.current.filter((o) => o.id !== op.id);
        queueRef.current = q;
        setPending(q);
        await persist(storeRef.current, q, ws);
        try {
          await refresh();
          setError('');
        } catch {
          setError(
            lang === 'bn'
              ? 'সার্ভারে সংরক্ষিত, কিন্তু নতুন তথ্য আনতে পারিনি। সিঙ্ক করুন।'
              : 'Saved to server, but refresh failed. Sync to load the latest records.',
          );
        }
        setNotice(lang === 'bn' ? 'সার্ভারে সংরক্ষিত' : 'Saved to server');
        return;
      }
      if (!/fetch|network|timeout/i.test(error.message)) {
        q = queueRef.current.filter((o) => o.id !== op.id);
        queueRef.current = q;
        setPending(q);
        await persist(storeRef.current, q, ws);
        throw new Error(error.message);
      }
    }
    if (!financial) {
      const next = {
        ...storeRef.current,
        [kind]: [
          {
            id,
            org_id: ws.org_id,
            data,
            version: (row?.version || 0) + 1,
            created_by: ws.user_id,
            created_at: row?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...storeRef.current[kind].filter((r) => r.id !== id),
        ],
      };
      storeRef.current = next;
      setStore(next);
      await persist(next, q, ws);
    }
    setNotice(
      financial
        ? lang === 'bn'
          ? 'সার্ভারের নিশ্চিতকরণ বাকি। সিঙ্ক করে ফলাফল দেখুন।'
          : 'Waiting for server confirmation. Sync to check the result.'
        : lang === 'bn'
          ? 'ফোনে সংরক্ষিত; অনলাইনে এলে সিঙ্ক হবে'
          : 'Saved on this phone; waiting to sync',
    );
    if (navigator.onLine && !immediate) void sync();
  };
  const exit = async () => {
    if (queueRef.current.length)
      throw new Error(
        lang === 'bn'
          ? 'আগে অপেক্ষমাণ তথ্য সিঙ্ক করুন'
          : 'Sync or resolve pending entries before signing out',
      );
    await supabase()?.auth.signOut();
    await clearCache();
    localStorage.removeItem('sohoz-demo');
    localStorage.removeItem('sohoz-firm');
    location.href = '/';
  };
  const retry = (id: string) => {
    const q = queueRef.current.map((o) =>
      o.id === id ? { ...o, status: 'pending' as const, error: undefined } : o,
    );
    queueRef.current = q;
    setPending(q);
    void sync();
  };
  const resolve = async (id: string, keepLocal: boolean) => {
    const ws = wsRef.current;
    if (!ws || !navigator.onLine)
      throw new Error('Connect to the internet to resolve a sync conflict');
    const op = queueRef.current.find((o) => o.id === id);
    if (!op) return;
    let q = queueRef.current;
    if (keepLocal) {
      const { data, error } = await supabase()!
        .from(op.kind)
        .select('version')
        .eq('id', op.record_id)
        .maybeSingle();
      if (error) throw error;
      q = q.map((o) =>
        o.id === id
          ? {
              ...o,
              id: uid(),
              expected_version: data?.version || 0,
              status: 'pending' as const,
              error: undefined,
              reason: (op.reason || '') + ' — Reapplied after reviewing a sync conflict',
            }
          : o,
      );
    } else {
      await writeCache('discarded:' + id, op);
      q = q.filter((o) => o.id !== id);
    }
    queueRef.current = q;
    setPending(q);
    await persist(storeRef.current, q, ws);
    await sync();
  };
  return (
    <Ctx.Provider
      value={{
        store,
        workspace,
        lang,
        setLang,
        reportLang,
        setReportLang,
        large,
        setLarge,
        fiscal,
        setFiscal,
        firm,
        setFirm,
        demo,
        online,
        pending,
        loading,
        error,
        notice,
        setNotice,
        enterDemo,
        exit,
        refresh,
        sync,
        save,
        retry,
        resolve,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
