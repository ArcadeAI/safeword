# Verify: 68SRC8 — Long-session stickiness for drift-prone user-comm rules

## Verify Checklist

**Test Suite:** ✓ 218/218 tests pass across 10 quality.ts-touching test files (targeted run per project rule; +2 tests vs F14BG2/QSNKBB baseline of 216, from the new `Rule: SAFEWORD.md "Talking to the user" pointer (68SRC8)` describe block)
**Build:** ⚠️ ESM build succeeds; DTS build fails on the pre-existing missing peer-dep tracked in [G2BA7M](../G2BA7M-vitest-eslint-plugin-peer-dep/ticket.md) — not from this change
**Lint:** ⚠️ ESLint config blocked by the same pre-existing peer-dep ([G2BA7M](../G2BA7M-vitest-eslint-plugin-peer-dep/ticket.md)); direct `tsc --noEmit` on the modified files clean
**Scenarios:** ⏭️ Skipped — task sizing, no test-definitions.md
**Dep Drift:** ✅ Clean — no new dependencies
**Parent Epic:** F14BG2-stop-hook-verdict-shape (verified and shipped this session; 68SRC8 builds on its verdict-shape work)

## Done-when criteria — per-item check

1. **SAFEWORD.md "Talking to the user" section moved to last content section** — ✓ PASS. [packages/cli/templates/SAFEWORD.md](../../../packages/cli/templates/SAFEWORD.md) section order is now: Workflow → Code Philosophy → Anti-Patterns → Authority → Guides → Standing Rules → Enforcement → **Talking to the user** (last). Verified by grepping the section headers in order.

2. **Runtime SAFEWORD.md re-synced** — ✓ PASS. `diff -q packages/cli/templates/SAFEWORD.md .safeword/SAFEWORD.md` clean.

3. **UNIVERSAL_HEADER has the pointer line** — ✓ PASS. First line of [packages/cli/templates/hooks/lib/quality.ts:31](../../../packages/cli/templates/hooks/lib/quality.ts) reads: `Apply SAFEWORD.md "Talking to the user" rules to your reply: scan-not-read, lead with the answer, named structure only when it carries weight, end with **Next:**.` — ~30 tokens, references the section by name, doesn't duplicate the content.

4. **Runtime quality.ts re-synced** — ✓ PASS. `diff -q` clean.

5. **quality.test.ts has positive-assertion for the pointer line** — ✓ PASS. New `Rule: SAFEWORD.md "Talking to the user" pointer (68SRC8)` describe block at [packages/cli/tests/quality.test.ts](../../../packages/cli/tests/quality.test.ts) with two `it()` cases — asserts the pointer appears, references "Talking to the user" by name, includes the scan-not-read keyword and the bold `**Next:**` discipline.

6. **Learning file exists with Covers: line on line 3** — ✓ PASS. [.safeword-project/learnings/long-session-style-drift.md](../../../.safeword-project/learnings/long-session-style-drift.md) line 3 begins `Covers: claude.md dismissive wrapper, long context attention drift…` so `safeword sync-learnings` will pick it up.

7. **Targeted vitest run passes** — ✓ PASS. 218/218 across the 10 quality.ts-touching files; 101/101 across the 3-file subset (quality + hooks integration + stop-hook-transcript-format).

8. **Cursor stop hook still imports QUALITY_REVIEW_MESSAGE unchanged** — ✓ PASS. [packages/cli/templates/hooks/cursor/stop.ts:9](../../../packages/cli/templates/hooks/cursor/stop.ts) unchanged. The pointer line appears in the cursor surface too (since `QUALITY_REVIEW_MESSAGE = UNIVERSAL_HEADER + PHASE_EVIDENCE.implement`), which is the correct behavior — cursor sessions drift the same way.

## Notes

- Audit passed: pending — run `/audit` next to clear the done-gate.
- The pointer line went at the _start_ of UNIVERSAL_HEADER rather than at the end. Reasoning: it's general framing for the entire reply ("apply X rules to your reply"), structurally precedes the verdict-template-specific instructions. Read top-to-bottom: general → specific.

**Verdict:** Ready to mark done, pending /audit.
