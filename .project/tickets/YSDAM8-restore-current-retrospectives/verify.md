# Luna low retrospective verification

Branch: `codex/refresh-retro-models`, based on merged main `cfe93e30c`.
Current configuration: **gpt-6-luna with low reasoning**. This supersedes the
initial Astra choice and the intermediate Sol choice; the user explicitly
approved Luna after the comparison in model-comparison.md.

**PR Scope:** ✅ Inspected the branch diff: only the Codex default, its low
reasoning flag, existing test expectations, required generated/dogfood output,
and this task's evidence are included. Draft PR #5924 is open for exact-head CI evidence.

## Behavior

Unconfigured Codex extraction selects gpt-6-luna. The child receives
`-c model_reasoning_effort="low"` explicitly. Claude remains on sonnet and
Cursor on auto. Explicit model names in retro.model still override the default;
low reasoning applies to the Codex extraction invocation. Prompts, containment,
authentication, parser, dependency versions and PR review models are unchanged.

## Current evidence

- RED: three Sol/low assertions failed against Astra/default reasoning.
  Two Luna default assertions subsequently failed against the intermediate Sol
  implementation. These are observed failures, not fabricated RED receipts.
- GREEN: all 141 tests in the retrospective command and extraction files pass
  with Luna low, including real config-to-argv wiring and explicit overrides.
- Smoke: all 2,174 tests across 103 files pass on the final source.
- Live: real buildAutoExtractor with no model override and no injected argv,
  ChatGPT authentication, existing strict findings schema and read-only
  containment. Both Codex CLI 0.163.0 and pinned 0.160.0 return checked.ok:true
  for a no-friction transcript and a planted Safeword bug. No issues were filed.
- Screening: both Luna low and Sol low passed six predeclared cases through
  pinned Codex and the real extractor. All 12 outputs passed schema validation.
  Findings were inspected for grounding; see model-comparison.md for limits.
- All five generated surfaces regenerated and verified current. Lifecycle
  result hashes stay unchanged; installed-tree/template hashes change.
- Dogfood installation succeeds. All 276 parity pairs and 11 contracts pass.
- All three packages typecheck. Configured ESLint on changed tests and
  Prettier checks pass. The prior root ESLint passed; the normally excluded
  template's forced lint diagnostic was identical to its base (22 existing
  findings). No lint policy or unrelated template code was changed.

## Evidence paths

Current logs in .project/tmp: retro-luna-red.log, retro-luna-green.log,
retro-luna-smoke.log, retro-luna-live.json, retro-luna-pinned-live.json,
retro-luna-generate.log, retro-luna-parity.log, retro-luna-types.log,
retro-luna-lint.log and retro-luna-install.log. The earlier Sol RED/GREEN
runs are in retro-sol-red.log and retro-sol-green.log.

The model-comparison plan, runnable local harness, raw findings and progress
are named in model-comparison.md. Earlier Astra review receipts are historical;
the final Luna/low source and generated diff receive a fresh independent review.

## Independent review

Claude/Opus review f085fd23-ffd2-409d-bc4f-168602cef216 approved the final
canonical source, tests, mirrors, generated metadata and comparison without
errors. Only the two oversized generated CLI bundles were excluded; their
regeneration/freshness passed. The reviewer independently recomputed the
comparison medians and confirmed that the findings matched their inputs.

Applied the documentation warning: the ticket's test contract now says Luna
low rather than Astra. Answered the override warning by stating the actual
intended contract: explicit model names remain honored, while all Codex
retrospective invocations use low reasoning. This changes the previous implicit
model-default reasoning for overrides; non-reasoning models that reject this
setting are not guaranteed compatible. The argv test explicitly supplies a
custom model and asserts the low setting. No reasoning-override mechanism or
fallback was added to this bounded update. The comparison's injected low flag
does not prove production wiring by itself; the separate live default runs do.

## Limits

This is local implementation evidence, not a published release or complete
authoritative verification claim. Full-suite CI, release, and deployment into
the existing installed plugin cache have not run for this branch. The ticket
remains in verification. Live checks prove access/schema behavior on this login,
not universal account availability. The six-case synthetic screening is not a
production-quality benchmark, statistical equivalence test, or reliable speed
comparison. Public API price comparisons do not measure subscription billing.

## Test-quality follow-up

See test-quality-audit.md for the bounded BDD/TDD assessment. Removing the
required -c flag originally escaped two assertions; strengthened checks now
fail three assertions for that same mutation, and restoration passes all 141
cases. Independent Claude/Opus test review
6836f181-9591-44c1-bc65-22d1be86944e approved the stronger tests. The broader
manual BDD contract received changes_requested; blocking prose contradictions
and the vacuous spool assertion are corrected for a fresh review. This feature
is not executed by Cucumber and does not prove one complete Stop-to-filing path.
