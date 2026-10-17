# Luna retrospective verification

Current behavior: unconfigured Codex extraction selects gpt-6-luna with low
reasoning. Only that model receives the explicit reasoning flag; other model
names keep their previous reasoning behavior. Claude sonnet and Cursor auto,
prompts, authentication, sandbox, schema and parser are unchanged.

**PR Scope:** ✅ Inspected the branch diff: the Codex default and Luna reasoning
flag, direct regression tests, required generated/dogfood output, and the
requested bounded BDD/TDD assessment. Draft PR #5924 is open.

## Current evidence

- Three override-compatibility assertions failed before the correction; all
  143 command/extractor tests pass afterward. Real config and construction are
  exercised with only the subprocess edge faked.
- Removing the low flag's -c fails both positive command assertions. Restoring
  production source passes all 143 tests. No mutation remains.
- All five surfaces regenerated after the compatibility correction; lifecycle
  result hashes remain unchanged. Dogfood installation succeeds.
- Earlier strict-schema live default extraction on installed Codex 0.163.0 and
  pinned 0.160.0 succeeded for empty and planted-finding transcripts without
  injected argv or model overrides. The final default argv is the same; a fresh
  current-source live check and smoke/static results are being collected.
- Both Luna low and Sol low passed six predeclared synthetic screening cases.
  See model-comparison.md for raw-evidence paths, API unit rates and limits.

## Independent review and corrective decision

Source review f085fd23-ffd2-409d-bc4f-168602cef216 and test review
6836f181-9591-44c1-bc65-22d1be86944e approved earlier implementations. Release
scope review 89006760-0ba2-402e-a946-59c535a1afdc rejected forcing low reasoning
on every model as incompatible with a minor release. Applied its recommended
compatibility correction: only Luna pins low; other overrides remain untouched.
A fresh implementation review must cover this correction.

See test-quality-audit.md for the completed assessment, demonstrated mutations,
BDD corrections and explicitly unresolved inherited failure-propagation proof.
The legacy manual Gherkin is not executed by Cucumber or approved end-to-end.

## Full-verification evidence and limits

Hosted CI 39040198584 passed on ae5111146 before the compatibility correction:
both Node versions, Cucumber, release gates, lint/types, parity, CLI contract,
OpenCode conformance and dependency audit. It is historical, not final-head CI.

The first local full CLI pass recorded 11,149 passes, 12 skips and one OpenCode
fixture cleanup ENOTEMPTY failure. A second full pass was interrupted for the
compatibility correction after another OpenCode failure. The complete local
verification plan did not finish; do not call it green. Log:
.project/tmp/retro-final-verify.log. Final exact-head CI is required before Ready.

No release or installed plugin-cache update has occurred. Live access is scoped
to this login, screening is synthetic, public API unit rates do not measure
ChatGPT subscription billing, and no fresh Desktop activation is claimed.
