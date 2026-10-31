# Rally Grounds MVP plan

Status: Phase 1 is implemented and verified under the revised mock-only scope. See [Phase 1 scope and
verification](PHASE-1.md) for the implementation status and explicit roadmap adjustments.
The architecture below remains the direction for later live functionality.

## Workspace inspection

On 2026-10-31 the existing checkout at
`/workspace/rally-grounds-pickleball-website` had no commits, tracked files, untracked
project files, manifests, lockfiles, migrations, tests, CI, or existing agent instructions.
The current symbolic branch was `work`. The prior onboarding attempt also found the
GitHub repository empty; this planning task did not fetch, push, or alter remotes.
This is a greenfield design with no application constraints inferred from existing code.

## Review documents

- [Architecture](ARCHITECTURE.md): application boundaries, data model, policy resolution,
  booking integrity, payment handling, deployment shape, and verification strategy.
- [Milestones](ROADMAP.md): sequence, deliverables, and measurable acceptance gates.
- [Decisions and risks](DECISIONS-AND-RISKS.md): proposed defaults, required owner input,
  privacy/security risks, and controls to validate.
- [Engineering instructions](../AGENTS.md): instructions for future repository work.

## MVP scope

The MVP covers a public club site; account-free guest booking; availability for five
courts; staff and owner operations; GCash evidence upload and manual verification;
staff open-play blocks with Reclub links; customer search and booking history;
verified payment, refund, and utilization reports; and editable branding/business rules.

The club layout is Courts **3, 4, 5** on the upper row, and Courts **2, 1** below on
the right. The map complements an accessible court/time list. The layout describes
presentation, not a source of booking permissions.

Excluded from this MVP: customer accounts, automated GCash settlement, automatic Reclub
sync, Google Calendar integration, recurring reservation engines, memberships,
tournaments, multi-club tenancy, and a SaaS billing/platform layer. External notifications
need an approved channel/provider; the booking reference and private status page are the
baseline guest communication flow.

## Proposed review outcome

Approve or revise the architecture and Phase 1 scope before implementation begins.
Owner decisions can be resolved by their milestone gates rather than blocking all work.
Production credentials, external project creation, pushing, and deployment require
separate authorization. This documentation task creates no external resources.

## Phase 1 finalization checkpoint

Phase 1 QA is provisionally approved. The authorized initial local Git checkpoint is
specified in [PHASE-1-CHECKPOINT.md](PHASE-1-CHECKPOINT.md). See
[PHASE-1.1.md](PHASE-1.1.md) for pending visual corrections and
[PHASE-2-PLAN.md](PHASE-2-PLAN.md) for the exact proposed next milestone. These documents
do not authorize a push, deployment, merge or Phase 2 implementation.
