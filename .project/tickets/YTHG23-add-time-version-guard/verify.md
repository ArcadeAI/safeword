# Verify — add-time-version-guard (YTHG23)

Patch: one `Authority` rule added to SAFEWORD.md (template + dogfood).

## Verify Checklist

**Test Suite:** ✓ parity + schema targeted green (40/40); full suite re-run by the done-gate hook (no code touched since the last full green — 2799 pass)
**Build:** ✅ N/A — markdown-only change
**Lint:** ✅ Clean — prettier-formatted before copy
**Scenarios:** ⏭️ Skipped — patch (no test-definitions)
**Dep Drift:** ✅ N/A — no dependency change
**Parent Epic:** VKNF1T-platform-uplift-epic

## What changed

`packages/cli/templates/SAFEWORD.md` + `.safeword/SAFEWORD.md` (byte-identical): new
`**Adding a dependency**` block in the "Authority" section — verify the current
version from the registry (`npm view`, `pip index versions`, `go list -m
-versions`, crates.io) before pinning; never a number from memory. Widened the
closing "don't count for either tier" → "any tier" to cover the now-three tiers.

## Done-when verification

- ✓ Authority section names the add-time moment and a concrete per-ecosystem lookup command.
- ✓ Template and dogfood copies byte-identical (`diff -q` clean; parity.test.ts green).
- ✓ No `safeword check`/audit machinery added (kept to the behavioral anchor, per scope).

**Next:** Close YTHG23 and start `explain-at-the-gate (ZCYD5P)`.
