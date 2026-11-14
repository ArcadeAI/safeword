# Retrospective assurance review

Scope: the Luna retrospective diff from origin/main, its directly changed
command/extractor tests and the additional real-process retry proof. This is
not a repository-wide dead-code, dependency-upgrade or architecture redesign.

## Audit and applied improvements

The prescribed diff-scope code, learning, principle-trace and domain-document
checks ran. Config sync reports Healthy/Changed:no; dependency-cruiser reports
no violations in nine modules/five dependencies. No changed agent
configuration or learning files require separate repair. README and the
configured website docs do not pin the superseded model. New code imports no
runtime dependencies and introduces no architectural drift. Whole-workspace
Knip, clone totals and outdated-package discovery are intentionally outside a
diff audit; this is not a clean baseline claim.

Added six real Stop -> real source CLI -> fake Codex failure cases: nonzero,
missing file, empty file, malformed JSON, a non-array findings value and an invalid item inside a findings array. Each records the
external mode and closed stdin, checks the specific completed failure, requires
no offset/draft/filed record, retries valid empty output, checks the exact
committed offset/tool count/fire count, then repeats without growth and requires
no additional extraction. This replaces the former gap between separately
faked hook-child and extractor-child proofs. A standalone nonzero/retry probe
already demonstrates that boundary; final Vitest results belong in verify.md.

Manual BDD now separates hook input, extractor failure and timeout contracts.
The retry, successful recovery and no-growth outcomes have separate scenarios.
Filing settings, threshold, schema output and silence preconditions are explicit.
A file:false transport-failure outline was misleading: filing was disabled, so
its transport was not exercised. It now describes retained drafts when filing
is disabled. Filing component proof is described as the shared pipeline;
no full finding-bearing Stop-to-filing journey is claimed.

Independent Claude/Opus scenario review
f2ec9460-120d-489b-a12e-c79e68d5b976 approved the partitioned scenarios. Its
nonblocking clarity suggestions were applied in a later edit, so that receipt
is historical evidence, not a fresh approval of the final text. The final
quality review must cover the final text. Its GH628F concern was answered by
reading the superseding spec and positive/negative real-hook filing-gate tests.
No legacy spec or acceptance rule was silently rewritten.

## Refactor ledger

A separate read-only scout inspected semantic duplication, model policy,
resolution and mirrors. The primary agent checked all five entries:

1. Retain local argv assertions: they protect independent builder and configured
   runner boundaries; a shared parser would hide the independence for tiny reuse.
2. Retain the inline Luna predicate: one execution point and one policy do not
   justify a helper or lookup table.
3. Retain the shared resolver: the runner already resolves once and delegates
   argv construction; no duplicate selection mechanism was introduced.
4. Retain generated mirrors: they are required delivery surfaces, checked by
   generators and parity, rather than hand-maintained duplication.

5. Extract the new test’s fake executable installation into file-local
   `installFakeCodex(directory, initialMode)`. The executable bytes, permissions,
   paths, modes and cleanup are preserved, while the real CLI symlink, transcript
   and behavioral assertions remain visible. All 149 focused tests pass after
   extraction. The test introduction and refactor are separate scoped commits.

Disposition: all five entries resolved. No production refactor is warranted;
the one useful test-fixture extraction is complete.

## Remaining limits

The feature remains @manual and excluded from Cucumber. A real cross-process
timeout test and one finding-bearing Stop-to-egress-to-filing journey are still
unproved. The new tests cover an initially unprocessed transcript; they do not
claim exhaustive retry, pre-existing-offset or mutation coverage. Production
timeouts, model behavior, prompts, authentication and review policy are unchanged.
Release lockfile review coverage and administrative merge approval remain
separate, unresolved delivery decisions; these reviews do not waive them.

## Quality-review dispositions

Whole scoped review f212b5db-10ca-4ebf-8936-87f84eb0ee47 approved the initial
retry proof with intact Claude/Opus cross-agent independence. Its item-level
schema warning is applied as a sixth case: findings is an array containing an
invalid item. Its native-event suggestion is applied to the eight tool calls.
The global offset location follows production's protocol; fresh directory-based
session IDs and afterEach cleanup isolate these fixtures. It is not a promise
of cleanup after a process crash. Execution results are recorded in verify.md. Those test refinements require a
fresh final implementation review; the older receipt is not that approval.

## Execution finding: empty spool representation

The first execution of the six new cases failed because they asserted that no
spool file exists. Raw inspection showed a legitimate zero-byte spool after
both extraction failure and valid empty retry: the filing cleanup atomically
rewrites an empty queue. The contract requires no draft entries, not no file.
The corrected assertion accepts an absent file or requires exactly empty raw
contents; malformed lines and hidden drafts still fail. No production behavior
was changed. The 149 focused tests passed twice after this correction. A semantic mutation
that misclassified failed empty extraction as success failed all six new cases;
the original source was restored byte for byte before another green run. Final
quality review covers the correction and fixture extraction.

## Final quality-review improvements

Independent Claude/Opus review 78f51fa7-791e-45a6-ba6d-216cb96659cc approved
with no errors. Applied its useful suggestions: the manual contract explicitly
names the dogfood source-CLI path (not installed-package delivery), and each
Stop invocation now checks only its own diagnostics. Failure must contain no
successful extraction diagnostic; recovery must contain no failed extraction
diagnostic; no-growth must contain no extraction diagnostic at all. Exact
child status, offset, queue and invocation assertions are retained.

Remaining observations are answered: existing post-extraction cleanup may run
with empty findings even after extraction failure; this task proves observable
failure/retry outcomes and does not claim that pipeline was skipped. Changing
that existing production flow exceeds this assurance task. Global offset crash
cleanup remains explicitly unproved. Bun is required by this repository's
pinned launcher and by the real Stop path; an unsupported PATH without Bun is
an environment setup failure, not a reason to replace the real child boundary.
Ticket last_modified is refreshed during verification. Review
96c22a4c-0833-4a57-a1f5-d1a9cc158f35 approved the diagnostic and wording
improvements with no errors. Its two useful follow-ups were applied: recorded
real-process argv must include the adjacent `-m gpt-6-luna` pair and adjacent
`-c model_reasoning_effort="low"` pair; standard GitHub token variables are
cleared and gh uses an empty fixture-owned config directory. These isolate
authentication state, without claiming a network sandbox. All 149 focused tests
pass after those changes.

Its timeout suggestion is declined: all six cases pass within the existing
per-process cap, and the unrelated relay file passes its existing budget in
isolation. Raising budgets without a reproduced failure would hide evidence.
Each Stop error is asserted explicitly, so an ETIMEDOUT failure is reported.
The remaining source-CLI, empty-pipeline and crash-cleanup observations remain
disclosed limits. Final verification review includes these last improvements.

## Final code verdict

Independent Claude/Opus review 9a48145c-0f33-469c-9f2a-69b2727239bd approves
the final proof and evidence with no errors. The first recorded child pins the
real default model/reasoning pair; repeating those assertions on the retry and
adding unrelated sandbox flags is deferred. The unchanged builder has separate
argv/security-contract coverage, and this task's six cases protect extraction
failure, offset preservation and retry. This is bounded coverage, not an
exhaustive argv mutation claim. The legacy exit-code path remains outside this
public typed-handler proof, as the mutation record already states.

A fresh unmodified current-source buildAutoExtractor probe with no model
override also passed: empty input yields zero findings, planted Safeword bug
yields one checked finding. No filing was invoked. Logs are
.project/tmp/current-final-live-extractor.json and its empty .err sibling.

## Main reconciliation

Main 25b548622 introduced separate proof-command fixes. The source PR had six
conflicts, all generated lifecycle/identity/inventory artifacts. They were
resolved through the canonical generator, which regenerated and verified all
five surfaces without a lifecycle result-hash guard failure. The combined tree
passes 149 focused and 2,201 smoke tests, full lint/types and 276 parity
pairs/11 contracts.
The feature diff remains 24 paths against current main. Upstream's changes are
not presented as this task's implementation. Final verification review covers
the updated evidence and reconciled feature diff.

## Combined-tree review disposition

Claude/Opus review d7f0a48b-88bf-4350-813e-14cc29dd692a approves the combined
24-path diff with no errors. Applied its evidence-summary warning: the local
Test Suite row is warning/pending full final-head hosted CI, rather than a
blanket green check. Focused and smoke results remain green and the original
aggregate failures remain visible. Final hosted evidence belongs on PR5924.

The authentication observation was checked directly. sourceHookEnvironment
spreads process.env first, then explicit overrides; the test supplies undefined
values. A pinned Node child-process probe confirms GITHUB_TOKEN, GH_TOKEN and
SAFEWORD_RETRO_CHILD are absent in the child, rather than strings or inherited
values (.project/tmp/current-auth-env-proof.json). No credential value was read
or printed. Thus no helper change is needed.

A further optional offset-predicate mutation is deferred. Offset absence is
asserted directly after every failed extraction; the executed semantic
mutation already proves a discriminating failure/retry contract. Mutation
claims remain expressly bounded, with no exhaustive score. No correctness
error or unresolved required refactor remains.
