# Current delivery quality review

Historical review authority: the later user instruction explicitly authorizes
admin merge after green CI. See [admin delivery follow-up](admin-merge.md) and
[bounded verification](verify.md) for normal task closure and final PR gates.
Earlier Draft/no-merge conclusions below remain historical, not current authority.

## Quality Review

**Currency:** ⚠️ Checked against primary sources on 2026-10-20. Installed and locked YAML is 2.9.0, while the unchanged manifest asks for ^2.9.1 and upstream now lists 2.9.1 as stable. The used v2 APIs are documented; the inherited version mismatch is recorded rather than repaired through an unrelated dependency update.
**Sources:** ✓ Current Node filesystem documentation, YAML documentation/Context7, upstream releases and advisory bounds, current source, authenticated independent reviews and exact-head CI evidence were inspected.
**Correct:** ✓ Within the residual #5051 delivery scope. Ledger completeness and unsafe human terminal rendering found in this pass were corrected; the broader feature is not accepted or complete.
**Elegant:** ✓ The confirmation and pending result reuse the existing terminal-safe reviewer-text function. Original finding bytes, authenticated review identity, fingerprint calculation and approval rules stay intact.
**No-bloat:** ✓ No new dependency, parser, fallback route or terminal-sanitization implementation. The coordinator change only exports the existing sanitizer.
**Wiring:** ✓ Real CLI/PTY disposition tests cross command routing, authenticated job storage, confirmation and atomic ticket update. The reviewer executable is the process boundary. Installed copy/native identity regressions also pass; these are mechanics, not live reviewer judgment or human usability qualification.

**Verdict:** APPROVE for the corrected bounded source/test/document delivery;
retain Draft and the explicit broad-feature limitations.

**Critical issues:** None remaining within this review's bounded delivery scope.
The initial ledger-completeness error is repaired, with no scenarios checked off.

## Scope and investigation

Reviewed base e7b1f9f9c39da46f954d244d2371aa279ae96c1e through
38ff2f7452cc20097cbf7e0df9858b994e1541ea, then the corrective worktree whose
production source is committed in 39f635771. Final checks preceded that source
commit and used the same source/test bytes; this report does not invent an
exact-commit test invocation.

The plan checked four angles: current dependency/API contracts; trust boundaries
and reviewer-controlled text; real-collaborator test quality and failure paths;
and consistency between canonical scenarios, ledger and verification claims.
The configured principles, personas and surfaces were freshly resolved through
review-knowledge. Their concrete consequences are preserving human consent,
accepted scope and honest proof limits, rather than treating a green test as
human experience or semantic approval.

Initial source review c3fb422b-e7f2-40ba-afb7-537ad285f753 approved all
eight then-changed production files and twenty changed test/support files.
Initial document review ca97a622-097f-4722-9cab-a820cdb8cda5 requested
changes. The independent route was Claude/opus, cross-agent. Corrected portions
were re-reviewed separately; unchanged portions retain their initial provenance.
Generated bundles were regenerated and checked, not independently reviewed as
minified source. No unchanged paid qualification was rerun.

## Corrections and TDD evidence

The ledger omitted two canonical scenarios and misnamed one. Added unchecked
RGR entries for R2's canonical entry requirements and R14's installed re-review,
and aligned the R9 title. A deterministic comparison reports 55 feature titles,
55 ledger titles, no missing/orphan titles, 165 unchecked boxes and zero checked
boxes. This repairs tracking; 172 expanded root cases remain undefined.

The architecture date was corrected. Historical verify.md now labels its
revision window and the later ledger-count correction explicitly, links later
production work, and binds summary test/typecheck/refactor rows to their actual
evidence windows. Old counts and failures remain in history and raw evidence.

The source review's terminal warning was confirmed at the actual human output
boundary. Reviewer findings are untrusted prose and previously reached both the
confirmation prompt and the pending human result without the existing display
normalization/bound.

- RED e6ef8cf8c: two real CLI/PTY failures demonstrate terminal controls and
  oversized prompt prose. Twenty-one unrelated cases were filtered, not passed.
- GREEN 880f03709: reuse the existing sanitizer for the consent prompt. All
  23 disposition tests pass, including preservation of the original stored
  finding bytes. Generated carriers were regenerated and verified.
- Follow-up review b45d8874-c657-486e-8e2f-8826e829d383 identified the
  same display class in the pending result. RED 1ef5b71da reproduces it after
  an explicit negative answer in non-JSON terminal output; ticket bytes stay
  unchanged. The original and lint-clean RED outputs remain retained.
- GREEN 39f635771 applies the same sanitizer to that display message while
  retaining original machine data. All 24 disposition tests pass. No finding
  severity, target, reason, fingerprint or accepted-boundary authority changed.

## Objective checks

- Final focused regression set: 46/46 passed across disposition, disposition
  identity, installed copy admission, native copy dispatch and review identity.
- Selected public prose/terminal-format tests: 2 passed, 138 filtered by the
  stated test-name expression. This is not a new full public-routing pass.
- Root lint, Gherkin lint and CLI tsc: exit 0. Test launchers rebuilt the CLI.
- All five generated surfaces regenerated with lifecycle verification; final
  static check reports all five current. Generation finished before final tests.
- Diff audit: no dependency violations, 156 modules / 304 dependencies. Learning,
  principle and domain reference checks emit no findings. Whole-repository
  Knip/clone/upgrade discovery remains outside diff scope.
- Exact-head CI at 38ff2f745 was terminal green: both Node jobs passed 706
  CLI files with 11,503 passing tests and ten skips; package acceptance passed
  597 scenarios / 11,140 steps, the package-wide proof-tag lane passed 51 tests,
  and release gates passed 81. Run: [CI 39435239332](https://github.com/ArcadeAI/safeword/actions/runs/39435239332).
  That CI predates the terminal fixes and is historical after the new push.

Final code/test repair review 33c4eeee-1e45-4839-ba59-cc3a66c0da5f and
ledger/verification review b0385729-1f8c-4bec-b541-0f80f4a8da49 approve
the corrected work, with authenticated status rechecked. Document repair review
be9ff921-8c29-4bec-b188-3a84fd46ca89 also covered the corrected architecture
date. All used Claude/opus with cross-agent independence. Earlier rejections and
intermediate approvals remain history, not substituted current approvals.

## Suggested improvements and retained limits

- Long finding previews still truncate with a visible ellipsis at the existing
  2,000-code-point bound. Stored findings retain all original text. A fuller
  consent preview/explicit truncation count is optional future work; do not claim
  that every character of a long finding was displayed.
- Raw data.finding remains available to machine consumers. JSON encoding does
  not remove every bidi/C1/separator character. The sanitization guarantee is
  for the prompt and human finding messages, not arbitrary raw JSON echoed by
  another consumer. C1-specific pending coverage remains a nonblocking dense-case
  gap; the reused sanitizer handles that class.
- The optional capabilities fixture example remains deferred; required syntax
  and real authenticated public command routing are already exercised. Adding
  a fake review ID alone would not establish the authenticated pending path.
- In-lock finding re-selection remains deferred under the documented trusted
  job-store boundary. Completing an already completed job invalidates it rather
  than replacing it with a different approved result; the current-status check
  rejects that state. This is not protection from an actor inside the signing
  key boundary. YAML ledger presentation and symlink/owner-preservation warnings
  remain recorded in earlier reviews.
- Proposed architecture records stay Proposed because broad plan acceptance is
  unresolved. No #5086 fallback behavior was imported. Historical verify.md's
  later ledger correction is labeled; its 51-test proof count is package-wide,
  not 51 proofs for this root feature. Prior authenticated approval counts are
  verified by their retained status receipts, not by their becoming current now.
- The broad feature still has two scenario-review errors, 172 undefined cases,
  host/cloud/human qualification deferrals and contrary historical observations.
  The reproduced 500 ms route-test failures and abandoned refactor remain failed
  observations. Existing dependency advisories and the YAML patch mismatch are
  deferred; no package or lockfile changed in this review.

## Primary-source provenance

- (verified this session) [YAML documentation](https://eemeli.org/yaml/):
  toJS resolves YAML nodes to native values; uniqueKeys validates duplicate map
  keys; Document mutation/stringification are documented. Replacing node values
  does not promise retention of prior comments/style.
- (verified this session) [YAML releases](https://github.com/eemeli/yaml/releases):
  2.9.1 is the current stable release; 2.9.0's notes warn that parsing may throw.
- (verified this session) [Upstream YAML advisory](https://github.com/eemeli/yaml/security/advisories/GHSA-48c2-rrv3-qjmp):
  the listed v2 affected range is below 2.8.3, so it does not newly implicate the
  installed 2.9.0. This is not a blanket vulnerability-free claim.
- (verified this session) [Node v24 filesystem docs](https://nodejs.org/docs/latest-v24.x/api/fs.html):
  exclusive wx creation and renameSync are supported. The application lock only
  serializes cooperating disposition writers; unrelated writers may still race.

**Next:** Review Draft PR #5980 with its new-head CI and these explicit limits;
do not merge, promote or infer broad-feature completion.
