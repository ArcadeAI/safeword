---
id: YSDAM8
slug: restore-current-retrospectives
type: task
phase: done
status: done
created: 2026-10-17T13:06:10.819Z
last_modified: 2026-10-17T15:28:25Z
subtype: bug-investigated
scope:
  - Use GPT-6 Luna with low reasoning for economical Codex retrospectives.
  - Preserve Sonnet and Cursor aliases and explicit model overrides; only Luna pins low reasoning.
  - Regenerate bundles and verify selection through the real extractor.
out_of_scope:
  - Changing PR review models or unrelated provider routing.
  - Changing authentication, prompts, sandbox policy, or model discovery.
done_when:
  - Unconfigured Codex extraction selects gpt-6-luna at low reasoning with ChatGPT authentication.
  - Explicit model names remain honored; other models retain their existing reasoning behavior.
  - Targeted tests and generated surface checks pass.
---

# Restore retrospective extraction with current models

**Goal:** Use supported current model defaults for automatic session retrospectives.

**Why:** The Codex retrospective default gpt-5.5 is rejected by ChatGPT authentication.

## Work Log

- 2026-10-17T13:06:10.819Z Started: Created ticket YSDAM8
- 2026-10-17 Historical initial implementation (superseded): 141 focused and
  2,174 smoke tests passed before the final override-compatibility correction.
- 2026-10-17 Compatibility correction: only Luna pins low reasoning; other
  configured models retain their prior behavior. All 143 targeted and 2,194
  smoke tests pass; fresh real extraction passes on Codex 0.163.0 and 0.160.0.
  Independent Claude/Opus review a7f18cf9-5fa8-49af-90ba-8832176193c0 approved
  the corrected source. CI 39042244535 passed code head b352845a8 on both Node
  versions; Cucumber passed on Node 24. Closure-commit CI is required before Ready.
- 2026-10-17 Final negative-argument check: the old builder assertions accepted
  a bare reasoning argument on other models; stronger whole-argv assertions
  reject that mutation. Restored runtime source passes all 143 focused cases
  and remains byte-identical to the CI-verified implementation.

## Root Cause

The Codex extractor hard-codes gpt-5.5, introduced in July. Reproduction on
Codex CLI 0.163.0 with the existing containment flags returns HTTP 400:
the model is not supported with ChatGPT authentication. CLI parsing succeeds
and the request reaches the service, ruling out invalid flags and a missing
binary. A minimal probe using gpt-6-astra with the same containment flags exits
zero with a small synthetic schema, so the current authentication works without
modification. This probe establishes model access; the planned real extraction
must separately validate the retrospective findings schema.

## Decision

Current direction (2026-10-17): the user rejected Astra's cost, first selected
Sol low, and then explicitly approved Luna low after the requested comparison.
Set gpt-6-luna and pass model_reasoning_effort="low" to the Codex child.
The release compatibility review narrowed the flag to Luna; other configured
models retain their previous reasoning behavior. Three compatibility assertions
failed before this correction; all 143 focused tests pass afterward.
Both candidates passed all six predeclared screening cases, including correct empty
results, explicit and indirect bugs, and a signal buried in a longer digest.
Luna's published uncached input/output API rates are 20 times lower than Sol's;
this is not an actual ChatGPT subscription billing measurement. See
model-comparison.md for methods, evidence and limits. Earlier Astra results
below are historical, not this final configuration's evidence.

### Historical initial choice

Use gpt-6-astra, returned by the official latest-model resolver and verified
against this login. Claude's sonnet alias already selects the latest Sonnet;
Cursor auto delegates to its host. Keep both and explicit retro.model overrides.
Avoid pinning Claude to a version or adding network discovery during selection.

Sources fetched 2026-10-17:
https://developers.openai.com/api/docs/guides/latest-model and
https://code.claude.com/docs/en/model-config.
The browser rejected the resolver's Markdown migration URL twice; a direct
official-page fetch succeeded. No API parameter changes are needed for this
CLI invocation; the live structured-output probe confirms compatibility.

## Test Definitions

- Existing real config-to-extractor tests must request gpt-6-luna and low
  reasoning without an override; preserve model-name, Sonnet, and Cursor assertions.
- Run real Codex extraction on a synthetic transcript with the existing strict
  output schema, read-only sandbox, and hooks disabled; require success.
- Regenerate all five surfaces and check parity, types, and lint.

## Implementation Plan

Update existing default-selection expectations first and observe failure
against gpt-5.5. Change the default constant, rerun focused tests, regenerate,
and verify real extraction. Historical explicit-model fixtures stay unchanged
because they test argv forwarding.
