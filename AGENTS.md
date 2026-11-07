# Rally Grounds engineering instructions

## Project and current authorization

Build a single-club pickleball booking and management application for Rally Grounds,
San Juan, La Union, Philippines. Current authorization: Phase 5A synthetic staff
scheduling and operations dashboard on branch `phase-5a-staff-demo`, created from the
completed Phase 4A commit 563eb8b3893ed2b5a882c0f882562775502cff91 (branch
`phase-4a-receipt-demo`, on Phase 3D.2 af6ce95, Phase 3D.1 0172b32 and approved owner-demo
6146af8). See docs/PHASE-5A.md for scope.

Authorized now: the approved Phase 5A staff pages (overview, daily/weekly schedule,
bookings, open play, maintenance, customers, cancellation/rescheduling requests and the
existing receipt review), centralised synthetic fixtures and pure helpers, in-memory
simulations only, their tests, screenshots and documentation, and one conditional local
commit after lint, the complete Vitest and Playwright suites, production build, credential
and client-bundle scans pass on pinned Node 24; then a verified Git bundle. Then stop.
Not authorized: push or publication of any branch, pull request, merge, deployment,
Vercel project-setting changes, changes to owner-demo or earlier phase branches,
production Supabase, staff authentication or authorization claims, real customer records,
live booking/open-play/maintenance mutations, actual cancellations, rescheduling or
refunds, real receipt verification, payment ledger writes, any server/API mutation,
customer communications, persistent simulated state (no cookies or browser storage),
Supabase Storage writes, live receipt uploads, payment gateways, GCash/bank APIs,
webhooks, OCR, guest capability cookies/tokens, backend migrations or Phase 3B.3
expiry-worker integration. GitHub publication requires separate explicit approval; never
push a branch that vercel.json does not exclude.

Staff simulations: every simulated transition changes React state only, is labelled
"SIMULATED ACTION — NO BOOKING CHANGED" and resets on reload. Client-side conflict
warnings illustrate half-open occupancy rules; they are not database enforcement. Do not
let a receipt alone confirm a booking, let evidence revive an expired hold, silently
displace bookings, override occupancy conflicts, or create a payout from a refund approval.
Keep original booking agreements immutable. Do not invent cancellation, rescheduling,
deadline or refund policies or rates.

Payment model (owner requirement): customers pay in the external GCash or banking app and
submit a receipt image; staff independently check the club's actual account records; only
then may an authorized staff member record a verified payment. Image submission, a
displayed reference or a successful upload is never proof of funds. In Phase 4A every
payment, receipt, reference, customer and outcome is synthetic; recipient details are
labeled "DEMO ONLY — NO REAL TRANSFER" and no real account number, phone number, QR code
or credential may appear anywhere. Keep booking status, customer payment claim, evidence
review outcome and verified money received as separate concepts; pending or rejected
evidence contributes zero verified revenue; evidence never extends a hold or revives an
expired reservation. Keep the image size limit and accepted types in lib/demo config.

Preserve the approved design, the shared CourtMap geometry (Courts 3/4/5 portrait above,
2/1 landscape below, 5/2/1 right edges aligned), responsive homepage, the Phase 3D.2
booking flow and accessibility behaviour, and the read-only staff demo. Keep every
demonstration price, operating hour, duration, player option and example policy in
lib/demo; do not invent owner-approved business rules, deadlines, fees or refund terms.
Do not weaken existing tests or hide failures with retries. Follow docs/PHASE-3D1.md for
the interface contracts (references only). Do not merge or depend on unpublished
backend/worker code; Phase 3B security finding H2 remains an unresolved, separate backend
blocker. No credentials, customer data or private evidence in Git.

## Stack and boundaries

- Next.js App Router, React, JavaScript, Tailwind CSS.
- Supabase PostgreSQL, staff Auth, and private Storage for payment evidence.
- Vitest for units/integration and Playwright for browser workflows.
- One club per deployment; reusable migrations and configuration, no SaaS tenant layer.
- Use the existing checkout. Each cloud task is isolated; do not create a Git worktree
  unless the user explicitly requests one.
- Keep browser code separate from privileged server code. Mark privileged modules
  server-only; never expose service credentials through public environment variables.

## Domain invariants

- All reservations, open-play blocks, and maintenance closures compete for the same
  court occupancy resource. Enforce conflicts in PostgreSQL, including concurrent requests.
- Use half-open intervals: an end time may equal the next reservation's start time.
- Store timestamps as UTC instants; calculate club dates, hours, and reports in
  `Asia/Manila`. Never interpret the browser's timezone as the club timezone.
- Store money as integer centavos. Calculate prices and deadlines on the server.
- Business policies and court configuration belong in versioned database records,
  including immediate and scheduled changes. Do not scatter policy constants in UI code.
- Store agreed prices and terms with bookings. Later configuration changes must not
  silently reprice or rewrite existing agreements.
- Payment evidence and customer records are private. An uploaded screenshot is a claim,
  never proof of receipt. Only verified transactions contribute to collected revenue.
- Guest booking requires no customer account. Protect guest access with scoped,
  expiring, high-entropy tokens; persist only token hashes.
- Enforce staff/owner authorization on every server operation and with database policies.
  Hiding controls in the UI is not authorization. Privileged Supabase clients bypass RLS;
  every such use requires explicit authorization and narrow, validated inputs.
- Record privileged changes, payment decisions, refunds, and configuration changes in
  an append-only audit trail without embedding secrets or screenshot contents.

## Delivery discipline after plan approval

Follow `docs/ROADMAP.md`; keep unresolved decisions visible in `docs/DECISIONS-AND-RISKS.md`.
Do not treat suggested defaults as owner-approved policy. Ask only for decisions that
block the current milestone; make independent progress on approved work.

Use reviewed SQL migrations for schema, constraints, policies, grants, and seed data.
Never put real credentials, customer details, or payment evidence in seeds or tests.
Use mocked integrations and synthetic records for owner demonstrations unless explicitly
authorized otherwise. Do not send customer messages or submit real payments in tests.

Run meaningful checks appropriate to each change. The intended verification stack is
Vitest, real local PostgreSQL/Supabase integration checks, and Playwright. A mocked
conflict check does not demonstrate database concurrency safety. Until tooling exists,
report checks as planned, not passed. Record relevant results and limitations.

Target WCAG 2.2 AA, keyboard operation, visible focus, accessible form errors, and a
mobile-first interface. Availability cannot depend on court-map color alone.
Use navy, athletic blue, champagne gold, and warm ivory with verified contrast.
Use documented, licensed photography and maintain source/license attribution metadata.

Keep documentation aligned with implemented behavior. Preserve unrelated user changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
