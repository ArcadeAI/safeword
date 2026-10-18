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

Final negative-argv review found a distinct gap: checking only -c-bound values
missed a bare reasoning argument on other models. That production mutation
passed both old negative builder cases. Whole-argv assertions now fail both;
restoration passes all 143 command/extractor cases. The configured runner also
uses the stronger assertion. Logs: retro-negative-weak-mutation.log,
retro-negative-strong-mutation.log and retro-negative-final-green.log. This is
a second targeted argv mutation, not an exhaustive mutation score. Runtime
source remains byte-identical to CI-verified b352.

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
executed acceptance coverage. Historical scenario review
76e5e2c0-0570-4d56-8f53-ec4c554a72a0 requested changes to the mixed-failure
outline. Follow-up 530XE8 partitions those failures; scenario review
f2ec9460-120d-489b-a12e-c79e68d5b976 approves the partitioned manual contract,
with additional clarity improvements covered by quality review
8edb5a3c-7545-4bca-b4d5-4cff600c6d0c. These are prose reviews, not a claim
that Cucumber executes the manual feature or that every desired path has proof.

The earlier outline mixed hook input errors, hook-child failures and nested
extractor output failures. The follow-up separates them and adds real
Stop/CLI retry tests; its verification record owns the execution results. Timeout rows lack
named proof. There is no single automated Stop-to-model-to-egress-to-filing
journey. Advisory-silence preconditions, rule lineage and digest-bound assertions
also need sharper prose/proof. These paths were not changed by the model fix.

Disposition: retain the desired failure invariant and disclose missing proof;
add a real Stop-to-CLI-to-fake-Codex failure test as the next integration
improvement. No test was disabled, weakened or deleted to ship this update.

## Verification limits

CI 39042244535 passed full packages, release gates and static checks on
compatibility-corrected head b352845a8 on Node 22 and 24. Cucumber passed on
Node 24 only (596 scenarios and 11,118 steps). Older CI 39040198584 on ae5111146
is historical. Exact closure-head 4cf CI 39049110781 now passes before delivery.
The first local full CLI pass had 11,149 passes, 12 skips and one OpenCode
fixture cleanup ENOTEMPTY failure. The verification resolver started a second
full pass, which also reported an OpenCode failure; that run was stopped when
the compatibility finding required a source change. The full local plan did
not complete and is not a green verification claim. A subsequent isolated OpenCode test also failed cleanup; the cause is not
claimed to be suite load. Exact closure-head hosted CI now passes; this does not change the historical local failure. Log: .project/tmp/retro-final-verify.log.

## Judgment

The focused TDD tests now detect two demonstrated regression classes: malformed
reasoning argv and interference with other models. BDD prose is more accurate,
but its manual status and missing cross-process failure proof remain meaningful
quality debt. A large passing count cannot erase those limits.

## Follow-up assurance work

The user requested applying the remaining review suggestions in task 530XE8.
Its real Stop/CLI retry tests and partitioned manual scenarios address the
missing extractor failure boundary. Final execution and independent review
evidence for that follow-up belongs to its own verification record; this
assessment does not retroactively count those new tests as executed here.
