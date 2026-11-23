# Frozen Transcript Fixture Testing

**Status:** Accepted
**Date:** 2026-03-15

**What.** A checked-in JSONL fixture (`packages/cli/tests/fixtures/stop-hook-transcript.jsonl`) captures the Claude Code v2.1.42 transcript wire format. CI runs the stop hook against it.

**Why.** The stop hook parses transcript JSONL to detect edits. Changes to field names, nesting, or content block types can make the hook silently exit 0 instead of blocking. The test checks that the hook still detects edits in the captured transcript.

**Trade-off.** Maintainers must update the fixture by hand when Claude Code changes its transcript format. The test runs without an LLM API key.

**Alternatives.** Real E2E with live API (rejected: non-deterministic, expensive), hand-crafted simplified fixtures only (rejected: doesn't catch real format drift)

**Implementation.** `packages/cli/tests/integration/stop-hook-transcript-format.test.ts`; fixture includes thinking blocks, tool_use, tool_result, and real envelope fields (parentUuid, requestId, etc.)
