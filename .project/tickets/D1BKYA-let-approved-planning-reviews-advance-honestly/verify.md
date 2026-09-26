# D1BKYA verification — in progress

## Implemented behavior

One authenticated current phase receipt admits Implementation Planning approval.
The redundant artifact self-stamp is removed. A current rejected review reports
only `REVIEWER_FINDING` messages; approved warnings and coordinator assurance
sentences are never rejection findings. Existing provenance and exact plan-byte
checks remain in `phaseReviewAdmission`.

## Evidence collected

- Focused current-source suite: 5 files, 123 tests passed (planning/design approval,
  planning guidance, degraded explanation, review surface parity, Bun pin contract).
- Both RED loops earned current independent executable RED approval before GREEN.
  Scenario 1: `20bf6afd-3cf3-4685-96d2-e5e8c8b05431`; scenario 2:
  `9048b493-0dd9-4224-82c9-f738419e189f`.
- Independent final Claude review `8ef57710-b37d-4576-882b-730003b2085f`:
  approved, cross-agent, no error findings. Source packet remains current.
- Changed TypeScript ESLint, formatting, Markdown lint, generated four-surface
  checks, and commit hooks passed. Full verification is still pending.
- User-requested repository toolchain repair is separate: `scripts/dev` resolves
  Bun and Node with mise and prepends their executable directories for children.
  The commit hook uses that same PATH. A smoke run under Homebrew-first PATH
  proved Bun 1.3.14, Node 24.18.1, preserved arguments/cwd/exit status, and explicit
  missing-mise recovery. The earlier personal `.zprofile` edit was reverted.

## Final-review warning dispositions

- Concurrent execution-plan scaffolding, receipt ordering after scaffold failures,
  plan changes during a human prompt, and mid-flight phase returns: existing
  behavior outside this narrow duplicate-stamp/rendering repair. Retained as
  limitations; no fix is claimed.
- Degraded-route authority versus guidance: existing behavior owned by 5F5ZZA PR 4.
  This PR preserves current authenticated admission and does not add authority.
- Structural failure accompanied by a current rejection: only authenticated actual
  rejection findings are rendered. Structural validation still blocks admission;
  changing precedence between two valid failures is deferred, not silently fixed.
- Generated guidance copies were outside the reviewer packet: the real guidance
  contract tests and generated/parity checks verify those copies independently.
- POSIX PTY and tight existing timing assertions: evidence limitations retained.

## Epic and sibling acceptance remain incomplete

PR #4989's current-source Claude review was refreshed:
`a0a1fed2-bb5c-4a39-8f60-24b6740e37ce`, approved with no error findings.
Its existing assertion warnings are retained; the PR remains Draft and Node 24
acceptance CI remains failed. No merge or promotion occurred.

Full configured sibling acceptance: 2,372 scenarios — 1,778 passed, 3 skipped,
585 undefined, 6 failed. A pinned-toolchain rerun using six line selectors
actually selected 2,181 scenarios — 1,593 passed, 3 skipped, 585 undefined,
zero failed. It is not represented as a complete full-lane rerun. No undefined
steps, skip tags, or failure assertions were hidden or weakened.

## Outstanding

Pre-launcher full suite collected: 642 files — 640 passed, 2 failed; 10,562 tests
passed, 10 failed, 13 skipped. Seven failures explicitly report Bun 1.4.0 in
child generation commands, and three are intentional Cursor tree-byte changes.
Do not call that run green. Then run final
verification through the repository launcher, including the new launcher tests,
and collect the independent launcher review before any completion claim.

The pre-launcher full suite also exposed three Cursor lifecycle tree-fixture
mismatches. The canonical planning guidance intentionally changed installed
Cursor bytes; inspect and regenerate only those expected tree hashes with the
existing local update workflow, then rerun without update mode. No behavioral
assertion may be weakened.

## Toolchain review follow-up

Initial toolchain review `00cf209f-8887-4554-9f1f-e62c40b35942` approved.
The repository already has the requested Bun-pin synchronization assertion in
`dogfood-source-worktree.test.ts`; reuse that evidence instead of adding a duplicate.
The existing Bun-version contract test also proves the generator invokes the guard
before `Bun.build`. The hook PATH-output proof and missing-pinned-tool recovery
are now added and awaiting current-source test/review collection. Stable exact
Bun pins are intentional; support for prerelease or Corepack hash formats is
outside this repair. Other pinned languages and duplicate historical boundary
hooks are not changed.

The fixture update changed only the three Cursor tree hashes and their manifest
hashes. Lifecycle result hashes, Codex/Claude fixtures, and uninstall fixtures
were unchanged. The update-mode run passed all 13 checks; its required independent
verification without update mode is included in the next targeted run.

Current-source targeted verification through `scripts/dev`: 11 files, 229 tests
passed. This includes the three launcher tests, seven previously failing Bun
cases, lifecycle checks without update mode, the existing tool-pin sync assertion,
and the planning approval/admission/guidance/provenance regressions. No filtering
or update-mode environment was used for this run.
