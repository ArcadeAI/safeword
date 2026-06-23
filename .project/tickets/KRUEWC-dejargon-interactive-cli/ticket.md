---
id: KRUEWC
slug: dejargon-interactive-cli
parent: K6CAJN-ntb-experience-epic
type: task
phase: done
status: done
created: 2026-06-21T14:24:00Z
last_modified: 2026-06-23T05:29:00Z
---

# De-jargon the interactive CLI; auto-default the namespace-move prompt

**Goal:** Make the unmediated terminal surface (`setup`/`upgrade`/`check`) answerable by a non-coder, and never halt on a jargon-only decision.

**Why (audit H3):** The CLI runs with no agent and no `/explain` between it and the NTB. Sharpest case: `upgrade.ts:278-280` halts on _"Move project namespace from `.safeword-project/` to `.project/` (recommended)? [y/N]"_ — a blocking choice the NTB has no basis to make. Plus `setup.ts` eslint-peer/dependency-cruiser warnings and a thin "Next steps" (Run check / Commit to git) that assumes git fluency.

## Scope sketch

- Auto-pick the recommended namespace move unless an explicit `--interactive`/`--no` flag is given; print what happened in plain words rather than asking.
- Gloss-lead the `setup` warnings (eslint peer mismatch, dependency-cruiser) with one plain sentence; keep the technical detail for TBs.
- Treat post-`setup` "Next steps" as the NTB handoff (coordinate with O3OG0N).
- Files: `packages/cli/src/commands/setup.ts`, `upgrade.ts`, shared output helpers.
- Out of scope: the session-start hook messages (H2).

## Work Log

- 2026-06-21T14:24:00Z Created from PRODUCT-AUDIT-ntb.md H3.
