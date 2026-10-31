# Milestone-based implementation roadmap

Status: Phase 1 is the approved baseline; Phase 2 implementation is authorized. See
[PHASE-2.md](PHASE-2.md) and its QA report for current verification and limitations.
The revised Phase 1 record remains in [PHASE-1.md](PHASE-1.md).
Supabase is connection-only; database setup/integration gates move to Phase 2.
The user also specifies Court 1 directly below Court 2 for this phase.
The original milestone definitions below are retained for traceability. Milestones are
ordered by dependencies, not calendar promises. Each gate requires recorded commands,
results, and known limitations. Passing a later demo does not waive an earlier gate.
See `PHASE-1.md` for executed foundation checks; later-phase checks remain unexecuted.

## Phase 0 — Architecture and owner review (completed planning)

Deliverables: workspace inspection, AGENTS.md, architecture, risk/decision register and
this roadmap. Demonstrate scope and proposed rules without provisioning infrastructure.

Acceptance criteria:

- All nine requested modules map to a subsequent milestone.
- Booking concurrency, immutable agreements, private evidence, role authorization,
  scheduled settings and verified-revenue boundaries are explicitly documented.
- Unconfirmed rules have proposed options and decision gates; none is labeled approved.
- No application scaffold, dependency installation, external resource, deployment or
  push is performed as part of this planning task.
- User approves or revises the plan before Phase 1 begins.

## Phase 1 — Local foundation and visual system

Deliverables: pinned Next.js/React/JavaScript/Tailwind project and lockfile; local
Supabase setup; migrations/test harness; initial CI definition; synthetic fixtures;
responsive public shell and design tokens. Select licensed placeholder photos with
source and license records. The revised implementation and its evidence are recorded in PHASE-1.md.

Acceptance criteria:

- A clean local checkout installs with the locked dependency command, starts the app
  and local database using documented commands, and completes a production build.
- Vitest and Playwright each run a meaningful initial test; CI executes lint, unit
  tests and build. Database integration jobs run with a real local Supabase instance.
- No secrets appear in client bundles or tracked files; example environment files
  contain placeholders only. Test credentials stay separate from real accounts.
- At 360, 390, 768 and 1440 CSS-pixel widths there is no horizontal overflow; navigation
  works by keyboard and has visible focus. Core text meets WCAG AA contrast.
- The court map shows 3/4/5 above and 2/1 below on the right, with equivalent labeled
  list controls and accessible names. Layout changes do not change court identity.
- The public shell uses navy, blue, gold and ivory; photo licensing is recorded.

Gate: confirm local Docker/Supabase availability and exact framework versions. Any
external test project needs approval before creation. Brand copy/photo choices may
remain clearly labeled placeholders for the demonstration.

## Phase 2 — Database invariants, Auth, roles and policy engine

Deliverables: schema/migrations, court occupancy constraint, transactional functions,
policy/configuration versions, staff Auth, staff/owner roles, RLS, audit trail and
synthetic seed data. This is the integrity foundation for booking features.

Acceptance criteria:

- Migrations apply to a clean database and seed exactly five courts with the stated
  initial values. Undecided partial refund rate remains unset.
- Twenty concurrent attempts for one court/time result in exactly one occupancy and
  one successful booking transaction; all other attempts return controlled conflicts.
- Adjacent intervals succeed; overlapping private/open-play/maintenance intervals fail
  at the database level, including attempts that bypass the UI.
- Integration checks reject malformed ranges, invalid durations/start alignment,
  closed hours, disabled courts and forged staff overrides.
- Role tests prove guests cannot read customer/evidence/financial tables, staff cannot
  edit roles or policies, and deactivated staff lose access even with an existing session.
- Immediate and scheduled versions resolve before/at/after effective boundaries,
  including court overrides and a service interval crossing a policy boundary.
- A later price/policy change leaves a stored booking agreement byte-for-byte unchanged.
- Audit writes are atomic with privileged state changes; normal staff clients cannot
  update/delete audit records or their own role.

Gate: approve effective-date semantics and staff/owner permission matrix.

## Phase 3 — Public website, availability and guest reservation

Deliverables: public club information, location/contact, configurable public content;
five-court day/calendar view; accessible selection and booking form; server quote;
account-free creation; guest status capability; expiry scheduler and race handling.

Acceptance criteria:

- Guest can book any available enabled court without signing up, entering the approved
  contact fields and estimated player count; server returns a reference and private
  status access. Public availability exposes no names, contacts or private identifiers.
- With initial settings, 08:00 and 22:00 one-hour starts work, 23:00 starts and 22:00
  two-hour bookings fail. Non-hour starts and sub-hour durations fail at the DB boundary.
- A start exactly 60 minutes away is rejected publicly under the proposed strict rule;
  a start more than 60 minutes away works; authorized staff can make a future last-minute
  booking, but still cannot overlap another occupancy.
- Price is PHP 600/hour under the initial policy, computed in centavos on the server.
  Forged amounts and stale quotes cannot produce a booking at an unaccepted price.
- Repeating a creation request with the same idempotency key creates one booking;
  reusing that key with different input fails safely.
- Unpaid holds release within 60 seconds of their deadline while the scheduler is
  healthy. Even with the scheduler paused, an eligible new booking releases the expired
  hold transactionally. Concurrent submissions/expiry cannot resurrect a released hold.
- Guessing a booking reference, changing a token, using another booking's cookie, or
  using a revoked/expired token fails without disclosing customer information.
- Playwright completes the flow at a 390-pixel viewport and by keyboard, with readable
  errors and focus management. Core automated accessibility checks have no serious or
  critical violations; manual checks cover the calendar and court-map alternative.

Gate: owner confirms hours, booking horizon, contact requirements, lead-time boundary,
duration increment and payment cutoff before live booking can be enabled.

## Phase 4 — GCash evidence and staff payment operations

Deliverables: configurable GCash instructions, secure upload, staff review queue,
independent receipt verification, payment ledger and rejection/expiry handling.

Acceptance criteria:

- With a two-hour maximum and one-hour cutoff, a 10:00 booking created at 07:00 has a
  09:00 deadline; one created at 08:30 also has a 09:00 deadline. UI and DB agree.
- A valid in-time submission becomes pending verification and adds zero verified
  revenue. Upload initialization alone does not extend the deadline or submit a claim.
- Oversized, mismatched-content, unsupported-format and unauthorized uploads fail;
  abandoned uploads are cleaned by the documented retention task.
- Anonymous/other guests cannot list or read evidence. Authorized staff can view only
  through expiring access. Private responses are not stored in shared caches.
- Two simultaneous verification attempts create one incoming transaction and confirm
  once. Duplicate receipt references cannot silently count twice.
- Verification checks actual full payment against the immutable agreed total. Wrong
  amounts and invalid state transitions require an explicit staff resolution flow.
- Evidence arriving at/after the deadline follows the approved boundary; review versus
  cancellation/expiry races cannot create a confirmed booking without occupancy.
- A rejected submission and an overdue review each produce the approved visible staff
  action, audited with a reason; they do not silently auto-confirm or grant free time.

Gate: confirm GCash recipient details securely in settings, review coverage/deadline,
rejection handling, retention and manual cash/last-minute staff payment workflow.
No real payment is necessary for acceptance testing.

## Phase 5 — Staff scheduling, open play and customer operations

Deliverables: staff day view, last-minute reservations, closures/open-play blocks,
Reclub event links, customer history, cancellation/rescheduling requests and refund
approval/payout recording. Supply distinct staff and owner navigation/permissions.

Acceptance criteria:

- Staff can block one or multiple courts for open play atomically; if any conflicts,
  the operation creates no partial block. Public availability updates after mutation.
- Reclub links permit approved HTTPS destinations only; script URLs and lookalike
  hosts fail. The UI does not imply that Reclub registration is synchronized.
- Customer search/history is restricted to staff permissions and paginated; public
  reference/contact guessing never exposes another guest's records.
- Reschedule approval validates destination availability in one transaction; failure
  preserves the original slot. Approved changes preserve the original agreement and
  record the accepted new revision, price difference and resolution.
- Cancellation within 24 hours before start does not automatically authorize a voluntary
  refund. Exactly-at-boundary, earlier, club-cancelled and exceptional cases follow the
  approved policy snapshot. An unset partial-refund rate produces manual review.
- Approval alone creates no outgoing cash transaction. Recording a completed payout
  affects net collected once, is permission-checked and cannot exceed the refundable
  verified balance without an explicitly defined exceptional workflow.
- Schedule/payment/customer mutations have a useful audit trail; unauthorized role
  combinations fail in integration tests as well as in the browser.

Gate: approve cancellation exceptions, partial-refund policy, reschedule price treatment,
owner/staff refund authority and who covers payment review shifts.

## Phase 6 — Owner settings, revenue and utilization analytics

Deliverables: owner settings editor for branding, contact, media, hours, per-court rates,
policies and future activation; receipt/refund reports and court utilization dashboard.

Acceptance criteria:

- Owner can change a court's rate, hours and branding without a code change and can
  schedule a future version. Staff attempts are denied at server and DB boundaries.
- Publication previews affected bookings; a schedule change cannot silently cancel or
  rewrite existing bookings. Historical terms remain readable after new activation.
- Stored content and replacement photos cannot inject script or publish private evidence;
  every public photo has source/license metadata.
- Fixed fixture with PHP 1,200 verified receipts, PHP 600 unverified claims and PHP 300
  completed refunds shows PHP 1,200 gross, PHP 300 refunds and PHP 900 net; claims remain
  separately labeled. A merely approved refund does not change those figures.
- For one selected day with five courts open 15 hours each, no closures, 600 confirmed
  private court-minutes and 300 open-play court-minutes, the dashboard shows a 4,500-minute
  denominator, 13.33% private utilization, 6.67% open-play allocation and 20% combined.
- A 60-minute maintenance closure reduces that fixture's denominator to 4,440 minutes;
  scheduled hours and disabled courts are handled according to historical versions.
- Date filters use Manila day boundaries even when the browser is in another timezone.
  Refund date and original booking service date do not silently exchange meanings.
- Sensitive analytics/exports are owner-only; export fields and spreadsheet formula
  injection protection are tested if export is included.

Gate: approve report definitions, branding assets and any export scope. Export is
optional for presentation unless the owner makes it a required workflow.

## Phase 7 — Presentation readiness and separate launch gate

Deliverables: end-to-end owner demonstration, tested local setup/start instructions,
security/accessibility review, operational runbook and a release checklist. A polished
demo and a production launch are separate outcomes.

Presentation acceptance criteria:

- A repeatable synthetic scenario covers public booking, evidence submission, staff
  verification, an open-play block, a customer history and owner metrics/settings.
- Production build, unit suite, real database/RLS/concurrency suite and Playwright
  critical paths pass with recorded test counts; skipped tests and limitations are listed.
- All critical paths work at 360/390-pixel mobile widths and desktop, with keyboard
  operation and no serious/critical automated accessibility violations.
- Seed reset is safe and repeatable on a designated local/demo database; it cannot
  target a production database by default. No demo route can fake verified live revenue.
- No real customer or payment data appears in fixtures, screenshots, logs or demo media.
- Supabase operational commands, scheduler startup/readiness and app startup are
  documented and exercised from their actual directories.

Before a real launch, additionally require:

- Explicit approval for external resources, hosting/network settings, push and deployment.
- Approved business rules, privacy notice, retention schedule and GCash operating process;
  no provisional/undecided terms are silently enabled for live transactions.
- Production role/MFA checks, secrets configuration, rate limiting, job monitoring,
  backup/restore exercise, incident and manual-booking runbooks.
- An agreed forecast and load test; proposed baseline is 20 concurrent booking writers
  with zero conflicting commits and a conflict-free availability p95 below one second
  under the agreed hosting conditions. Record hardware and dataset when measuring.

## Scope changes

Google Calendar remains a later integration: define mapping, idempotency and credentials
only when separately authorized. Avoid implementing speculative adapters now. Re-estimate
milestones when the owner adds memberships, recurring bookings or automated payments.
