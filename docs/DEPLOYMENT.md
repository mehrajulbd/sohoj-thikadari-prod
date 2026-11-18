# Deployment: Vercel + Supabase

## 1. Create the database

1. Create a new Supabase Free project in a suitable nearby region. Start with a fresh database as agreed.
2. In SQL Editor, run the complete contents of `supabase/migrations/202611190001_workspace.sql` once. Do not run fragments or apply this initial migration over a populated production schema.
3. Confirm the tables, RLS policies, and functions exist. Database business writes are allowed through `apply_operation`, cancellation/reversal, and preference RPCs. Direct browser table writes are denied.
4. Copy the Project URL from the Connect dialog. Open Settings → API Keys for the publishable key (`sb_publishable_...`) and server secret (`sb_secret_...`). The app retains its existing environment variable names: put the publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server secret in `SUPABASE_SERVICE_ROLE_KEY`. Legacy anon/service_role keys are compatible, but prefer the current key types for a new project.
5. No Storage bucket is required.

For CLI workflows, link the intended project, commit/review future migrations, and use `supabase db push`. Never reset a production database as an update method.

## 2. Configure authentication

### Password and phone/email login

Enable email/password authentication. Disable **Confirm email** to match the requested signup flow without a verification step. Use a minimum password length of at least eight characters.

Email is mandatory for every login-enabled account. A staff directory record without login can omit it. The login form accepts email or phone plus password. Phone sign-in uses a private server endpoint to authenticate the same email-backed identity. Bangladesh local phone numbers are normalized to `+880...`; use a unique phone for each login. SMS authentication and an SMS provider are not required.

The first successful owner session calls `get_workspace`, creating that owner's private organization and starter expense heads. Owner public signup must not be used to create a staff account: the owner adds the staff directory entry and enables login through the staff screen.

### Production SMTP

Set custom SMTP in Supabase Auth before public invitations or password resets. Supabase's default SMTP is restricted to project-team addresses and is intended for development. A provider's small free allowance may suit an initial pilot; sending limits and domain requirements depend on that provider.

For a concrete SMTP option, Resend requires a verified sending domain and an API key. Add your domain in Resend, publish the DNS records it provides, wait for verification, then create an API key allowed to send from that domain. A `vercel.app` app URL is fine for hosting, but cannot substitute for a sending domain whose DNS you control.

In Supabase → Authentication → Email → SMTP Settings, enable custom SMTP and enter:

| Setting | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | An address on the verified domain, e.g. `no-reply@YOUR-DOMAIN` |
| Sender name | সহজ ঠিকাদারি |

The Resend key belongs in Supabase SMTP settings, not the Next.js environment. See [Resend's Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp).

Set sender name to সহজ ঠিকাদারি / Sohoz Thikadari. Test delivery and spam-folder placement. Never show an email-sent success if the mail API returned an error.

For reset and invitation templates, prefer token-hash links so invite/recovery links also work when opened on a different device:

```html
<!-- Password recovery -->
<a
  href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password"
  >পাসওয়ার্ড পরিবর্তন করুন</a
>

<!-- Staff invitation -->
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/reset-password"
  >অ্যাকাউন্ট চালু করুন</a
>
```

These links establish the Supabase session and open the password-setting page. Invitations grant membership only through the owner's server-authorized invitation action, never by matching unverified contact information alone.

### Google

1. Create a Google OAuth web client and enable Google in Supabase Auth Providers.
2. Add the Supabase callback URL shown by the provider to Google's authorized redirect URIs, usually `https://PROJECT.supabase.co/auth/v1/callback`.
3. Add your application origin to the appropriate Google origin configuration.
4. Enable manual identity linking in Supabase to support **Connect Google** from an already signed-in password account. Do not create a new staff record to link Google.
5. Verify that linking retains the same user ID, staff directory entry, organization and transaction history. Inspect automatic identity-linking behavior when using unconfirmed password signup. Do not implement your own merge based on an unverified email string.

References: [Supabase passwords](https://supabase.com/docs/guides/auth/passwords), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## 3. Deploy to Vercel

1. Push the new root application to a repository, preserving `OLD APP/` only if desired. Vercel's root directory must be this Next.js application, not `OLD APP/Frontend`.
2. Import the repository with the **Next.js** framework preset.
3. Use Node 24, install with `npm ci`, build with `npm run build`, and retain the default Next.js output directory.
4. Add the three variables from `.env.example` to the correct Vercel production/preview environments. Never prefix the service-role key with `NEXT_PUBLIC_`.
5. Deploy. Use the final HTTPS production URL when configuring redirects and email templates.

No cron jobs, paid SMS, attachment storage, or separate Express server are required.

## 4. Set redirect URLs

In Supabase Auth URL Configuration:

- Site URL: your final HTTPS Vercel/custom-domain origin.
- Redirect URLs: `https://YOUR-DOMAIN/auth/callback`, `https://YOUR-DOMAIN/auth/callback?next=/reset-password`, and exact equivalent localhost URLs for local testing.
- Prefer explicit trusted deployment origins. Do not allow arbitrary origins for password recovery. Add specific preview origins only when required.

Never redirect a recovery token to an arbitrary `next` query parameter. The application permits only its own home/password-setting destinations.

## 5. Connected smoke test before business use

Use test data, then remove the test organization through an administrator-controlled process if needed.

1. Sign up an owner using email/password, add a unique phone, and test both identifiers.
2. Request password recovery and open the email link on another device. Set a password, then sign in again.
3. Connect Google while signed in. Verify the same records and organization remain accessible.
4. Create at least two firms and two staff entries. Enable staff login, accept the invitation, and set a password.
5. Verify staff can create dispatch/receiving information and own expenses across the owner's firms, while bill amounts, profit, register and other staff balances remain inaccessible through UI and API.
6. Create a multi-truck program, complete receipts, add expenses, give/return/transfer staff money, and confirm balances.
7. Bill whole programs. Try simultaneous billing from another owner browser tab: the database must reject the duplicate allocation.
8. Enter program-wise adjustments and tax, settle the bill, and add an extra dated receipt. Verify historical/lifetime and transaction-date totals.
9. Install the PWA, revisit operational pages online, go offline, add a program/dispatch/receipt/expense, close and reopen, then reconnect and sync. Check the same record is created once. Try a conflicting edit from another device and review the conflict explicitly.
10. Download Bangla and English PDFs, CSV and Excel files. Test a bill/register with 100+ lines and actual printing.
11. Revoke a staff account and confirm online access/sync fails on that device.
12. Export a database backup and rehearse restoration to a separate test project.

## Backups and free-tier operation

The app's data exports aid reporting and portability, but are not a complete PostgreSQL disaster-recovery backup. Regularly use Supabase CLI/database dump tooling to export business tables and migration history to secure storage. Keep auth identity mappings and any restoration dependencies documented. Protect dumps because they contain business and contact data. Test restoring to another project.

Supabase Free currently lists 500 MB database storage, 1 GB file storage, 5 GB egress and inactivity pausing after one week, without automatic database backups. No file uploads are used here. Track database growth and export bandwidth in the project dashboard.

Vercel's Hobby plan restricts use to personal, non-commercial projects. This deployment is technically Vercel-compatible, but a contractor business should choose a plan whose usage terms allow that business use. Staying under resource limits alone does not change the terms.

References: [Supabase pricing](https://supabase.com/pricing), [database backups](https://supabase.com/docs/guides/platform/backups), [Vercel Hobby](https://vercel.com/docs/plans/hobby).

## Future updates

- Commit the lockfile and use `npm ci` for reproducible deployments.
- Add a new SQL migration for schema changes; do not edit an already-applied production migration.
- Keep offline operation payloads backward-compatible while users have pending entries.
- Increment the service-worker cache version when changing shell caching behavior. Existing waiting workers activate after old app windows close, keeping users' drafts safe.
- Do not rotate public database credentials or delete tables without checking pending-device entries and backup/rollback plans.
