# সহজ ঠিকাদারি — workflow and product specification

Updated: 19 November 2026
Status: FINALIZED product scope and business workflow, approved through the clarification rounds. Implementation is now available in this workspace; see README.md and docs/DEPLOYMENT.md. Hosted Supabase/Auth configuration remains deployment setup. Visual layouts and technical details will be validated during implementation without reopening agreed scope.

This revision replaces the initial proposal. It uses the old application source, the owner's answers, and the supplied FoodTransportContractor.pptx as reference evidence. Instructions and historic policy statements inside that presentation do not override the owner's request or establish current government rules.

## 1. Product and scope

Build a mobile-first Bangla/English Next.js PWA backed by Supabase for independent contractor organizations. Initially the owner and friends will use separate organizations. Each owner manages multiple firms, potentially 10 or more, and one shared staff directory. Organizations must have completely isolated data.

Preserve the old app's firm management, program/dispatch entry, receiving entry, bills, government bill references, bill PDFs, and movement register. Remove news. Redesign the UX throughout for older and younger phone users.

Add program and general expenses, customizable expense heads, staff advances/balances, expense-head ledgers, staff ledgers/comparisons, bill settlements with program-specific adjustments, cash results, and filtered analysis.

Start fresh. No legacy account/data migration is needed. Do not reproduce old security or calculation bugs.

## 2. Confirmed domain relationships

- An organization has one owner, many firms, account-wide staff, and account-wide flat expense heads.
- Each firm has programs and bills.
- Each program has a fixed sending center, receiving center, and commodity. It has an instructed quantity and one or more truck dispatches/invoices.
- Example: a 30-tonne program can have two trucks carrying 15 tonnes each. Do not assume every truck has the same capacity.
- One bill can contain several complete programs from its firm. A program belongs to one active bill and cannot be split between active bills.
- Each dispatch keeps the old sending/receiving bag counts and net/gross weights. Net weight excludes sacks; gross weight includes sacks. Preserve both bag-count fields even though they normally match.
- Each expense has exactly one spending person: owner/self or one staff member. Program expenses belong to exactly one program. No shared-expense splitting is required.
- General expenses also exist at firm or organization scope. Staff remains the spending-person dimension, rather than an additional amount counted again.
- Staff login is optional. A staff directory record and its financial history must exist without a login.
- Staff with access can operate across all firms in their owner's organization. They see their own expenses, advances, and balance, while the owner sees all staff. Each staff login belongs to one owner organization initially.

## 3. Roles and authentication

There are two permission types only: Owner and Staff. All staff have the same permissions. There are no staff job-role hierarchies, driver/vendor roles, or per-firm role variants in the launch scope.

Owner:

- Creates and manages firms, programs, staff, and expense heads.
- Manages advances, settlements, bills, receipts, reports, profit, and movement register.
- Sees organization-wide and firm-specific results.
- Reviews history and corrects records through tracked changes.

Staff with optional login:

- Sees the operational records needed for assigned work across the organization.
- Adds truck invoices, enters/updates sending and receiving information, and updates operational progress. Owner can perform the same actions.
- Posts own expenses immediately without approval and makes tracked corrections to permitted open-program entries.
- Sees own expenses, advances, returns, transfers, and balance. Other staff financial information remains owner-only.
- Cannot access owner-only bill amounts, profit, movement-register data/exports, or financial reports through either UI or API.
- Cannot create programs.
- Uses existing expense heads first and can add a missing head from expense entry. Owner manages renaming/archival. This interprets the accepted simple entry workflow; it can be changed without adding staff role types.

Login: one Email or phone field plus password, forgot password by email only, and Google sign-in. No signup email/SMS verification step is requested. Phone is a password-login identifier, not SMS OTP login. Enable a directory staff member through an owner-controlled invitation/activation flow. Membership must be established by that invitation, never merely by matching an unverified email or phone. A staff invitation grants access to the intended organization and must not create an owner organization. First login and recovery require connectivity.

Google connection happens from an authenticated account through an explicit Connect Google action, preserving membership and staff history. Do not merge or grant organization access solely on matching self-entered contact fields. Supabase supports signed-in identity linking; inspect automatic linking behavior when configuring unconfirmed email/password signup. See [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) and [password authentication](https://supabase.com/docs/guides/auth/passwords).

Proposed implementation for dual identifier login: canonical email/password Auth identity with a private, rate-limited server endpoint resolving normalized phone to the same identity. Never expose a public phone-to-email directory, service credentials, or fake generated email addresses. Validate this path in an Auth prototype. A real recovery email is mandatory for every login-enabled owner/staff account, including phone-login users. No signup verification step is required. Directory-only staff may omit email until login is enabled.

Staff directory fields: name, phone, email, active/inactive. Email is optional only while login is disabled and required before enabling login. Deactivating staff revokes access while retaining historic expenses, advances, and balances.

## 4. Mobile information architecture

Proposed owner navigation: Home, Programs, Accounts, More. Validate against task testing before locking the visual layout.

- Home: organization/firm context, pending operational work, add program, add expense, receiving shortcut, bill shortcut.
- Programs: searchable cards with quantity progress, truck count, receipt progress, next action, and a distinct payment/closure indicator for the owner.
- Accounts: expenses, money given/returned, bills, receipts, ledgers, and simple analysis. Use plain task labels instead of accounting terminology where possible.
- More: firms, staff, expense heads, movement register, exports, language, help, account settings.

Staff navigation is simpler: Tasks, Add expense, My activity, More. My activity includes own balance and statement, not other staff balances or organization profit.

For 10+ firms:

- Searchable firm switcher with recent/favorite firms and persistent active context.
- Owner overview offers All firms for reports and tasks, with visible firm names on records.
- Entry screens require one firm when appropriate. A selected program supplies its firm automatically.
- Organization-wide advances and general expenses have explicit scope; never silently attach them to whichever firm was last open.
- Searching programs supports firm, program number, invoice number, and truck number.
- Open a program and expose its immediate actions: Add truck, Add receiving details, Add expense, and View progress.
- Offline and unsynced records show a clear badge and do not appear server-confirmed.

## 5. Operational workflow

### A. Setup

Owner signs up or signs in, creates a firm, optionally creates staff directory entries, and enables staff login through invitation if needed. Add additional firms without repeating organization setup. Seed suggested expense heads and allow customization.

### B. Program creation

Owner selects firm and enters program number/date, commodity, instructed quantity, sending center, and receiving center. Program exists before any truck dispatch. Optional assignment for operational work is not presumed; staff access is organization-wide.

Show instructed, dispatched, received, and remaining quantities with explicit net/gross labels. A quantity mismatch shows a warning and does not block saving/billing. Receiving must be recorded for every included dispatch; the owner acknowledges any instructed-versus-actual difference. Quantity thresholds are not a hard completion gate.

### C. Dispatch and receiving

Add one dispatch per invoice/truck movement with invoice number, truck number, dispatch date, net bags, net weight, and gross weight. Keep program details inherited rather than asking users to re-enter them.

Receiving records receipt date, net/gross bags, net/gross weight, and shortage information for each dispatch. Show sending and receiving quantities side by side. Zero shortage is valid. Preserve independent values for every field.

Staff may update operational progress but may not manufacture financial closure by changing an arbitrary status value. Derive aggregate program progress from dispatches, receipts, and owner-controlled settlement facts.

### D. Scope boundary

Keep the workflow simple. Do not add tendering, agreement, rotation, fourth-copy tracking, gate passes, or government office-processing checklists. The presentation explains the surrounding real-world process; those stages do not become additional app requirements. No file uploads.

### E. Bill creation

Owner selects whole eligible programs in one firm. The bill builder includes their truck invoices and groups the print lines/subtotals by program. Save a draft, review bill number/date/recipient, quantities, rate, distance, and amount, then finalize.

Finalize in one server transaction. Lock/recheck eligibility and prevent a program from belonging to two active bills. Preserve a finalized snapshot of rates, amounts, quantities, identity/header details, document language, and calculation version.

One program remains under one active bill even with several trucks. It becomes eligible after its dispatches have receipt data. A lower actual quantity warns but does not block owner billing. Owner decides when all truck entries for that program are complete.

### F. Submission, government reference, and actual receipt

Keep government bill number/date separate from submission and actual payment receipt. Reference presentation slides 33–37 distinguish office processing, cheque issue/handover, verification, and cashing. Do not treat cheque collection as money received automatically.

Each bill has one initial settlement, without installment-payment workflows. Owner may later append dated supplementary receipts for specific programs, preserving the original settlement and issued bill. Record actual received date, optional reference, and net money received. Store adjustments per program with a reason and type: tax, shortage deduction, other fine/deduction, or extra allowance/payment.

Confirmed reconciliation per program:

    base transport amount
    + extra allowances
    - shortage deductions
    - other deductions/fines
    - tax withheld
    = net received allocation

The bill document excludes advance income tax deduction. At settlement, owner can enter the tax as a percentage or amount, record actual net money received, and see the tax separately. Percentage and amount are two input modes for one deduction, never two deductions. Keep adjustments/tax allocations program-wise with clear reasons. The sum of program net allocations must equal the bill's actual net receipt; surface discrepancies for correction instead of inventing a balancing entry. Tax percentage applies to the final amount after extra allowances and all pre-tax deductions. Monetary totals use two decimal places. For multi-program bills, calculate each program's adjusted base and allocate the bill-level rounded tax deterministically so program totals reconcile exactly. Do not hardcode the stated 1–3% range as universal policy.

Close a program when the government bill has been received and actual money receipt is recorded. Close the paid bill's programs together. Owner may add late expenses/corrections without a separate reopening ritual, with a mandatory reason and audit history; results update visibly while preserving the original settlement. Staff cannot change closed programs. Finalized bill changes use versioned correction/reversal rather than silently replacing the issued document.

## 6. Expense entry

Simple entry flow:

1. Choose Program expense or General expense.
2. Choose a program, or select Firm/Organization for a general expense.
3. Choose an existing head, enter amount and reason, confirm date.
4. Confirm Self or one staff member and save.

From a program, prefill its firm/program. From staff login, propose that staff member as spender. From owner login, default Self and provide a large staff selector. A staff member entering an expense for another person must not be silently assumed.

Required stored fields: business date, positive amount, expense head, reason, spending person, scope, and program/firm where applicable. Record entered-by user separately from the person who spent the money. No photos, attachments, installment accounting, or supplier directory.

An expense represents money spent. No unpaid quotes, commitments, or partial expense payments. Spending beyond a staff advance is allowed and produces a negative staff balance. Office asset purchases are general expenses and reduce the selected scope's cash result immediately in this simple management view; depreciation/fixed-asset accounting is outside launch scope.

Heads are flat and account-wide. Suggest and search existing heads before showing Add new head. Example seeds: truck hire, staff transport, staff food, loading/unloading, other. Final seed labels can be tuned without changing the data model. Renaming/archiving must retain historical associations; never delete a used head's transactions.

## 7. Staff money and ledgers

Owner actions: Give money, Record expense, Receive money back, Transfer between staff, Record opening balance, View statement. All these are launch scope. Staff transfers create paired movements in one transaction; a transfer adds no income/expense and changes no organization-wide total. Owner records or corrects money movements; staff see the movements affecting their balance.

Core staff-held-money calculation:

    opening balance
    + money given
    + transfers in
    - expenses spent by staff
    - money returned
    - transfers out
    = balance

Example: Give ৳100,000 to staff at organization level, with no program attached. That staff member spends ৳50,000 on Program A, ৳30,000 on Program B, and ৳10,000 on a general office purchase. Staff balance is +৳10,000. Program A cost is ৳50,000, Program B cost is ৳30,000, and general cost is ৳10,000. Total expenditure is ৳90,000, counted once. Giving the advance is not a program expense.

If a staff member records expenses spanning several firms, their single organization balance aggregates them; firm/program reports retain expense attribution. Do not invent separate firm cash balances when funds were given organization-wide.

A positive staff balance means organization money still held. A negative balance means money owed to the staff member. Reimbursement must settle that balance without becoming another expense.

Staff statement shows date, description, money in, money spent/returned, and running balance. Exports can include debit/credit terminology with an explicit sign convention, while mobile entry uses plain-language labels. Date-filtered statements show opening balance before the range, in-range movement, and closing balance.

Scope rules prevent duplication:

- Program expense contributes to its program, its firm, organization, head, and staff views as the same transaction.
- Firm general expense contributes to that firm and organization; it is not allocated to programs automatically.
- Organization general expense contributes to organization total only; it is not replicated across firms.
- Staff is the spender filter and balance holder, not a separate extra expense bucket.

## 8. Cash results and analytics

Owner-only main result:

    actual net initial and supplementary receipts in the selected scope
    - expenses actually spent in that scope
    = net cash result

Label program-level results as received amount minus program costs. Firm result also subtracts that firm's general expenses; organization result includes all firm and organization expenses. Do not silently spread overhead across program margins.

Staff advances, staff returns, reimbursements, and transfers must not create extra profit or loss. A separate money-held summary may show unsettled staff balances. Full bank-account accounting and capital/drawings tracking are not assumed.

Offer two explicitly labeled date modes:

- Transaction dates: receipt date for cash in and expense date for spending. This explains cash result for a month/year and may include expenses from programs not yet paid.
- Program dates: select programs by their program date, then show their lifetime costs and receipts with the period basis clearly stated. General expenses require a separate display/filter rule and must not be forced into a program cohort.

Confirmed filters: firm, program, date mode/range, staff, expense head, and relevant progress/payment states. Route/commodity filters are not needed. Applying staff/head filters to profit requires care: filtering expenses does not automatically allocate revenue to a person or category. Default those filters to cost/staff ledgers unless an explicit allocation rule is agreed.

Initial charts, kept optional beneath clear totals:

- Net receipts, spending, and cash result over time.
- Spending by head.
- Firm/program comparisons and positive/negative program results.
- Staff money given, money spent, money returned, current balance, and spending by head.
- Staff activity counts and expense totals over a selected period.

Do not label higher spending as poor performance or assign program profit to the staff who merely entered data. Distinguish Spent by from Entered by when counting activity. Confirmed staff comparison metrics are programs worked on, operational entries, spending by head, money given/returned/transferred, and balance. Use an optional responsible-staff field and actual recorded activity for program associations; profit stays at program/firm/organization level.

## 9. Documents, exports, and language

Bangla default with a persistent English switch. Report language defaults to Bangla independently of UI language and can be changed in settings. Translate forms, validation, statuses, help, charts, and offline messages. Custom names/reasons remain as entered.

Accept Bangla/Latin digits, normalize numeric input, and preserve official numbers as text with slashes/leading zeros. Show metric tonnes, bag counts, kilometres, and BDT explicitly. Use Gregorian business dates and Asia/Dhaka audit timestamps.

Preserve the old bill and movement-register column meaning/layout, improve header, typography, wrapping, grouping, and pagination. Use the existing landscape Legal-paper layout as the initial export basis, while improving readability and retaining the supplied sample's useful program grouping. Do not drop required columns to make the output decorative.

Reference slides 31–32 contain actual bill samples and are evidence for grouped truck rows/program subtotals. Confirmed calculation: received gross tonnes × per-tonne rate. Distance is retained for reference and is not multiplied again. Preserve full precision across truck line calculations and round after the total, not independently per truck. Round final monetary totals to two decimal places, with program subtotals/allocations reconciled to the bill total.

All raw data and reports need PDF, CSV, and Excel downloads, subject to owner/staff access limits. Use labeled sheets/columns, export active filters, preserve numeric/date types in Excel, and make full-data downloads explicit. Staff exports cannot bypass financial permissions.

Use licensed Bangla fonts and inspect conjuncts, mixed scripts, long headers, repeated table headings, totals, signature space, and multi-page output. Generate exports on demand; no uploaded attachments or persistent document storage is required.

## 10. Offline operation and synchronization

User preference: perform multiple operations offline, then synchronize when connectivity returns. This expands launch scope beyond local draft recovery.

Proposed offline support after a successful online sign-in and initial download:

- Owner: create programs, add operational information and expenses. Money movements remain online for initial release to keep cross-staff financial balances authoritative.
- Staff: add expenses and permitted operational updates against previously synchronized accessible programs.
- Cache only necessary user-scoped operational data. Owner-only financial data must not be present in a staff cache or API response.
- Show Saved on this phone, Waiting to sync, Synced, and Needs review distinctly.
- Maintain an outbox with device-generated operation IDs, dependencies, retry state, and version information.
- Retry uploads safely when the app is open, with manual Sync now. Background sync is an enhancement, not the only route.
- Validate membership, active staff, dates, balances, related records, and permissions on the server at sync time.
- Keep conflicting financial changes for owner review; do not apply silent last-write-wins to balances, expenses, settlements, or closed programs.
- Do not lose unsynced work on refresh/update. Warn before logout or account switching; browser storage clearing can still erase local-only data.
- Revoked access cannot be learned by a disconnected device until it reconnects. Retain only that signed-in user's necessary authorized working records and pending operations while signed in; clear private caches on completed logout. Revalidate permission/session on reconnection before syncing or fetching. Previously cached data may remain accessible on a disconnected signed-in device until it reconnects.

Agreed online-only actions: enable/invite staff login, final bill issue, payment settlement/program financial closure, financial corrections/reversals, and authoritative full organization reports. Money movements also start online. Offline summaries show when they last synced and whether local entries are included. This preserves the accepted offline operational-entry scope.

Test repeated uploads, multiple devices, duplicate references, changed programs, staff deactivation, category archival, stale balances, and sync after bill closure. Financial validation must not silently discard a queued transaction.

## 11. Architecture and data integrity

Implementation uses Next.js 16.4.6/TypeScript PWA with Supabase Auth/Postgres and row-level security. Per the implementation request, Vercel is the target host. Standard Next.js server routes handle private phone login and staff invitations; this is not a static export. Hosting conditions were checked on 18 November; recheck actual provider terms/quotas before deployment. No attachments keeps storage needs lower, but database, email delivery, exports, and offline complexity still need monitoring.

Workspace routes use authorized client record lookup, with server-only Next.js routes for privileged authentication tasks. Authorized Postgres functions perform financial transactions. Privileged credentials never ship to the browser.

Proposed entities:

| Entity | Responsibility |
| --- | --- |
| organizations | Owner's shared boundary for firms, staff, heads, and access |
| memberships | Auth user to organization, owner/staff access, active state |
| profiles | Account preferences and identity display |
| firms | Contractor identity/contact/document header fields |
| staff | Directory identity, contact details, active state, optional linked membership |
| expense_heads | Organization-wide flat categories, active state |
| programs | Firm, fixed route/commodity, original reference/date, instructed quantity |
| dispatches | Program truck/invoice, separate sending/receiving facts and operational progress |
| bills and bill_programs | Bill header, whole-program allocation, finalized snapshots |
| bill_lines | Trusted quantity/rate/amount details by dispatch/program as confirmed |
| program_adjustments | Tax, shortage, fines, extras with amount/reason and calculation basis |
| bill_settlements | One active initial settlement per bill; program allocations reconcile |
| supplementary_receipts | Dated owner-entered extra receipts linked to a program and its original settled bill; immutable original settlement |
| expenses | Single scope, spender, head, amount, reason, business date, entered-by |
| money_movements | Staff advances, returns, opening entries, reimbursements/transfers as agreed |
| audit_events | Immutable actor/time/change/reason history |
| sync_operations | Idempotency and operation reconciliation |

Use UUID internal IDs, original document references as text, numeric decimals for money/weights/rates, integer bag counts, date-only business fields, and timezone-aware audit times. Retain sufficient decimal precision for source weights and intermediate calculations; round final monetary totals to two decimals. Validate entered source precision against representative documents during implementation rather than truncating it silently.

RLS must enforce organization isolation and owner/staff permissions on every private table. Sensitive financial fields may require separate tables/views; hiding UI elements is insufficient. Server functions authorize user and organization before any mutation. Cross-firm programs cannot enter one bill unless explicitly authorized later.

Financial operations are transactional and idempotent. Reserve whole programs against duplicate active bills. Finalization, settlement, cancellation/reversal, and staff balance changes must retain consistency under concurrency. Store original and correction history rather than deleting evidence.

Deactivation/archival preserves referenced history. Used firms, staff, categories, settled programs, and finalized bills cannot be hard-deleted through routine UI.

## 12. UX and acceptance requirements

- One-column phone forms with persistent labels, large targets, and one clear primary action.
- Approximately 18px base text, readable Bangla line height, large-text preference, and 200% zoom support.
- 48px minimum targets, labeled icons, strong contrast, keyboard/screen-reader support.
- No essential horizontal scrolling for mobile tasks; large document preview may pan/zoom.
- Preserve work after errors, refresh, connectivity loss, and language switching.
- Clearly identify selected firm, spender, expense scope, and sync state before submission.
- Owner and staff both have a suitable home screen without exposing restricted information.
- Search/suggestions reduce retyping; allow new head only after existing options are visible.
- Use Bengali plain-language actions rather than forcing users to understand debit/credit.
- Track all edits with author, time, old/new values, and required reason for financial corrections. Financial corrections preserve prior values and issue any necessary compensating/replacement records atomically.

Critical verification scenarios:

1. 30-tonne program with two truck invoices appears once under one bill and cannot be split across bills.
2. Receipt net/gross weights and bag counts retain deliberately different test values.
3. Staff advance 100,000 and expenses 90,000 yields balance 10,000 and expenses 90,000 exactly once.
4. Firm/global general expenses roll up once and do not inflate program costs.
5. Program adjustments reconcile to the bill's net received amount; tax uses the adjusted base, is visible, and is not deducted twice.
   A bill of 100,000.00 plus extras of 5,000.00 less deductions of 2,000.00 has adjusted base 103,000.00; 2% tax is 2,060.00 and net receipt is 100,940.00.
6. Monthly transaction-date result differs correctly from program-date lifetime analysis.
7. One organization cannot read another's data; staff cannot fetch owner-only finances or exports.
8. Retried/offline operations do not duplicate expenses or advances; conflicts remain recoverable.
9. Correction after settlement preserves the old bill/receipt/audit history and accurate revised results.
10. PDF, CSV, and Excel totals match filtered server data and preserve Bangla labels.
11. Older and younger users complete program, receipt, expense, and bill tasks on real phones.
12. Backup/restore and export are verified before real business records depend on the system.
13. An extra receipt after closure updates cash result on its own date and lifetime program result, while retaining the original settlement unchanged.
14. Recovery email is required for each login-enabled identity. Phone/email password login and Connect Google reach the same organization and history.
15. Financial-year reports default to 1 July–30 June and respect the configured organization start month.

## 13. Delivery sequence

1. Use this finalized scope and its worked examples as the implementation baseline.
2. Prototype owner/staff navigation, 10+ firm switching, program detail, quick expense, staff balance, and settlement.
3. Implement Auth, organizations/memberships, schema, RLS, audit trail, firm/staff/head setup.
4. Implement program, multi-truck dispatch, receiving, and quantity warnings.
5. Implement expense entry, general scopes, staff money movements and ledgers.
6. Implement grouped bills, program adjustments, settlement/closure, cash reports and comparisons.
7. Implement/verify offline outbox and reconciliation alongside each mutation workflow; complete device conflict tests before pilot.
8. Verify bilingual PDFs/CSV/Excel, access boundaries, backups, and real-phone pilot.

## 14. Agreed calculation and reference rules

- Transport revenue: received gross tonnes multiplied by the entered per-tonne rate. Distance is reference data and is not multiplied again.
- Preserve full precision across truck calculations and round after totaling to two decimal places. Reconcile displayed program allocations/subtotals to the authoritative bill total; do not accumulate independent truck rounding errors.
- Shortage is visible, but the owner enters any monetary shortage deduction and reason. Do not automatically apply a 1.25% allowance or a government penalty formula.
- Bill is issued before tax deduction. Tax applies to the final pre-tax amount after every allowance/deduction adjustment. Settlement stores actual net receipt plus separate advance-income-tax percentage/amount. Tax input modes describe the same deduction.
- Money given to staff has no program link. Expenses alone carry program/general scope.
- Returns, opening balances, transfers, and negative balances are supported. Advances/transfers/returns/reimbursements do not create profit or cost.
- Reference numbers should normally be unique, but duplicates are allowed after a visible warning/confirmation. Use separate UUIDs to distinguish records; do not impose a hard uniqueness constraint on official numbers. Check duplicates within the relevant organization/firm and explain the context.
- Staff belong to one owner initially. Keep membership schema extendable without enabling multi-owner access in the UI now.
- Staff expenses post immediately. Owner and staff can enter operational information, but only owner creates programs and handles billing/settlement/owner reports.
- Owner-only tracked corrections can add late costs to closed programs and update results. Owner may also record dated extra receipts against closed programs. No silent alteration of issued documents or the original settlement.

## 15. Final approved decisions

1. Email is mandatory for every login-enabled owner/staff account. Phone or email plus password and Google remain supported. Password recovery is email-only; no signup verification step. Staff directory entries without login may omit email.
2. Advance income tax applies to the final adjusted pre-tax bill amount: base transport amount plus extras, less shortage and other deductions. Owner may enter tax percentage or actual amount as alternative modes for one deduction.
3. Monetary totals round to two decimal places after totaling. Preserve line precision and reconcile program allocations to authoritative bill totals.
4. Financial year defaults to 1 July–30 June. Make the starting month an organization preference. Standard date-range and calendar-month filters remain available independently.
5. Owner may append a dated extra receipt to a closed program and its settled bill. Require amount, business date, reason, and any applicable tax details. Retain the initial settlement unchanged. Update lifetime program/firm/organization results and transaction-date results using the extra receipt's own date. Keep the program closed and preserve actor/time/change history.

## 16. Worked financial examples

### A. Organization-wide staff balance

Owner gives staff 100,000.00 without linking the advance to any program. Staff spends 50,000.00 on Program A, 30,000.00 on Program B, and 10,000.00 on an office asset under organization general expenses. Staff holds 10,000.00. Program A cost is 50,000.00, Program B cost is 30,000.00, organization general cost is 10,000.00. Total expenditure is 90,000.00; the advance contributes no additional cost. Returning the remaining 10,000.00 makes staff balance zero without altering expenditure/profit.

A transfer of 3,000.00 from Staff A to Staff B reduces A's balance by 3,000.00 and increases B's by 3,000.00 atomically, without profit/loss. If a staff member spends more than their balance, retain the resulting negative amount and clear it through reimbursement without another expense.

### B. Adjusted bill, tax, and cash result

Base transport bill: 100,000.00.
Extra allowance: 5,000.00.
Manual shortage/other deductions: 2,000.00.
Final adjusted pre-tax amount: 103,000.00.
Advance income tax at 2%: 2,060.00.
Actual net receipt: 100,940.00.
Program costs actually spent: 70,000.00.
Received-based program result: 30,940.00.

Adjustments are entered against the relevant program(s). For a bill containing several programs, sum their allocations and reconcile to the one actual net receipt. Entering 2,060.00 in tax-amount mode represents the same tax as 2% here; never apply both.

### C. Extra receipt after closure

After example B is settled and closed, owner records an additional net allowance receipt of 4,000.00 on a later business date, with a reason. Lifetime program result becomes 34,940.00. The original 100,940.00 settlement and issued document remain intact. A transaction-date report includes the extra 4,000.00 only in the period containing its own receipt date. Owner-entered late costs work analogously and reduce the result on their expense dates.

This specification is the finalized baseline for implementation. No unresolved product-direction questions remain. Prototype and implementation checks may refine layouts, performance, export pagination, and technical integration while preserving the agreed workflow, permissions, and financial meanings.
