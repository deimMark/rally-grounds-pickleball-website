# Rally Grounds engineering instructions

## Project and current authorization

Build a single-club pickleball booking and management application for Rally Grounds,
San Juan, La Union, Philippines. Current authorization: Phase 3D.2 booking UX and
accessibility refinement on branch `phase-3d2-booking-ux`, created from the completed
Phase 3D.1 commit 0172b32d24f3a4f1fddb5e3e66ffe7620eb93265 (branch
`phase-3d1-booking-interface`, itself one commit on approved owner-demo
6146af81c6cdf6a501260b39dbc9ebfe6d0a64af). See docs/PHASE-3D2.md for scope.

Authorized now: the approved Phase 3D.2 UX/accessibility improvements, their tests and
documentation, and one conditional local commit after lint, the complete Vitest and
Playwright suites, production build, credential and client-bundle scans pass on pinned
Node 24. Then stop for review. Not authorized: push or publication of any branch, pull
request, merge, deployment, Vercel project-setting changes, changes to owner-demo or
phase-3d1-booking-interface, production Supabase, live reservations, real contact
collection, GCash/payment processing, evidence uploads, guest capability cookies/tokens,
backend migrations or Phase 3B.3 expiry-worker integration. GitHub publication requires
separate explicit approval; never push a branch that vercel.json does not exclude.

Preserve the approved design, the shared CourtMap geometry (Courts 3/4/5 portrait above,
2/1 landscape below, 5/2/1 right edges aligned), responsive homepage and read-only staff
demo. Keep every demonstration price, operating hour, duration, player option and example
policy in lib/demo; do not invent owner-approved business rules. Synthetic profiles and
availability only; no API mutation, payment or authenticated booking claims. Do not make
unavailable time slots keyboard tab stops; keep their status/reason accessible and prevent
activation. Do not weaken existing tests or hide failures with retries. Follow
docs/PHASE-3D1.md for the interface contracts (references only). Do not merge or depend on
unpublished backend/worker code; Phase 3B security finding H2 remains an unresolved,
separate backend blocker. No credentials, customer data or private evidence in Git.

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
