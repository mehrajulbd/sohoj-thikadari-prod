# Implementation verification

Verified locally on 19 November 2026 using Node 24.22.0 and Next.js 16.4.6.

## Passed

- TypeScript check and optimized production build.
- 24 automated financial/database checks using the supplied migration in PGlite PostgreSQL with test Supabase roles/auth identities.
- Organization isolation, staff-only expense access, owner-only bills/reports, no direct browser table writes, and denial of guessed owner expense edits.
- Distinct receiving bag/net/gross fields, valid zero shortage, decimal-safe totals, adjusted-base tax, tiny allocation rounding, and invalid/missing financial input rejection.
- Idempotent operation replay, duplicate whole-program bill prevention, correction reasons/version checks, staff transfers/reversals, negative balances, receipt corrections, cancellation and fiscal settings.
- Isolated Chrome workflow on the production build: program creation, dispatch, receiving, whole-program bill issue, tax receipt, and all 14 workspace views without runtime errors.
- 390px mobile workflow/layout and 360px page-width check, with no horizontal page overflow on the tested core views. Wide report tables intentionally scroll inside their own container.
- Production service worker activation, offline reload, offline program entry, persistence after another offline reload, and return online in the synthetic demo.
- Downloadable Bangla PDF, CSV and Excel.
- A 120-invoice bill with long Bangla center names, repeated headers, program subtotal, final total, signature area and page numbering exported to 13 landscape Legal pages. First/last pages were rendered and visually inspected.
- Excel retained leading-zero invoice strings and real date cells.
- Final desktop and phone screenshots inspected. The app uses self-hosted interface fonts and embeds its Bangla PDF font.

## Preview images

- [Desktop](previews/desktop.png)
- [Phone](previews/mobile.png)

## Configuration and checks still required on the actual project

No Supabase credentials or cloud deployment were supplied. Consequently these are implemented and documented but not exercised against the user's hosted project:

- Applying the migration through the Supabase dashboard/PostgREST environment.
- Real signup, phone/email sign-in, Google sign-in/linking, invitations, email delivery and password recovery.
- Two real user/device sessions, outbox synchronization over live PostgREST, and production account deactivation.
- Physical iPhone/Safari installation and printing, older/younger participant usability tests, and real slow-network performance measurements.
- Database backup restoration to a separate hosted project.

Use the connected smoke-test checklist in DEPLOYMENT.md before entering real business data. Demo records are clearly labeled and isolated from real accounts. PDF visual layout was checked; exact Bangla copy/paste/search order can differ across PDF readers because of complex-script shaping, so CSV/Excel provide the structured data export.
