# Retrospective assurance review

Scope: the Luna retrospective diff from origin/main, its directly changed
command/extractor tests and the additional real-process retry proof. This is
not a repository-wide dead-code, dependency-upgrade or architecture redesign.

## Audit and applied improvements

The prescribed diff-scope code, learning, principle-trace and domain-document
checks ran. Config sync reports Healthy/Changed:no; dependency-cruiser reports
no violations in eight modules/five dependencies. No changed agent
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
resolution and mirrors. The primary agent checked all four entries:

1. Retain local argv assertions: they protect independent builder and configured
   runner boundaries; a shared parser would hide the independence for tiny reuse.
2. Retain the inline Luna predicate: one execution point and one policy do not
   justify a helper or lookup table.
3. Retain the shared resolver: the runner already resolves once and delegates
   argv construction; no duplicate selection mechanism was introduced.
4. Retain generated mirrors: they are required delivery surfaces, checked by
   generators and parity, rather than hand-maintained duplication.

Disposition: no behavior-preserving production refactor is warranted. No
unrelated code was restructured to manufacture a refactor commit.

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
of cleanup after a process crash. Completion evidence remains pending until
verify.md records the new tests' real results. Those test refinements require a
fresh final implementation review; the older receipt is not that approval.

## Execution finding: empty spool representation

The first execution of the six new cases failed because they asserted that no
spool file exists. Raw inspection showed a legitimate zero-byte spool after
both extraction failure and valid empty retry: the filing cleanup atomically
rewrites an empty queue. The contract requires no draft entries, not no file.
The corrected assertion accepts an absent file or requires exactly empty raw
contents; malformed lines and hidden drafts still fail. No production behavior
was changed. Final execution and re-review must cover this correction.
