# Dependency patch evidence

This is a dependency-only patch, not closure of #4200 or the broader planning
feature. Scenario repairs remain on Draft PR #5994. No template, production source,
test, generated surface, or audit-ignore change is included.

## Checks

- CI audit command: before exit 1; after exit 0. See raw audit logs. This is the
  discriminating failure and repair for the dependency update.
- Unfiltered `scripts/dev bun audit`: exit 1, seven inherited findings (two high,
  two moderate, three low). Both high advisory IDs are the existing CI ignores;
  this patch adds no ignore. See `audit-unfiltered.log`.
- Frozen install: exit 0. Incremental installation was insufficient to repair the
  installed isolated dependency tree. A forced frozen reinstall completed and
  confirmed markdownlint-cli2 resolves markdown-it 14.3.3. Maintainers should run
  `scripts/dev bun install --frozen-lockfile --ignore-scripts --force` if an
  incremental install retains the old resolved consumer copy.
- Actual consumer checks after reinstall: valid Markdown stdin exit 0; empty-link
  stdin exit 1 with MD042; real Markdown render matches heading and bold paragraph.
- `scripts/dev bun run lint`: exit 0 (ESLint, Gherkin lint and CLI typecheck).
- `scripts/dev bun run build`: exit 0 (relay, collector, CLI and declarations).
- `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts`: exit 0,
  all five current. No derived regeneration warranted for this dependency delta.
- Formatting check of manifest and review context: exit 0. `git diff --check`: exit 0.
- Fresh full `scripts/dev bun run test`: exit 0. CLI: 706 files passed,
  11502 tests passed and 14 skipped; relay and collector also passed (raw totals
  retained in `full-tests.log.gz`). Skips are not acceptance or qualification proof.
- Gherkin acceptance: not executed for this dependency-only patch. Existing broad
  feature qualification failures and deferrals are untouched. No acceptance pass
  or native qualification is claimed.

## Diff audit

Packaged audit executable blocks ran verbatim via the pinned launcher. Merge base:
`150eb7c619b2d5852174da99ba675ae326354153`. Config drift check healthy; architecture
reported zero modules and dependencies, which is non-discriminating for this patch.
No changed tests, product Rules, personas, surfaces, principles, or learning files.
Whole-workspace Knip, clone totals and upgrade discovery skipped per diff scope.
Manual review of the manifest and complete lock delta found no unrelated changes.
Audit passed within that boundary; it does not clear unfiltered dependency debt.

## Independent review

Claude/opus, independent cross-agent review
`e9797a52-540f-4ddd-be90-1a7406053ee2`: approved with no errors. Signed receipt
checked by the coordinator; `independent-review.json` preserves its result.
The service rejected the full lockfile due to its 262144-byte limit; it reviewed
the complete lockfile diff and recorded whole-file hash instead. The warning about
stale local installed copies is addressed by the reinstall guidance above. The
review's request for terminal CI results remains pending until CI completes.

## Preserved failures

- Initial baseline CI-policy audit exit 1 (one high markdown-it advisory).
- Incremental frozen install reported success but left the installed consumer on
  14.3.0; subsequent resolution probes exposed this contrary observation.
- Initial root lint failed MODULE_NOT_FOUND while dependency reinstall overlapped
  checks. The first full test run was interrupted (exit 130). Fresh checks began
  after reinstall completed; those earlier outputs do not establish regressions.
- Initial Markdown file probes reported zero files and are excluded as proof.
- Review service rejected the oversized complete lockfile; bounded delta review
  is explicitly narrower than review of unchanged lockfile entries.
- Profile setup retry exit 1: plugin 1.2.0 reported, installer required 1.1.0,
  project hooks left unchanged. No profile-repair claim.

## Delivery limits

No new feature or live workflow, so no persona walkthrough applies; nearest real
boundary is the installed markdownlint consumer and unchanged CI audit policy.
No paid qualification, Ready promotion, merge, or release. Keep the patch Draft
until current-head CI is terminal and green, and keep #5994 Draft independently.
