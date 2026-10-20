# Residual #5051 verification checkpoint

Production/test tree: `2f0c493128829d8788cd79abb66ba18668e00a98`.
This report covers the six-source-file Product/scenario admission and disposition
slice from main `e7b1f9f9c`. It does not close the broad child ticket or #4200.
The Draft PR's current-head evidence block records later CI/test completion.

## Evidence

- Initial RED `1d9670061`: 13 intended failures, four controls. Initial GREEN
  `cf188cf91`: 17 tests passed. Repeat-decline RED `896fef833`: YAML collection
  decoding rejected a second decline. Corrected in `3ce21185e`; expanded slice
  passed 89 tests in 17 CLI files (`expanded-green.log.gz`).
- Review-directed RED `b798c82e7`: two intended failures and 13 passing controls:
  nonregular Product target safety occurred after context resolution, and a
  confirmation-time edit gave the wrong recovery code. Fixed in `2f0c49312`.
  Final GREEN was queued behind a foreign full suite at this checkpoint.
- Three package typechecks plus website typecheck pass (`typechecks-final.log.gz`).
- All five derived surfaces regenerated. Final static verification and commit
  guard pass (`generated-static-pass.log.gz`). The generator's additional
  lifecycle execution could not acquire the foreign test lock and exited 75;
  it started no lifecycle test. That failure is retained separately, rather
  than called a completed generator proof. Current-head CI/full execution must
  cover the lifecycle tests.
- Diff-scoped audit: no dependency violations (82 modules, 113 dependencies).
  Whole-repository dependency freshness, clone detection and Knip were outside
  the diff audit. No dependencies changed.
- Independent Claude review `a7043499-6b22-42ae-b3c6-5a1c77c112a4` requested
  changes; raw rejection retained. After the new refusal/race tests and repairs,
  Claude review `77b32379-30be-43ac-833d-993af02c6e2a` approved with cross-agent
  independence (reported model `opus`). The packet covers all changed source,
  tests, generated CLI reference and plugin metadata. Compiled bundle bytes
  were excluded from independent review; generation and static freshness are
  separate proof. No raw-bundle independent inspection is claimed.
- Source self-review re-read the complete six-file diff after the last material
  change. Existing canonical author-copy, semantic projector, native identity,
  approval and fallback implementations remain intact. Test additions preserve
  main's existing assertions. Generated changes map to the reviewed source and
  were regenerated rather than edited manually.

Logs and review packets are under `evidence/5051-main/`, including the failed
expanded attempt and process-overlap incident. None is silently reclassified.

## Remaining review observations and disposition

- PTY confirmation proves terminal mechanics, not human intent. It matches the
  existing approval command; only optional findings from an already-approved,
  authenticated current review are eligible. No cryptographic user identity
  claim is made. Host permission/consent remains separate.
- The disposition lock serializes cooperating disposition writers. An unrelated
  writer ignoring that lock can race after the compare and before rename. No
  universal filesystem compare-and-swap guarantee is claimed.
- A quality-review listing an oversized generated file before the sole Product
  work target can derive context from the original first path and fail closed.
  Reviewer classified this as non-blocking; retain it as a limitation rather
  than broadening target/exclusion reconciliation in this slice. A sole Product
  target avoids that mixed-target edge. No currency bypass is claimed.
- Numeric-equivalent finding spellings such as `1e0` select the same valid
  optional finding. Strict spelling validation is deferred; invalid or missing
  indices are refused, and no different finding is selected.
- Shared installed-distribution fixture extraction and a richer placeholder
  command-catalog fixture are deferred. The public CLI/PTY cases exercise the
  actual command; no capability-fixture success is used as behavioral proof.

## Scope and historical limits

See `resume-5051.md` for the retained six failed / 585 unfinished broad acceptance
cases, 418 undefined bindings, 33 deferred cases, R7 human deferral, old R9
provenance observation, contrary live qualification observations and the
unchanged historical archives. No paid qualification, corpus, oracle or fallback
change was made. No epic acceptance, human usability, merge or Ready authority
is inferred from the deterministic tests or reviewer verdict.

DRAFT: final serialized GREEN and current-head CI are pending at this checkpoint.

## Follow-up after the checkpoint

- Serialized review-repair GREEN: all 15 tests pass, including both intended
  RED repairs. The queued command acquired the shared lock and reached a
  terminal result; it is separate from the earlier overlapped preambles.
- The 81-file preservation sweep passed 1,048 tests, skipped two and failed two
  Product rows of main's native-copy dispatch fixture because it supplied no
  principles inventory. The minimal Product document also lacked the semantic
  frame. This is retained as a failed run, not counted as a clean aggregate.
- Only Product fixture setup in `native-planning-copy-dispatch.test.ts` was
  extended with existing inventories and a valid Product frame. No assertion,
  host/phase row, drift mutation or call-count check changed. All six native
  host/phase cases then passed. A fresh aggregate sweep and current-head CI
  remain required; fixture-only independent review follows separately.
- A relocated Codex native bundle passed a standalone command walkthrough:
  authenticated fixture Product review with identity → noninteractive decline
  pending with unchanged ticket → terminal-confirmed record → old review stale.
  Raw output is `native-walkthrough.log.gz`. It used a local reviewer fixture,
  not a live model, paid qualification or evidence of human intent.

## Preservation aggregate and public fixture follow-up

The fresh preservation aggregate passed all 81 files: 1,050 tests passed and two
were skipped. Claude independently approved the native fixture-only delta as
`75d05bd2-4ecd-4bc2-bab6-3d3207e71822`, preserving the original call-count,
missing-copy, outside-rubric drift and restored-approval assertions. Its
context-delivery and inverse-case observations are covered by the separate
Product integration/role tests; its inherited packet-line parser warning is
retained as fixture-only optional cleanup.

A scan of remaining owned Product fixtures found public contract-routing rows
with the same missing inputs, including the configured namespace. Their targeted
RED produced three owned-Product failures and three passing generic/task/context
controls; 133 unrelated cases were filtered, not claimed as executed. Only the
owned Product rows now receive inventories and a valid Product frame, with the
configured namespace receiving those same inventories. No routing assertion or
negative control changed. The full 139-case public wiring file is running at
this checkpoint; fresh fixture-only independent review and current-head CI are
still required. See `public-fixture-red.log.gz` and `public-fixture.diff`.
