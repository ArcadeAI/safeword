---
id: 92NVVY
slug: correct-repeated-stop-feedback
type: task
phase: verify
status: in_progress
created: 2026-08-08T18:16:37.779Z
last_modified: 2026-08-11T05:10:09.000Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1758
scope: |
  - Keep the full decision-brief contract at Claude SessionStart.
  - On a noncompliant Claude Stop review, render the smallest self-contained
    exact correction from DECISION_BRIEF_GRAMMAR and the parser's observed
    failure instead of repeating the full contract.
  - Give no-phase work a phase-neutral evidence requirement rather than the
    current implementation-only fallback.
  - Keep disqualification, hard/anomaly gates, stop_hook_active loop prevention,
    phase deduplication, and compliant-reply silence unchanged.
  - Recover malformed non-object quality-state roots before recording the
    existing generic-review deduplication marker (#2268).
  - Update canonical templates, dogfood runtime, schema/parity contracts, and
    focused unit/integration coverage, including the setup-installed Stop entry
    point (#2267).
out_of_scope: |
  - Cursor Stop output; its adapter cannot inspect the assistant response.
  - Codex Stop enforcement; no equivalent adapter exists.
  - New retry counters, session thresholds, or adaptive escalation state.
  - Changing the standing SessionStart contract or per-prompt reminder.
done_when: |
  - Missing, multiple, reordered, and wrong-sequence decision briefs each receive
    a grammar-derived exact correction with an exhaustive fallback.
  - A generic/no-phase correction asks for what changed, what was checked, and
    the concrete result; it never claims the work is in implementation.
  - Phase-aware corrections keep their existing one-line phase evidence.
  - Disqualification paths still receive the full review contract.
  - A real stop-quality.ts integration test proves the correction is wired from
    last_assistant_message through the production parser to decision:block.
  - The setup-installed Stop hook returns the concise correction.
  - A non-object quality-state root is repaired and the following Stop review is
    deduplicated.
  - Cursor output is unchanged.
  - Focused unit and installed-hook integration tests pass.
---

# Correct repeated Stop feedback without losing reply compliance

**Goal:** Replace repeated full Claude Stop contracts with exact grammar-derived corrections while preserving first-rewrite compliance.

**Why:** Repeated identical contracts waste context, while vague short reminders fail to reproduce the required decision-brief shape.

## Work Log

- 2026-08-08T18:16:37.779Z Started: Created ticket 92NVVY
- 2026-08-08T18:20:00.000Z Revalidated issue cluster: #2166 is another Claude
  occurrence of canonical #1758. Idle repetition (#1492), implement-step noise
  (#464), and reminder-prefixed prompt-boundary false positives are already fixed.
  Current generic no-phase reviews still repeat the full contract once per edited
  user turn and incorrectly append implementation evidence.
- 2026-08-08T18:20:00.000Z Bounded headless-harness evaluation: the original
  terse diagnostic failed immediately (`Decision Brief` instead of the required
  `CONFIDENT —` verdict). Revised self-contained exact shapes passed 5/5 cases
  through the production parser with required evidence; the current full contract
  passed 5/5 structurally and 3/5 on exact evidence. Average correction size:
  609 vs 1,493 characters (-59%). Cases: missing verdict after implementation,
  missing verdict after spec work, unparseable CONFIDENT, labels before verdict,
  and multiple verdicts. Decision: ship the exact-shape candidate, not the vague
  short reminder; Claude only.
- 2026-08-08T18:50:05.000Z Implemented grammar-derived Stop corrections,
  phase-neutral generic evidence, phase-specific evidence reuse, and full-contract
  preservation for disqualifications. Focused verification passed 180/180 CLI
  tests plus 167/168 relay tests (one skipped).
- 2026-08-08T18:50:05.000Z Quality-review loop found and drove regressions for
  three robustness gaps: inherited prototype verdict names could crash the hook;
  generic CommonMark HTML blocks could hide a valid brief after a blank line; and
  current-turn transcript detection bounded assistant messages but not total lines
  or characters. Added own-property verdict recognition, CommonMark-aware raw-tag
  persistence, fixed transcript budgets, and parser plus real-hook coverage.
- 2026-08-08T19:09:55.000Z Subsequent review passes found interrupting Markdown
  containers could hide preceding top-level content and that transcript budgets
  applied after whole-file loading. The scanner now flushes visible content before
  fences, block HTML, and lists; Stop reads a 256 KiB tail before parsing. Added
  adversarial and multi-megabyte transcript coverage. Final focused verification:
  189/189 CLI tests pass; relay prerequisite 167 passed, one skipped; typecheck,
  targeted lint, schema/parity, and diff checks pass.
- 2026-08-08T19:09:55.000Z Review provenance note: the requested quality-review
  coordinator was run repeatedly, but Claude exhausted its time window each time
  and the coordinator fell back to a same-agent Codex review. All reported findings
  were addressed and regression-tested; independent implementation approval was
  not obtained and must not be inferred from the green fallback review loop.
- 2026-08-09T00:06:14.000Z Revalidated #2267 and #2268 into scope. Added
  setup-backed E2E coverage proving the installed Stop entry point returns the
  concise correction. Reproduced #2268 RED: a `null` quality-state root remained
  unchanged after review. Normalized null, scalar, and array roots to fresh state
  before applying the existing marker; the next Stop is now silent. Combined
  verification: 253/253 CLI tests pass; relay prerequisite 167 passed, one skipped;
  typecheck, targeted lint, parity, formatting, and diff checks pass.
- 2026-08-10T21:20:00.000Z Completed a repository-wide audit on current
  `origin/main`. Fixed the only objective audit error, a stale historical
  principle-trace label after the principles were renamed. Dependency boundaries
  remain clean (1,020 modules / 3,569 dependencies); repository-wide Knip,
  clone, experimental Python, and dependency-freshness findings remain documented
  baselines outside this ticket.
- 2026-08-10T21:20:00.000Z Completed the full quality-review loop against the
  current Claude hooks reference and CommonMark 0.31.2. Review findings drove
  bounded transcript-tail reads, complete current-turn record budgets,
  CommonMark-aware HTML/container terminality, own-property grammar/evidence
  lookups, and normalization of LF, CRLF, and lone-CR line endings. Every
  substantive finding was fixed and regression-tested; the final typed verdict
  is approved. Claude timed out in the coordinator, so reviewer independence is
  explicitly degraded to a separate headless Codex process.
- 2026-08-10T21:20:00.000Z Completed the refactor ledger. Applied eight small,
  behavior-preserving improvements with focused proof after each: clearer parser
  state names, shared paragraph flushing and verdict enumeration, extracted
  violation rendering, early disqualification exit, an explicit current-turn
  record budget, and deduplicated transcript fixtures. Deferred module extraction
  and installed/source runner consolidation because they widen schema/parity or
  obscure distinct entry-point coverage. A final full-suite attempt exposed that
  a 200-record budget regressed the existing 444-record long-turn contract; the
  budget is now 512 while a 600-record fixture proves work remains bounded.
- 2026-08-11T05:10:09.000Z Applied every finding from the final iterative
  quality-review loop. Fenced code is fully opaque; explicit CommonMark HTML
  blocks flush at their closing marker; fence closers require whitespace-only
  suffixes; and record-cap exhaustion is represented as unknown and reviewed
  conservatively instead of claiming turn-local certainty. Added focused
  regressions for comments, raw tags, CDATA, processing instructions,
  declarations, backtick/tilde fences, and bounded long transcripts.
- 2026-08-11T05:10:09.000Z Completed definitive verification on current
  `origin/main` (`fab06c017`): relay 167 passed / 1 skipped; CLI 7,460 passed / 5
  skipped across 482 files; Cucumber 1,514 passed / 3 skipped scenarios and
  66,566 passed / 4 skipped steps; production builds, both project typechecks,
  repository lint, parity, formatting, and dependency audit all passed. Final
  quality verdict is approved with no actionable findings; reviewer independence
  remains explicitly degraded because Claude timed out and Codex performed the
  separate fallback review.
