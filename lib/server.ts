import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server authentication is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function publicAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Authentication is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) throw new Error('Request origin is not allowed');
}
export async function ownerFor(request: NextRequest) {
  checkOrigin(request);
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new Error('Sign in first');
  const client = admin();
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) throw new Error('Sign in again');
  const { data: member } = await client
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .single();
  if (member?.role !== 'owner') throw new Error('Owner access is required');
  return { client, member, user };
}
