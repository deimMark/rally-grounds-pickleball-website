# Phase 1 initial Git checkpoint

The user provisionally approved Phase 1 QA and authorized the initial local commit on
existing branch `work`. Phase 2, publication, deployment and merging are not authorized.

## Contents and boundaries

This checkpoint preserves the Phase 1 application, pinned dependency lockfile, blank
configuration example, tests/CI definition, architecture/planning documents, licensed
stock asset/provenance and the five intentional owner-review screenshots. The screenshots
are review artifacts that should be versioned; generated runner traces/reports remain
ignored. See PHASE-1-FILES.txt for the full intended commit path list.

The QA report in `docs/qa/phase-1/REVIEW.md` is a historical precommit report. Its
unborn/untracked Git observations were correct when captured; this checkpoint supersedes
those observations after the initial commit. Application behavior and test evidence are
unchanged by this finalization: the preceding QA run passed lint, build, 16 unit tests
and 13 browser tests. This finalization changes documentation/ignore rules only.

## Security review before staging

- Review every untracked file, including the dependency lockfile, workflow, fixtures,
  configuration examples, screenshots and image metadata. Scan text without printing
  potential secret values; inspect binary assets as images, not as source files.
- Verify `.env`, `.env.local`, dependencies, builds, test artifacts and representative
  credential/key/cache paths are ignored; ensure `.env.example` remains trackable and
  has no configured values. Ignore rules cannot detect a secret embedded in source:
  source/staged review remains necessary.
- Inspect lockfile download hosts and URLs for embedded credentials; inspect source for
  common credential formats. Confirm secret values never enter client modules.
- Use the existing Git identity and origin. No token, remote rewrite, force push or
  change to `main` is required.
- Review the exact staged path list against PHASE-1-FILES.txt and inspect staged contents
  before committing. Verify a clean working tree after the commit; report the full SHA
  from `git rev-parse HEAD` instead of trying to embed a commit's own SHA in its contents.

## Publication preparation

The configured fetch/push origin is GitHub repository
`deimMark/rally-grounds-pickleball-website`. The local publication branch is `work`.
After explicit push approval, from this checkout use:

```sh
git push --set-upstream origin work
```

This is a normal push of the local branch, not a merge into `main`. Before a future
publication, read remote refs and handle any independently created `work` branch without
force pushing; do not replace remote history. Publication permission/access is not
established merely by inspecting origin configuration. No upstream is created until
an authorized successful push (or a separately authorized tracking change).

## Next review gates

- [Phase 1.1 visual corrections](PHASE-1.1.md): official logo, gold icon consistency,
  warm surfaces and helper-text readability; documented, not implemented.
- [Exact Phase 2 execution proposal](PHASE-2-PLAN.md): local migrations, versioned
  settings, availability service, court conflict invariants, staff Auth and security tests.

No new product feature, database migration, production resource or payment operation is
part of this checkpoint.
