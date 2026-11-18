import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { normalizePhone } from '@/lib/phone';
import { admin, publicAuth, checkOrigin } from '@/lib/server';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get('content-length') || 0) > 4096)
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    const body = await request.json();
    const phone = normalizePhone(String(body.phone || ''));
    const password = String(body.password || '');
    if (phone.length < 7 || phone.length > 18 || password.length < 1 || password.length > 256)
      return NextResponse.json({ error: 'Phone or password is incorrect' }, { status: 400 });
    const client = admin();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
    for (const value of ['ip:' + ip, 'phone:' + phone]) {
      const key = createHash('sha256').update(value).digest('hex');
      const { data, error } = await client.rpc('consume_login_attempt', { key });
      if (error) throw error;
      if (!data)
        return NextResponse.json(
          { error: 'Too many attempts. Try again in 15 minutes.' },
          { status: 429 },
        );
    }
    const { data: directory } = await client
      .from('login_directory')
      .select('email')
      .eq('phone', phone)
      .maybeSingle();
    // Do not reveal account existence or the account email.
    const { data, error } = await publicAuth().auth.signInWithPassword({
      email: directory?.email || 'invalid-login@invalid.local',
      password,
    });
    if (error || !data.session)
      return NextResponse.json({ error: 'Phone or password is incorrect' }, { status: 401 });
    return NextResponse.json(
      {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Sign-in is unavailable. Check your connection or use email.' },
      { status: 503 },
    );
  }
}
