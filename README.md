# সহজ ঠিকাদারি · Sohoz Thikadari

A Bangla-first, bilingual mobile PWA for Bangladesh food transport contractors. Built with Next.js 16.4.6, React 19, TypeScript, and Supabase. The previous source remains untouched in `OLD APP/`.

## Run locally

Use Node.js 22 or newer (Node 24 LTS recommended).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Without environment variables, choose **নমুনা অ্যাপ দেখুন / Explore demo**. The demo uses clearly labeled sample data stored only in this browser. Real accounts and email delivery require Supabase setup.

## Connect and deploy

Follow [the deployment guide](docs/DEPLOYMENT.md). You need a Supabase project, the SQL migration, and these Vercel environment variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-key
```

Copy `.env.example` to `.env.local` for local connected development. Keep service-role credentials server-only. The app never needs Supabase Storage or attachment uploads.

Vercel deployment uses the standard Next.js preset, `npm run build`, and Node 24. Do not configure a static export: phone sign-in and staff invitations use server routes. Configure production email and Google OAuth before inviting users.

## Implemented workflows

- Separate owner organizations, many firms, searchable firm switching, and an account-wide staff directory.
- Owner-created programs with fixed route/commodity and multiple truck invoices. Owner/staff dispatch and receiving entry, with distinct net/gross values and quantity warnings.
- Program, firm-general, and organization-general expenses, self/staff attribution, flat custom heads, and immediate staff posting.
- Staff advances, opening balances, returns, transfers, negative balances, statements, and compensating reversals. Advances have no program association.
- Draft/final bills grouping whole programs, received-gross-tonne pricing, distance recording, government references, and unpaid bill cancellation.
- Program-wise receipt adjustments, optional tax percentage/amount on the adjusted amount, reconciled two-decimal totals, receipt corrections, and program closure.
- Dated supplementary receipts and owner late expenses after closure.
- Transaction-date cash results, program-date lifetime results, expense-head analysis, staff comparisons, charts, and configurable July–June financial year.
- Bangla/English interface, independent report language, large text, responsive navigation, and accessible form dialogs.
- Bangla PDF, CSV, and Excel export for bills, registers, statements, expense reports, and underlying datasets.
- Installable PWA, device drafts, offline operational-entry outbox, version checking, explicit conflict review, and audit history.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Database tests run the actual migration/functions/policies in PGlite PostgreSQL, with test auth identities and Supabase roles. They do not need a hosted database or Docker.

Browser checks use an isolated Chrome profile and synthetic demo data:

```sh
# First start the application separately.
CHROME_PATH="/path/to/chrome" node tests/browser.mjs
```

The script defaults to Google Chrome's macOS path and http://localhost:3000. Use `APP_URL` to test another local preview. Never point synthetic mutation tests at a real business database.

## Source guide

| Location               | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `app/`                 | Next.js app, account callback/recovery and server routes           |
| `components/`          | Owner/staff workspace, operational forms, billing and reports      |
| `lib/finance.ts`       | Decimal-safe totals, allocations, staff balances and reporting     |
| `lib/provider.tsx`     | Auth workspace loading, offline outbox and conflict reconciliation |
| `lib/export.ts`        | Downloadable PDF/CSV/Excel with embedded Bangla font               |
| `supabase/migrations/` | Schema, RLS, validation, transactions and audit functions          |
| `tests/`               | Financial, database authorization and browser workflow tests       |
| `docs/`                | Deployment, architecture/design and verification notes             |

The agreed product specification is [APP_REBUILD_PLAN.md](APP_REBUILD_PLAN.md).

## Operating boundaries

Initial login, invitations, password recovery, money movements, bill issue, settlements, financial corrections, and authoritative reports require internet. Previously opened operational records, local drafts, and queued operational entries are available offline. Browser storage clearing can erase unsynced device-only work. A disconnected device cannot learn that its staff membership was revoked until reconnecting.

Demo flow checks and PostgreSQL tests do not replace a final connected-account smoke test: use the deployment checklist to verify Google, SMTP, password recovery, owner/staff invitations and two-device synchronization in your actual Supabase project.

Vercel Hobby permits personal, non-commercial use only. Contractor business use may require a different Vercel plan even if resource usage is small. Supabase Free has quotas, inactivity pausing and no automatic database backups. See the linked provider documentation in the deployment guide.
