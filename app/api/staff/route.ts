import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';
import { ownerFor, publicAuth } from '@/lib/server';
export async function POST(request: NextRequest) {
  try {
    const { client, member } = await ownerFor(request);
    const body = await request.json();
    const staffId = String(body.staff_id || '');
    const { data: staff } = await client
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .eq('org_id', member.org_id)
      .single();
    if (!staff || staff.data.active === false)
      return NextResponse.json({ error: 'Choose an active staff member' }, { status: 400 });
    const email = String(staff.data.email || '')
      .trim()
      .toLowerCase();
    if (!email.includes('@'))
      return NextResponse.json({ error: 'A recovery email is required' }, { status: 400 });
    const phone = normalizePhone(String(staff.data.phone || '')) || null;
    if (phone) {
      const { data: phoneOwner } = await client
        .from('login_directory')
        .select('user_id')
        .eq('phone', phone)
        .maybeSingle();
      if (phoneOwner) {
        const { data: linked } = await client
          .from('memberships')
          .select('staff_id')
          .eq('user_id', phoneOwner.user_id)
          .maybeSingle();
        if (linked?.staff_id !== staffId)
          return NextResponse.json(
            { error: 'This phone is already used by another account' },
            { status: 409 },
          );
      }
    }
    const { data: staffMembership } = await client
      .from('memberships')
      .select('user_id,email')
      .eq('staff_id', staffId)
      .maybeSingle();
    if (staffMembership && staffMembership.email !== email)
      return NextResponse.json(
        {
          error:
            'This staff login already has a recovery email. Keep that email or contact the account administrator.',
        },
        { status: 409 },
      );
    const { data: existing } = await client
      .from('login_directory')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();
    let userId = existing?.user_id;
    if (userId) {
      const { data: membership } = await client
        .from('memberships')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (
        membership &&
        (membership.org_id !== member.org_id ||
          membership.role !== 'staff' ||
          membership.staff_id !== staffId)
      )
        return NextResponse.json(
          { error: 'This email is already connected to another account or staff entry' },
          { status: 409 },
        );
    } else {
      const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
        data: { name: staff.data.name, phone: staff.data.phone, invited_staff: true },
        redirectTo: request.nextUrl.origin + '/auth/callback?next=/reset-password',
      });
      if (error)
        return NextResponse.json(
          {
            error:
              'Invitation could not be sent. Check SMTP settings and whether the email already has an account.',
          },
          { status: 400 },
        );
      userId = data.user.id;
    }
    const { error } = await client.from('memberships').upsert({
      user_id: userId,
      org_id: member.org_id,
      role: 'staff',
      staff_id: staffId,
      name: staff.data.name,
      email,
      active: true,
    });
    if (error) throw error;
    const { error: directoryError } = await client
      .from('login_directory')
      .upsert({ user_id: userId, email, phone });
    if (directoryError) throw new Error('This phone number is already used by another login');
    if (existing) {
      const { error: mailError } = await publicAuth().auth.resetPasswordForEmail(email, {
        redirectTo: request.nextUrl.origin + '/auth/callback?next=/reset-password',
      });
      if (mailError)
        throw new Error('Login is enabled, but the email could not be sent. Check SMTP settings.');
    }
    await client
      .from('staff')
      .update({
        data: { ...staff.data, login_user_id: userId },
        version: staff.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', staffId)
      .eq('org_id', member.org_id);
    await client.from('audit_events').insert({
      org_id: member.org_id,
      actor_id: member.user_id,
      entity: 'staff',
      record_id: staffId,
      action: 'enable_login',
      reason: 'Owner enabled staff login',
      new_data: { email },
    });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invitation failed' },
      { status: 400 },
    );
  }
}
