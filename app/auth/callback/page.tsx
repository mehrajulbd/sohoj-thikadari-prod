'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
export default function Callback() {
  const [error, setError] = useState('');
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const run = async () => {
      const sb = supabase();
      if (!sb) throw new Error('Supabase is not configured');
      const url = new URL(location.href);
      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const hash = new URLSearchParams(url.hash.slice(1));
      const type = url.searchParams.get('type') || hash.get('type');
      const callbackError =
        url.searchParams.get('error_description') || hash.get('error_description');
      if (callbackError) throw new Error(callbackError);
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (tokenHash && ['invite', 'recovery', 'email'].includes(type || '')) {
        const { error } = await sb.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'invite',
        });
        if (error) throw error;
      } else if (hash.has('access_token') && hash.has('refresh_token')) {
        const { error } = await sb.auth.setSession({
          access_token: hash.get('access_token')!,
          refresh_token: hash.get('refresh_token')!,
        });
        if (error) throw error;
      } else {
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (!session) throw new Error('This link expired. Request a new link.');
      }
      const next = url.searchParams.get('next');
      location.replace(
        next === '/reset-password' || type === 'invite' || type === 'recovery'
          ? '/reset-password'
          : '/',
      );
    };
    run().catch((e) => setError(e.message));
  }, []);
  return (
    <main className="loading-screen">
      <h1>{error ? 'লিংক ব্যবহার করা যায়নি' : 'অ্যাকাউন্ট খোলা হচ্ছে…'}</h1>
      {error && (
        <>
          <p role="alert">{error}</p>
          <a className="button primary" href="/">
            হোম / Home
          </a>
        </>
      )}
    </main>
  );
}
