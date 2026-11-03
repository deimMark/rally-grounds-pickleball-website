# Decisions, assumptions and security risks

Status: Phase 2 foundations and Phase 3A corrections are implemented locally;
[PHASE-3A.md](PHASE-3A.md) records resolved defects and remaining boundaries.
[PHASE-2.md](PHASE-2.md) records the original engineering defaults. Commercial decisions remain unresolved unless explicitly supplied by the user. Recommendations below are
proposals for review, not confirmed business policy. Resolve decisions by the milestone
that needs them; they need not all block the local technical foundation.

## Business and product decisions

| Decision | Proposed handling / question | Gate |
| --- | --- | --- |
| Opening hours | Seed provisional 08:00–23:00 Manila; confirm daily variation, holidays, closures and last finishing time. | Phase 3/live booking |
| Duration and advance horizon | One-hour minimum and full-hour starts are given; propose whole-hour duration increments. Confirm maximum duration, maximum advance days and simultaneous holds per guest. | Phase 3 |
| Public cutoff | Propose reject starts at or within 60 minutes; confirm whether exactly 60 minutes should be allowed. Staff exception applies only to future slots and never overrides overlaps. | Phase 3 |
| Payment deadline | Propose earlier of creation + two hours and start − 60 minutes. Confirm a minimum payment opportunity or an earlier public cutoff to avoid near-zero windows. | Phases 3–4 |
| Staff last-minute bookings | Confirm immediate verified GCash, unpaid staff hold, complimentary use or other tender policy. Do not apply the guest deadline formula to create already-expired staff holds. Proposed staff route requires an explicit payment mode and audit reason. | Phase 4 |
| Pending verification | Propose keeping the court reserved after timely evidence submission, with overdue alerts. Confirm staff review SLA, shift coverage and escalation/auto-release behavior. | Phase 4 |
| Rejected evidence | Confirm resubmission deadlines and whether/when staff release the slot. Prevent indefinite unresolved rejected bookings. | Phase 4 |
| GCash receipt verification | Confirm recipient, independent receipt source, valid reference format, duplicate scope, payer-name mismatch, partial/overpayments and mistaken transfers. No automated API assumed. | Phase 4 |
| Refunds | Within 24 hours, voluntary refunds are disallowed. Confirm exactly 24 hours, earlier cancellation rate, fees, weather/club cancellation exceptions and payout timing. Partial rate stays unset until decided. | Phase 5 |
| Rescheduling | Staff approval and availability are given. Confirm request lead time, number of changes, charges, and whether original or current pricing/terms apply. Proposed changes require explicit agreement to a new revision. | Phase 5 |
| Capacity/player count | Collect estimated players, not membership. Confirm minimum/maximum players, equipment, guest limits and whether counts affect price. Do not invent capacity limits. | Phase 3 |
| Contact and recovery | Confirm phone/email requirements and whether notifications are expected. Baseline uses private status link; recovery is staff-assisted with an identity check. No SMS/email provider assumed. | Phase 3 |
| Owner/staff permissions | Proposed staff verify payments and manage schedule; owner alone publishes rules, manages roles, sees financial exports and approves refunds. Confirm operational practicality and separation of duties. | Phases 2 and 5 |
| Operational settings | Proposed service-time rates/hours and creation-time contractual terms; confirm how future changes affect already-booked hours and acceptable conflict-resolution process. | Phase 2 |
| Open play/Reclub | Confirm official HTTPS hosts, participation rules, recurring needs and whether open-play income needs recording. MVP links out and blocks courts; no external registration/payment sync. | Phase 5 |
| Reporting | Approve service-date booking value versus receipt-date cash and the utilization denominator; decide no-show reporting. No attendance metric without attendance data. | Phase 6 |
| Branding/content | Exact colors were supplied in Phase 1. Obtain the official logo, address/map details, contact info and actual photos; use attributed licensed placeholders until approved. | Phases 1 and 6 |
| Tax and legal documents | Confirm tax-inclusive pricing, receipt/invoice obligations and Philippine consumer/privacy terms with the club's adviser. The MVP does not claim tax-invoice compliance. | Live launch |
| Retention | Owner sets customer, payment-evidence, audit and financial retention periods and deletion exceptions. Do not retain screenshots indefinitely by default. | Phase 4/live launch |
| Infrastructure | Confirm budget, hosting, data region, backup plan, scheduler and email/Auth invitation requirements. No external project creation before approval. | Before provisioning |

## Threats and controls to verify

| Risk | Planned control | Required evidence |
| --- | --- | --- |
| Double booking from concurrency or separate block tables | Unified occupancy table, exclusion constraint, atomic mutations, stable locking order. | Real concurrent SQL/integration tests covering private, open play, closure and reschedule. |
| Stale hold, late submission or delayed reviewer | Database-time deadlines, serialized transitions, authenticated idempotent expiry jobs, pending-review escalation. | Clock-boundary/race tests plus scheduler health/failure drill. |
| Payment screenshot fraud or duplicate settlement | Independent GCash verification, immutable receipt ledger, duplicate reference detection, auditable corrections. | Staff review scenario and duplicate/concurrent verification tests. Screenshot authenticity alone is insufficient. |
| Customer/evidence disclosure through RLS gaps | Deny-by-default policies/grants, scoped functions, private bucket, short-lived access and no shared caching. | Adversarial anonymous/guest/staff/owner access matrix including direct REST/Storage calls. |
| Overprivileged service credentials | Server-only modules, narrow operations, actor authorization before privileged calls, no secret output. | Bundle/secret review and direct attempts to invoke privileged operations. |
| Staff escalation or stolen session | Owner-controlled roles, database role checks, deactivation, owner MFA, secure cookies and CSRF controls. | Role mutation, revoked-session and cross-origin request tests. |
| Guest capability leakage or booking enumeration | Random scoped tokens, hash storage, clean-URL cookie exchange, no-referrer, revocation, rate limits, redacted logs. | Token misuse/guessing tests and inspection of responses, headers, caches and logs. |
| Bot holds and storage abuse | Rate limits per route/IP/capability, booking horizon/hold caps after approval, upload quotas and orphan cleanup. | Abuse tests with safe synthetic load; deliberate retry limits do not create duplicate bookings. |
| Malicious evidence/content/links | Decode/re-encode allowed images, bound resources, strip metadata, disallow active formats; validate HTTPS destinations; structured text. | Invalid MIME/content, oversized and malformed-image, XSS and URL-host tests. |
| Configuration corrupts old agreements | Append-only versions, snapshots, accepted booking revisions and affected-booking publication checks. | Immediate/scheduled change tests and immutable-history assertions. |
| Misleading revenue and refunds | Separate claims from verified ledger, completed payouts from approvals, labeled service/receipt dates. | Known-value fixtures including corrections, overpayment resolution and partial refunds. |
| Unauthorized exports and insider misuse | Owner-only sensitive export, minimal fields, audit trail, export rate limits and spreadsheet escaping. | Permission tests and export inspection if implemented. |
| Destructive migrations or failed recovery | Reviewed migrations, isolated development/demo databases, backups, restore exercise and manual operations runbook. | Restore into a separate approved environment before live launch; no destructive production tests. |
| Privacy/retention failures | Minimum collection, approved notice/legal basis, retention jobs, access/deletion process and redacted observability. | Retention/access-request drill; financial/legal exceptions documented. |
| Unlicensed media or inaccessible UI | Asset provenance/license records, contrast verification, accessible list alternative and manual keyboard review. | License inventory, accessibility scan and documented manual checks. |
| Supply-chain or environment drift | Pinned versions/lockfile, verified package sources, limited runtime secrets and repeatable setup. | Locked clean install/build, dependency review and no disabled TLS/signature checks. |

## Deliberate limitations for presentation

- Synthetic demo payment evidence is never real settlement and must be labeled.
- No application integration with Google Calendar, Reclub enrollment or a GCash API.
- Manual review needs people and a documented escalation policy; software cannot ensure
  somebody checks the receiving wallet on time.
- The app cannot know actual attendance or off-system payments without staff recording.
- A successful local/demo test does not establish production backup, network, scaling,
  email delivery or live compliance readiness.

## Review requested

First review the single-club architecture, milestone order and proposed default rules.
The user has subsequently authorized Phase 2 local implementation. That authorization
does not include external provisioning, code pushes, deployment or a merge. Keep later owner decisions visible
until the corresponding gates are satisfied.

## Phase 3A review checkpoint

R1 selected-duration consistency, R2 authoritative replay status and R3 block release
are resolved with additive migrations and regression tests; see [QA](qa/phase-3a/REVIEW.md).
The agreed 90/60 interpretation is the existing increment-multiple rule: first legal
session is 120 minutes. Historical agreements and immutable receipts remain unchanged.

R4 autonomous expiry remains unimplemented. Deadline-aware status and write-time cleanup
protect eligibility but do not establish scheduler health or physically reconcile idle
rows. Guest capability authorization, public contact collection, durable shared admission
limits and the privileged guest gateway remain proposals in
[Phase 3B contracts](PHASE-3B-CONTRACTS.md). No guest privacy/booking launch claim follows
from the staff-only tests. Owner policy/retention/abuse-budget approvals remain open.

## Phase 3B.1 local security checkpoint

[Phase 3B.1](PHASE-3B1.md) adds local-only guest intent admission, hash-only per-intent
capabilities, scoped internal authorization, owner revocation and persistent admission
budgets. [QA](qa/phase-3b1/REVIEW.md) records actual tests. Commercial/owner defaults
remain unresolved; synthetic TTLs/limits are not club policy. Guest quotes, reservation
creation, contact/status flow, autonomous expiry/cleanup and trusted public attribution
remain unimplemented. Privileged service-key isolation, live rate-limit key rotation,
retention and missing policy decisions must be reviewed before Phase 3B.2/live admission.
