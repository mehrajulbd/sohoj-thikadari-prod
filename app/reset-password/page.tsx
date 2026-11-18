'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
export default function Reset() {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="loading-screen">
      <div className="panel" style={{ padding: 30, width: '100%', maxWidth: 450 }}>
        <h1>নতুন পাসওয়ার্ড</h1>
        <p>Set your password</p>
        <form
          className="auth-form"
          style={{ marginTop: 22 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const form = new FormData(e.currentTarget);
            try {
              const password = String(form.get('password'));
              if (password !== form.get('confirm'))
                throw new Error('পাসওয়ার্ড দুটি মিলছে না / Passwords do not match');
              const sb = supabase();
              if (!sb) throw new Error('Authentication is not configured');
              const {
                data: { session },
              } = await sb.auth.getSession();
              if (!session)
                throw new Error(
                  'লিংক মেয়াদোত্তীর্ণ। নতুন লিংক নিন। / Link expired. Request a new one.',
                );
              const { error } = await sb.auth.updateUser({ password });
              if (error) throw error;
              location.replace('/');
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            <span>পাসওয়ার্ড / Password</span>
            <input
              type="password"
              name="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>আবার লিখুন / Confirm</span>
            <input
              type="password"
              name="confirm"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <button disabled={busy} className="button primary">
            সংরক্ষণ করুন / Save password
          </button>
        </form>
      </div>
    </main>
  );
}
