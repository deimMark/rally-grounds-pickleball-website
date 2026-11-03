# Rally Grounds engineering instructions

## Project and current authorization

Build a single-club pickleball booking and management application for Rally Grounds,
San Juan, La Union, Philippines. Phase 3B.2.1 corrections are authorized on
phase-3b2-1-security-fixes from reviewed checkpoint 22fb656f7c7c1dbcc35f23063aea2822c1aeecc7.
Correct the browser private GET trust boundary and strict UUID JSON types; follow
PHASE-3B2-1.md and preserve existing transactions, policy history, RLS, staff Auth,
capability binding and idempotency. Synthetic local testing only. No push, merge,
deployment, production connection, public booking, payments or Phase 3B.3 expiry work.
Disable Vercel Git deployment for this branch. Record actual test results and commit
locally for review. Never commit credentials or real customer data.

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
