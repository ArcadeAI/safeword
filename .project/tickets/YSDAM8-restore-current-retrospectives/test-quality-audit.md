# Retrospective BDD and TDD quality assessment

Scope: the Luna default, retrospective command/extractor tests, and the legacy
Codex retro feature with its direct Stop, spool and nudge proofs. This is not a
whole-repository audit or an exhaustive mutation score.

## TDD findings and corrections

1. The original assertions accepted a bare model_reasoning_effort value without
   its required -c. A deliberate production mutation passed both old assertions.
   The strengthened checks inspect values bound to -c and fail that mutation.
   On the final Luna-only implementation the same mutation fails both positive
   command tests; restoration passes all 143 tests. Logs in .project/tmp:
   retro-audit-weak-mutation.log, retro-override-mutation.log and
   retro-override-final-green.log. No mutation remains in production source.
2. Release review 89006760-0ba2-402e-a946-59c535a1afdc caught a compatibility gap:
   forcing low reasoning on every model could break existing overrides. Three
   regression assertions failed before correction (retro-override-red.log).
   Only Luna now pins low reasoning. Other configured model names retain their
   existing reasoning behavior. All 143 cases pass after correction, including
   the real config-to-runner boundary and two non-Luna builder examples.

These tests fake the subprocess boundary but use real config resolution and
extractor construction. Checked extraction distinguishes valid empty findings
from missing output, malformed output and child failure. Fresh temporary
projects keep model-selection tests independent. Live default extraction adds
separate model-access/schema evidence. Six-case synthetic screening is bounded
model evidence, not production quality or statistical equivalence.

## BDD corrections

- Updated the obsolete gpt-5.5 default to Luna low. The override scenario now
  requires other models to receive no added reasoning-effort setting.
- Corrected the header's false claim of one complete Stop-to-filing test.
  Hook tests fake the safeword retro child; extractor tests fake Codex; filing
  tests supply findings. The two process hops are now explicit.
- Distinguished silent extraction/file:false from the later filing dispatch.
  GH628F's spec explicitly supersedes unconditional CDX602 Stop silence.
- Replaced an unrecognized canary with a recognized secret and customer path.
  Successful filing must create exactly one issue, redact its body and drain
  the spool. Failed filing must leave a nonempty sanitized spool, preventing
  vacuous no-leak assertions. Existing real-egress/disk tests prove this boundary.
- Split prompt events into first, repeated, new-batch and no-draft scenarios.
  Retained legacy criterion IDs and documented current persona equivalents.

## Remaining proof gaps

The feature is manual and excluded from Cucumber. It must not be counted as
executed acceptance coverage. Independent scenario reviews, most recently
76e5e2c0-0570-4d56-8f53-ec4c554a72a0 before the final override correction,
returned changes_requested for the inherited mixed-failure outline. That
verdict remains an unresolved broader BDD assessment, not an approval.

The outline mixes hook input errors, hook-child failures and nested extractor
output failures. Tests checking extractor ok:false do not prove that the real
CLI exits nonzero and Stop preserves its transcript offset. Timeout rows lack
named proof. There is no single automated Stop-to-model-to-egress-to-filing
journey. Advisory-silence preconditions, rule lineage and digest-bound assertions
also need sharper prose/proof. These paths were not changed by the model fix.

Disposition: retain the desired failure invariant and disclose missing proof;
add a real Stop-to-CLI-to-fake-Codex failure test as the next integration
improvement. No test was disabled, weakened or deleted to ship this update.

## Verification limits

CI 39040198584 passed all package, acceptance, release and static checks on
pre-compatibility head ae5111146. It does not verify the later Luna-only change.
The first local full CLI pass had 11,149 passes, 12 skips and one OpenCode
fixture cleanup ENOTEMPTY failure. The verification resolver started a second
full pass, which also reported an OpenCode failure; that run was stopped when
the compatibility finding required a source change. The full local plan did
not complete and is not a green verification claim. Final exact-head hosted
CI remains required. Log: .project/tmp/retro-final-verify.log.

## Judgment

The focused TDD tests now detect two demonstrated regression classes: malformed
reasoning argv and interference with other models. BDD prose is more accurate,
but its manual status and missing cross-process failure proof remain meaningful
quality debt. A large passing count cannot erase those limits.
