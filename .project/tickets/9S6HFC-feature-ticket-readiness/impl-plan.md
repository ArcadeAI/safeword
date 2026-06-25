# Implementation Plan: Validate feature ticket readiness before define-behavior

**Status:** implemented

## Approach

Riskiest assumption: a single helper can evaluate readiness without changing
the existing late `test-definitions.md` gate semantics. Prove that first with
unit coverage for missing frontmatter, missing/invalid `spec.md`, missing/invalid
`dimensions.md`, and ready tickets.

Build order:

1. Add shared readiness helper coverage for artifact combinations.
2. Use the helper from the PreToolUse ticket phase-entry path and cover denial
   plus allow cases with hook integration tests.
3. Use the same helper from the UserPromptSubmit prompt hook and cover legacy
   resume messaging.
4. Sync template and dogfood hook copies, then run targeted hook suites,
   `test:smoke:fast`, lint, and typecheck.

## Decisions

| Choice | Alternatives considered | Rejected because |
| --- | --- | --- |
| Shared helper used by both pre-tool and prompt hooks | Duplicate checks inline in each hook | Duplicate rules would drift from each other and from the late prerequisite gate |
| Hard-block only the phase edit that enters `define-behavior` | Block every edit while a legacy ticket is unready | Broad edit blocking would make remediation edits harder and over-constrain repair work |
| Prompt hook for legacy/resume tickets | Phase-entry gate only | Legacy tickets already in `define-behavior` would remain silent until test-definition writes |

## Arch alignment

- Honors ARCHITECTURE.md phase-based access control: hard enforcement remains in
  PreToolUse, while prompt-time steering stays advisory/contextual.
- Honors schema-as-source-of-truth by modifying existing managed hook files
  rather than adding a new managed template path.

## Known deviations

skip: no deviations from recorded architecture

## Assessment triggers

- If readiness later requires more artifacts, add them to the shared helper and
  confirm both phase-entry and resume tests fail without the update.
- If auto-scaffolding is added, revisit whether prompt-only remediation remains
  enough for legacy tickets or whether an explicit blocked status is needed.
