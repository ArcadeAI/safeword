---
id: YSDAM8
slug: restore-current-retrospectives
type: task
phase: verify
status: in_progress
created: 2026-10-17T13:06:10.819Z
last_modified: 2026-10-17T13:06:10.819Z
subtype: bug-investigated
scope:
  - Replace the Codex retrospective default with the current supported flagship.
  - Preserve Sonnet and Cursor aliases and explicit model overrides.
  - Regenerate bundles and verify selection through the real extractor.
out_of_scope:
  - Changing PR review models or unrelated provider routing.
  - Changing authentication, prompts, sandbox policy, or model discovery.
done_when:
  - Unconfigured Codex extraction selects gpt-6-astra and succeeds with ChatGPT authentication.
  - Explicit overrides and other provider defaults retain their behavior.
  - Targeted tests and generated surface checks pass.
---

# Restore retrospective extraction with current models

**Goal:** Use supported current model defaults for automatic session retrospectives.

**Why:** The Codex retrospective default gpt-5.5 is rejected by ChatGPT authentication.

## Work Log

- 2026-10-17T13:06:10.819Z Started: Created ticket YSDAM8
- 2026-10-17 Implemented: default changed after two RED assertions; all 141
  focused and 2,174 smoke tests pass. Real strict-schema extraction passes on
  Codex 0.163.0 and pinned 0.160.0 for empty and planted-finding transcripts.
  Generated freshness, parity, root ESLint and all package typechecks pass.
  Independent Claude/Opus review approved; final evidence is in verify.md.

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

- Existing real config-to-extractor tests must request gpt-6-astra without an
  override; preserve override, Sonnet, and Cursor assertions.
- Run real Codex extraction on a synthetic transcript with the existing strict
  output schema, read-only sandbox, and hooks disabled; require success.
- Regenerate all five surfaces and check parity, types, and lint.

## Implementation Plan

Update existing default-selection expectations first and observe failure
against gpt-5.5. Change the default constant, rerun focused tests, regenerate,
and verify real extraction. Historical explicit-model fixtures stay unchanged
because they test argv forwarding.
