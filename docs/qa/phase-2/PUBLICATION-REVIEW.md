# Phase 2 publication and review gate

Reviewed **2 November 2026, Asia/Manila**. The user authorized publication of `work`
and `phase-2-foundation`, review, and a Phase 3 plan. No product implementation,
merge, deployment or production Supabase resource is part of this checkpoint.

## Verified Git history and publication

| Branch/revision | Verified full SHA |
| --- | --- |
| `work`, approved Phase 1 baseline | `753901cd3363a102d34c0cc77fbdcdfa2bde9a2b` |
| Phase 2 implementation commit 1 | `756be0b226a88d2f8b85fcd50032f51af9f46c4f` |
| Phase 2 implementation commit 2 | `72633d2b5ddb16f48d20a108d588b39f0609289b` |
| Phase 2 implementation commit 3 | `356db71940a3e42d1e748767c4cd10c66f438dd4` |
| Phase 2 implementation commit 4 / reviewed implementation HEAD | `6ef2aed7a473eabbf0b630f4a1674ed9d6578439` |

`git merge-base --is-ancestor` verified the approved baseline on `work`; the Phase 2
branch descends from it and contained exactly the four implementation commits above.
Initial working tree was clean. Fetch and push `origin` both target the requested
GitHub repository, without credential-bearing remote output.

Executed, without force or merge:

```sh
git push --atomic --set-upstream origin work phase-2-foundation
git ls-remote --heads origin refs/heads/work refs/heads/phase-2-foundation
```

Both remote refs initially matched the baseline and reviewed implementation HEAD.
This documentation-only checkpoint is subsequently committed/pushed on
`phase-2-foundation`; it adds no runtime changes. Its tip is obtained from Git rather
than embedding its own hash in its contents. The four approved implementation commits
remain unchanged ancestors; `work` remains at the Phase 1 baseline.

Published branch URLs:

- https://github.com/deimMark/rally-grounds-pickleball-website/tree/work
- https://github.com/deimMark/rally-grounds-pickleball-website/tree/phase-2-foundation

Only the existing test workflow is defined; no deployment workflow was added. GitHub
CI outcome has not been independently verified and is not represented as passing.
No `main` branch was merged or intentionally modified.

## Security review

- All five original reachable commits were inspected: 102 distinct text blobs, with no
  matches for the targeted credential patterns and no credential-bearing dependency URLs.
- Current source scan passed; 84 files were tracked before this documentation checkpoint.
- Only `.env.example` is tracked. Its connection values are blank; APP_ORIGIN is a
  nonsecret loopback example. Actual local connection/test credentials remain ignored.
- Dependencies, build output, auth caches, runner traces/reports and common private-key
  files are excluded. The five intentionally versioned Phase 1 screenshots contain
  synthetic demonstration data and the photo asset has recorded licensing/provenance.
- This is scoped credential inspection, not a guarantee against every possible secret
  format. It found no credentials requiring removal or history rewriting.

## Review evidence

The current **32 real database integration tests** and **35 unit tests** passed again,
with no failures/skips. The integration suite uses actual local Auth JWTs/PostgREST,
including the 20-contender test: one reservation succeeds, 19 receive exclusion conflicts.
The existing 21 browser tests/build/lint passed at the implementation checkpoint; they
were not rerun for this documentation-only gate. Keep those evidence dates distinct.

Before rerunning the integration suite, the designated local database had zero bookings,
customers or occupancies. No real customer/payment data or production resources were used.
Additional diagnostics used local PostgreSQL transactions with a synthetic owner context;
every mutation was rolled back and persistent counts were verified unchanged. Those
probes exercise database behavior, not an additional end-to-end Auth claim.

[Sanitized diagnostic evidence](publication-probes.json) records the outcomes without
credentials, customer details or booking references.

| Requested edge case | Finding |
| --- | --- |
| Adjacent reservations | Pass: `[08:00,09:00)` and `[09:00,10:00)` on one court coexist. |
| Different courts | Pass: identical intervals on Courts 1 and 2 coexist; the exclusion key includes court identity. |
| Overlapping intervals | Pass: partial overlap `[08:00,10:00)` versus `[09:00,11:00)` fails with `23P01`; no partial second booking remains. |
| Unauthorized access | Existing real-JWT tests pass for anonymous/no-role/inactive access denial, staff role/publication restrictions, forged metadata and live revocation. |
| Versioned pricing/terms | Existing tests pass for effective boundaries, unchanged historical agreements, segment pricing and rejection of stale terms at an unchanged price. Configuration compatibility defect R1 remains below. |
| Closures/open play | Existing tests pass for shared conflict protection, atomic multi-court rollback, disable boundaries and later restoration windows. Operational release gap R3 remains below. |
| Audit integrity | Existing tests pass for atomic successful writes, owner-only reads and append-only application access; failed operations leave no partial audit/domain rows. Administrative tamper-proof storage/failed-access telemetry is not claimed. |

## Defects and limitations to resolve before guest launch

### R1 — Configurable availability can disagree with valid reservations

Reproduced on the approved implementation: publish `minimum_minutes=90` while leaving
`duration_increment_minutes=60`. Publication succeeds. A two-hour court quote is valid
at PHP 1,200, but `availability(day)` returns **zero rows** for all courts because it
only tests intervals exactly equal to the configured minimum (90 minutes), which fail
the duration-increment check.

Default 60/60 fixtures are unaffected, explaining why all existing tests pass. Resolve
before connecting real guest availability: define/validate compatible policy combinations
or generate the smallest legal duration, and support the guest's selected duration in
the availability contract. Add regression tests for compatible and incompatible settings,
including limits above the supported single-day technical bound. Do not silently invent
new commercial increments or treat an empty result as a genuinely fully booked day.

### R2 — Idempotency receipts are historical, not current booking status

Reproduced: create a hold, release it, then replay the same request/key. The stored
receipt still says `held`, while the database booking is `cancelled` and zero occupancy
is active. The operation is idempotent and does **not** resurrect the slot, but a guest
UI must not present that original receipt as current status. Add a protected authoritative
status read and an explicit receipt/current-state response contract. Handle lost responses,
retries after expiry and browser reload without extending the original deadline.

The current actor scope is an authenticated Auth user. Guests have no Auth account;
reusing one shared service actor or a bare anonymous key would cause authorization and
idempotency-scope risks. Establish private per-intent/session scope first.

### R3 — No supported staff release of non-reservation blocks

`block_courts` creates open-play/maintenance occupancy, but the only exposed release
operation is `release_reservation(booking_id)`. Those blocks have no booking ID and
normal app roles cannot update occupancy directly. A future erroneous block cannot be
cancelled through supported application operations.

Before relying on the calendar operationally, add a narrow authorized/idempotent release
operation with stable locks, multi-court atomicity and audit. Do not solve it by granting
broad UPDATE/DELETE access. Full open-play/event editing UI can remain Phase 5.

### R4 — Expiration has no autonomous sweep

Availability ignores expired holds; reservation/block writes reconcile holds on the
court they touch. Without those writes, stored `held` status and `active` flags can
remain stale indefinitely. There is no worker/scheduler readiness check, retry monitor
or job actor/audit model. Phase 3 must add bounded expiration sweeps, authoritative
reads, lock/race tests and scheduler health reporting. The database remains the clock.

### R5 — Guest authorization and privacy are not implemented

There is no guest creation/status endpoint, capability-token table/exchange, customer
association workflow, abuse budget or safe recovery mechanism. Booking references are
identifiers, not credentials. The public site and dashboard figures remain mock data.
The existing staff quote also includes internal policy metadata, so a public quote must
use an explicit safe DTO rather than exposing that payload unchanged.

### R6 — Other known boundaries

- Public lead-time equality, payment cutoff and minimum payment opportunity, advance
  horizon, maximum duration/active holds, contact requirements and retention remain
  unresolved. Relevant database values are null/provisional; live guest admission must
  fail closed when required terms are undecided.
- Only unpaid holds/cancelled/expired states exist. No payment evidence, verification,
  confirmed/paid state, refund ledger, rescheduling flow or production revenue reporting.
- Uniform daily court hours, single-day reservations, no overnight/weekly recurrence,
  no runtime timezone change. Phase 3 must expose those actual limits clearly.
- Staff CRM/assignment, owner settings UI, production staff invitations/MFA/recovery,
  backup/restore, failed-access observability and production deployment remain later gates.
- Current status/availability is advisory and does not itself reserve a court. No guest
  launch approval or production readiness follows from branch publication.

## Review decision

The approved development baseline is published and its covered integrity/security tests
remain green. Guest launch is **blocked** by R1 and the guest/expiry foundations above.
No fixes or Phase 3 product features were implemented during this review. The proposed
[Phase 3 plan](../../PHASE-3-PLAN.md) begins with those gates and requires explicit approval.
