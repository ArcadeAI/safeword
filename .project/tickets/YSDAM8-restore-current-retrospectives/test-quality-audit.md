# Retrospective BDD and TDD quality assessment

Scope: Luna-low changes and their direct proof in retro-extract.test.ts,
commands/retro.test.ts, the legacy codex-retro-parity.feature and its Codex Stop
integration tests. This is not a whole-repository test-quality audit.

## Findings repaired in this delivery

1. **Weak argv assertion:** both new low-reasoning tests accepted a bare
   model_reasoning_effort value even after its required -c flag was removed.
   A temporary production-code mutation proved both tests incorrectly passed.
   Assertions now collect values actually bound to -c. The same mutation fails
   both tests; restoring production code passes all 141 retrospective cases.
   Production source is byte-identical to the reviewed Luna-low implementation.
2. **BDD default drift:** the legacy feature still specified gpt-5.5 after the
   implementation moved to Luna. Its model-selection scenario now specifies
   gpt-6-luna and low reasoning. The feature header also no longer falsely
   claims a single real Stop-to-codex-to-filing integration boundary.

Evidence: .project/tmp/retro-audit-weak-mutation.log (2 passed),
retro-audit-strong-mutation.log (2 failed), retro-audit-green.log (141 passed).
This is one discriminating mutation, not an exhaustive mutation score.

The independent test review also suggested checking low reasoning on the
configured-model runner path, and avoiding dependence on the order of -c
pairs. Both are applied. Final repetition of the same mutation now fails three
assertions (builder, default runner, configured-model runner); restoration
passes all 141 cases. Final logs: retro-audit-final-mutation.log and
retro-audit-final-green.log. This remains one mutation, not three distinct
mutation experiments.

## Strengths

- Real config resolution and buildAutoExtractor exercise actual config-to-argv
  wiring, faking only the subprocess boundary in those unit/integration tests.
- Checked extraction distinguishes schema-valid empty findings from nonzero
  child exits, malformed JSON and missing output files. Failure does not pass
  merely because both paths return an empty findings array.
- Fresh filesystem fixtures and cleanup keep model-resolution tests independent.
- Real no-override extraction on installed and pinned Codex independently proves
  model access and schema parsing beyond mocked process tests.
- Both candidate models passed all six predeclared screening inputs, including
  negatives. The report correctly limits this to synthetic screening.

## BDD review disposition and remaining inherited limitations

Independent Claude/Opus scenario reviews fd5980b8-4e43-411a-8153-687fcea2cf51
and 89579aa5-8f34-4085-9d9d-8998f2308c0c returned changes_requested. The two
blocking legacy-contract findings are now corrected in the feature source:
unfiled silence explicitly requires selfReport.file:false, and a paired
file:true scenario expects the filing continuation. Successful filing asserts
drain; a separate retained-draft scenario requires a nonempty spool before
checking redaction. Existing commands/retro.test.ts already proves this with
a real sanitizer, real disk, REST 401, a recognized secret and customer path.
The override scenario also explicitly requires low reasoning. These are prose
corrections to established behavior, not changes to Stop or filing policy.
Review d7962db4-f2ed-44a3-b44d-abf5d30cdf5f accepted those corrections but
found that the direct-filing scenario used an unrecognized canary and lacked
an issue-count assertion. It now uses a recognized secret and customer path,
requires exactly one filed issue and a redaction marker, then checks drain.
The hook/extractor two-hop boundary is explicit, prompt events are split into
atomic scenarios including no drafts, and legacy persona aliases are documented.
A fresh scenario review must judge the final contract.

- The feature is tagged manual, so Cucumber excludes it. Separate Vitest proofs
  do not execute the Gherkin or automatically detect every prose drift.
- Stop integration tests fake the safeword child; extractor tests fake codex;
  filing tests supply extracted findings. There is no single automated proof
  spanning the whole Stop-to-model-to-egress-to-filing chain. The misleading
  header is corrected; adding that boundary belongs to a separate integration
  improvement rather than claiming the current tests already provide it.
- Legacy TB/SM criterion IDs remain because they reference the closed CDX602
  spec; the feature documents their current TBU/SWM equivalents rather than
  rewriting historical ticket IDs. The filing-gate scenario explicitly names
  the superseding GH628F lineage. The full parent spec is in refreshed packets.
- The child-failure outline mixes input failures with extraction failures and
  claims timeout/output-state combinations not individually proven at the hook
  boundary. Some compound unit cases would be clearer split by failure class.

Runtime adapter/activation rerun attempted after the audit could not acquire
the shared test lock: another checkout owns PID 60133. No CLI test was started;
this is not a passing result. Log: retro-audit-runtime-proof.log. Existing
hosted CI exercises these tests separately.

## Judgment

The focused Luna/low proof now catches the demonstrated argv regression, and
real extraction covers the immediate compatibility failure. BDD prose and
cross-boundary proof have meaningful inherited debt. Keep that distinction in
the PR and release evidence; neither a large passing count nor the six-case
screening establishes full model quality or end-to-end Stop/filing coverage.
