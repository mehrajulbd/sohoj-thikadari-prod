'use client';
import { humanError } from '@/lib/errors';
import { useState } from 'react';
import {
  ArrowRight,
  Wheat,
  ShieldCheck,
  Smartphone,
  Eye,
  EyeOff,
  LoaderCircle,
  Check,
} from 'lucide-react';
import { useApp } from '@/lib/provider';
import { normalizePhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { t, text, digits } from '@/lib/i18n';
export function Auth() {
  const { lang, setLang, enterDemo, error: workspaceError } = useApp();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login'),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const sb = supabase();
  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!sb)
        throw new Error(
          text(
            lang,
            'এখনো লাইভ অ্যাকাউন্ট সংযোগ করা হয়নি। নিচের নমুনা অ্যাপ ব্যবহার করতে পারেন।',
            'Live accounts are not configured yet. You can explore the demo below.',
          ),
        );
      const identifier = digits(String(fd.get('identifier') || '')).trim();
      const password = String(fd.get('password') || '');
      if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(String(fd.get('email')), {
          redirectTo: location.origin + '/auth/callback?next=/reset-password',
        });
        if (error) throw error;
        setMessage(
          text(
            lang,
            'এই ইমেইলের অ্যাকাউন্ট থাকলে পাসওয়ার্ড পরিবর্তনের লিংক পাঠানো হয়েছে।',
            'If an account exists, a password reset link has been sent.',
          ),
        );
      } else if (mode === 'signup') {
        const { error } = await sb.auth.signUp({
          email: String(fd.get('email')).trim(),
          password,
          options: {
            data: { name: fd.get('name'), phone: normalizePhone(String(fd.get('phone') || '')) },
            emailRedirectTo: location.origin + '/auth/callback',
          },
        });
        if (error) throw error;
        location.assign('/');
      } else {
        if (identifier.includes('@')) {
          const { error } = await sb.auth.signInWithPassword({ email: identifier, password });
          if (error) throw error;
        } else {
          const response = await fetch('/api/auth/phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: identifier, password }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          const { error } = await sb.auth.setSession(result.session);
          if (error) throw error;
        }
        location.assign('/');
      }
    } catch (e) {
      setError(humanError(lang, e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    if (!sb) {
      setError(text(lang, 'আগে Supabase সংযোগ সেট করুন।', 'Configure Supabase first.'));
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/auth/callback' },
    });
    if (error) setError(error.message);
  };
  return (
    <div className="auth-page">
      <div className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Wheat />
          </span>
          <span>
            সহজ ঠিকাদারি<small>Sohoz Thikadari</small>
          </span>
        </div>
        <div className="auth-story-main">
          <span className="story-label">
            {text(lang, 'আপনার কাজের সহজ সঙ্গী', 'A clearer way to manage your work')}
          </span>
          <h1>
            {text(
              lang,
              'পরিবহনের কাজ,\nহিসাবের নিশ্চিন্ততা।',
              'Keep work moving.\nKeep accounts clear.',
            )}
          </h1>
          <p>
            {text(
              lang,
              'প্রোগ্রাম থেকে বিল, কর্মীর খরচ থেকে লাভের হিসাব। সব এক জায়গায়, আপনার হাতের মুঠোয়।',
              'Programs, bills, staff spending and profit. One simple workspace, wherever work takes you.',
            )}
          </p>
          <div className="journey-preview">
            <div>
              <span className="journey-icon">১</span>
              <div>
                <b>{text(lang, 'প্রোগ্রাম ও পরিবহন', 'Programs & transport')}</b>
                <small>
                  {text(lang, 'কোন কাজ কতদূর, সহজেই দেখুন', 'Know exactly where each job stands')}
                </small>
              </div>
            </div>
            <div>
              <span className="journey-icon">২</span>
              <div>
                <b>{text(lang, 'খরচ ও কর্মীর হিসাব', 'Expenses & staff money')}</b>
                <small>
                  {text(lang, 'প্রতিটি টাকার পরিষ্কার হিসাব', 'Every movement, clearly recorded')}
                </small>
              </div>
            </div>
            <div>
              <span className="journey-icon">৩</span>
              <div>
                <b>{text(lang, 'বিল ও লাভের হিসাব', 'Bills & cash results')}</b>
                <small>{text(lang, 'তথ্য বুঝুন, সঠিক সিদ্ধান্ত নিন', 'Understand your results')}</small>
              </div>
            </div>
          </div>
        </div>
        <div className="auth-foot">
          <Smartphone size={18} />
          {text(
            lang,
            'ফোনে সহজে ব্যবহার করুন। ইন্টারনেট ছাড়াও কাজের তথ্য লিখে রাখুন।',
            'Made for your phone. Keep operational entries while offline.',
          )}
        </div>
      </div>
      <div className="auth-form-side">
        <button className="language-button" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>
          {lang === 'bn' ? 'English' : 'বাংলা'}
        </button>
        <div className="auth-form-wrap">
          <span className="mini-logo">
            <Wheat size={29} />
          </span>
          <h2>
            {mode === 'signup'
              ? t(lang, 'signup')
              : mode === 'forgot'
                ? text(lang, 'পাসওয়ার্ড পরিবর্তন', 'Reset your password')
                : text(lang, 'আবারও স্বাগতম', 'Welcome back')}
          </h2>
          <p>
            {mode === 'forgot'
              ? text(
                  lang,
                  'আপনার অ্যাকাউন্টের ইমেইল দিন।',
                  'Enter the email connected to your account.',
                )
              : text(
                  lang,
                  'আপনার কাজ ও হিসাব, এখান থেকেই শুরু।',
                  'Your work and accounts start here.',
                )}
          </p>
          {mode !== 'forgot' && (
            <>
              <button className="button google-button" onClick={google}>
                <span className="google-g">G</span>
                {t(lang, 'google')}
              </button>
              <div className="divider">
                <span>{text(lang, 'অথবা', 'or')}</span>
              </div>
            </>
          )}
          <form onSubmit={send} className="auth-form">
            {mode === 'signup' && (
              <>
                <label className="field">
                  <span>{t(lang, 'name')}</span>
                  <input name="name" required autoComplete="name" />
                </label>
                <label className="field">
                  <span>{t(lang, 'phone')}</span>
                  <input name="phone" type="tel" autoComplete="tel" />
                </label>
              </>
            )}
            {mode !== 'login' ? (
              <label className="field">
                <span>{t(lang, 'email')}</span>
                <input name="email" type="email" required autoComplete="email" />
              </label>
            ) : (
              <label className="field">
                <span>{t(lang, 'identifier')}</span>
                <input
                  name="identifier"
                  required
                  autoComplete="username"
                  placeholder="name@email.com"
                />
              </label>
            )}
            {mode !== 'forgot' && (
              <label className="field">
                <span>{t(lang, 'password')}</span>
                <div className="password-field">
                  <input
                    name="password"
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShow(!show)}
                    aria-label={text(lang, 'পাসওয়ার্ড দেখুন / লুকান', 'Show / hide password')}
                  >
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </label>
            )}
            {mode === 'login' && (
              <button
                className="text-button forgot"
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError('');
                }}
              >
                {t(lang, 'forgot')}
              </button>
            )}
            {(error || workspaceError) && (
              <div className="alert error" role="alert">
                {error || workspaceError}
              </div>
            )}
            {message && (
              <div className="alert success" role="status">
                {message}
              </div>
            )}
            <button disabled={busy} className="button primary full">
              {busy ? <LoaderCircle className="spin" size={20} /> : null}
              {mode === 'forgot'
                ? text(lang, 'লিংক পাঠান', 'Send reset link')
                : t(lang, mode === 'signup' ? 'signup' : 'login')}
              <ArrowRight size={19} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'login'
              ? text(lang, 'নতুন ব্যবহারকারী?', 'New here?')
              : text(lang, 'অ্যাকাউন্ট আছে?', 'Already have an account?')}{' '}
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setMessage('');
              }}
            >
              {t(lang, mode === 'login' ? 'signup' : 'login')}
            </button>
          </p>
          <button className="button demo-button full" onClick={enterDemo}>
            {t(lang, 'demo')}
            <ArrowRight size={18} />
          </button>
          <p className="auth-note">
            <ShieldCheck size={16} />
            {text(
              lang,
              'আপনার তথ্য শুধুই আপনার প্রতিষ্ঠানের জন্য।',
              'Your organization’s records stay private.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
