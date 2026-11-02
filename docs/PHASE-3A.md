# Phase 3A — foundation corrections

Implemented locally on `phase-3a-foundation`, from reviewed baseline
`1e173f31db6c35c143f5637e365918b721c8f825`. Before editing, the checkout was clean,
HEAD matched the expected Phase 2 branch, and the approved Phase 1 checkpoint
`753901cd3363a102d34c0cc77fbdcdfa2bde9a2b` was verified as an ancestor.
No push, merge, deployment or production resource change occurred.

## Scope reconciliation

The original Phase 3 plan proposes a full guest workflow. The current authorization is
its foundation subset only: R1 duration consistency, R2 receipt/state separation and R3
block release from the historical [publication review](qa/phase-2/PUBLICATION-REVIEW.md).
R4 autonomous expiry, public admission, guest privacy capabilities and abuse prevention
remain future work. Phase 2's flat create result changes to an explicit envelope below;
there is no live guest consumer to migrate. The public demo and staff dashboard figures
stay synthetic. Historical Phase 2 evidence is retained rather than rewritten.

## Additive migrations and service contracts

| Migration suffix | Behavior |
| --- | --- |
| `20261102000100_duration_consistency.sql` | Shared duration validation, insert-time policy validation, optional selected-duration availability. |
| `20261102000200_authoritative_reservation_status.sql` | Immutable creation receipt plus database-derived current state; authorized status RPC. |
| `20261102000300_release_court_blocks.sql` | Atomic, authorized, idempotent release of explicit block occupancy IDs. |

### Duration

`getAvailability(day, durationMinutes)` / `availability(p_day, p_duration_minutes)`
accept an optional selected duration. An omitted selection resolves to the smallest
legal multiple of the configured increment at or above the configured minimum.
Thus minimum 90 / increment 60 resolves to 120 minutes, preserving the prior quote
interpretation of increments from zero. Selecting 90 is invalid; selecting 120 yields
valid two-hour slots, quotes and creation. The ordinary 60/60 configuration is unchanged.

The single-day 1,440-minute technical ceiling is separate from nullable, configurable
commercial maximum duration. Unsupported combinations with no legal duration fail
clearly (`22023`) before new policy publication. Existing policies/agreements are not
rewritten; a historical unsupported effective policy also fails at evaluation. Opening
hours may legitimately leave no fitting intervals for an otherwise legal duration.
Server input validation rejects non-integer or out-of-bound selections before connecting.
Internal availability error mapping exposes `INVALID_DURATION_OR_POLICY`; the future
public gateway must distinguish user input from invalid operational configuration.

### Receipt and current status

`createReservation(...)` / `create_reservation(...)` now return:

```text
{ receipt: <unchanged original creation result>, current: { id, status, expires_at, observed_at }, replayed: boolean }
```

`getReservationStatus(bookingId)` / `reservation_status(p_booking_id)` return only the
current object and require active staff/owner authorization. Current state comes from
the booking row plus the database clock: a held booking beyond its deadline reads as
expired even before write-time reconciliation. Reads do not mutate receipts, audit
history or occupancy. This is deadline-aware observation, not autonomous cleanup.

Actor-bound replay compares the original payload, returns the immutable stored receipt
and freshly observed current state, and never renews the deadline or reacquires occupancy.
Expired/cancelled bookings stay expired/cancelled. Old Phase 2 stored receipts work with
the new envelope; the upgrade regression installs the actual prior function inside a
rollback-only local transaction and proves both receipt and agreement preservation.
Consumers must display `current.status`, never treat `receipt.status` as current.

### Block release

`releaseCourtBlocks({occupancyIds, requestKey})` / `release_blocks(uuid[], uuid)` takes
explicit occupancy IDs returned by `block_courts`. Pass all IDs for a multi-court event,
or a deliberate subset. It accepts open-play/maintenance only; reservation IDs fail.
Validate every ID before any transition, lock courts/occupancies in stable order, mark
active blocks inactive, and append one audit per actual release. Mixed invalid requests
roll back entirely. Historical rows remain. No broad UPDATE/DELETE grants were added.

Result: `{released_ids, already_released_ids}`. Same actor/key and canonical ID set replay
that immutable operation receipt; changed inputs/operation reject. Concurrent distinct
keys or overlapping multi-court sets safely report already-released rows without duplicate
transition audits. An old block ID cannot release a newer reservation occupying its slot.
Technical request bound is 100 IDs; the club's court count remains database configuration.

## Validation and next gate

See [Phase 3A QA](qa/phase-3a/REVIEW.md) for exact commands/results and security limits.
Local implementation commits: `c5bf7aa` (duration), `d0d5496` (status/block release).
The final documentation commit is reported in Git history and the review response.

[Phase 3B contracts](PHASE-3B-CONTRACTS.md) specify private per-intent credentials,
cookies, guest admission/quote/create/status DTOs, contact minimization, idempotency and
shared rate limiting. They are proposals only. Remaining gates include owner-approved
policy boundaries and retention/abuse budgets, privileged gateway review, autonomous
expiry with failure monitoring, guest privacy/CSRF tests and a real account-free browser
flow. Payment collection and verified confirmation remain out of scope.
