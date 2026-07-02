---
id: CDX602
slug: codex-retro-parity
type: feature
phase: verify
status: in_progress
parent: RV9JT4-retro-transcript-mining
depends_on: [BNGK9W]
external_issue: https://github.com/ArcadeAI/safeword/issues/602
external_prs: [https://github.com/ArcadeAI/safeword/pull/601]
scope: |
  Bring the local Codex retro adapter up to the invisible-retro design shipped for
  Claude: a Codex Stop hook runs extraction synchronously and silently in a nested
  `codex exec` session, feeds the shared egress/spool/direct-file path, and leaves
  fallback filing to the existing UserPromptSubmit nudge lane. Reuse the shared
  retro core rather than inventing a second Codex pipeline.
out_of_scope: |
  - Codex cloud behavior; hooks are undocumented there and tracked as a later spike.
  - Reopening the #602 design choices: sync Stop, OpenAI model, Lane 2
    UserPromptSubmit, shared-core reuse, and cloud out of scope are decided.
  - Changing the retro egress, dedupe, draft schema, or filing-subagent contract
    beyond what Codex needs to call the existing path.
done_when: |
  A substantial local Codex session runs a synchronous, invisible Stop-hook
  extraction via child `codex exec`, uses an OpenAI default model for Codex while
  preserving Claude's sonnet default, spools only post-egress drafts, tries the
  direct local filing path, surfaces unfiled drafts through UserPromptSubmit
  additionalContext, and never emits the old Stop `{decision:"block"}` continuation.
created: 2026-07-02T00:11:26Z
last_modified: 2026-07-02T01:04:00Z
---

# Codex retro parity: invisible local extraction and Lane-2 filing

**Goal:** Make local Codex match the invisible retro pipeline without hijacking the
user's turn.

**Why:** Codex currently uses the older visible Stop continuation, so local Codex
sessions are one generation behind the Claude baseline and can interrupt the user
instead of filing out-of-band.

**GitHub:** [#602](https://github.com/ArcadeAI/safeword/issues/602)

## Scope

- Replace `packages/cli/templates/hooks/codex/stop.ts` and its `.safeword` mirror
  with a synchronous, silent extraction adapter.
- Add the Codex/OpenAI model default while preserving Claude's sonnet default and
  the existing `retro.model` override.
- Wire the existing `prompt-retro-nudge.ts` into Codex `UserPromptSubmit`.
- Reuse the existing retro trigger, egress, draft spool, JSONL spool, nudge, and
  filing primitives.

## Out of Scope

- Codex cloud behavior.
- Re-deciding the #602 architecture.
- Rewriting the retro egress, dedupe, draft schema, or filing-subagent contract.

## Done When

- Codex Stop uses child `codex exec` with inline digest, closed stdin, schema output,
  `SAFEWORD_RETRO_CHILD=1`, and no Stop continuation.
- Codex uses an OpenAI default model; Claude still defaults to sonnet.
- Extracted findings route through the existing egress/spool/direct-file path.
- Codex UserPromptSubmit surfaces unfiled draft nudges through the existing nudge.
- Template and `.safeword` hook mirrors match, schema registration is current, and
  verification plus audit pass.

## Work Log

- 2026-07-02T04:43:58Z Docs: resolved the audit documentation warning by
  updating README and website Hooks & Skills reference with Codex Stop retro
  extraction and UserPromptSubmit prompt-retro-nudge behavior.
- 2026-07-02T02:39:11Z Quality review: fixed two high-confidence review gaps.
  The CLI wrapper now still extracts and spools sanitized drafts when GitHub
  transport is unavailable, so Lane 2 has drafts to nudge; Codex Stop now stages
  offset state and commits it only after the child `safeword retro` process exits
  cleanly. Added regressions for no-transport spooling, schema-valid empty Codex
  output, invalid/non-zero extraction signaling, and child-failure no-offset.
- 2026-07-02T01:04:00Z Verify/Audit: lint clean, typecheck clean,
  focused runtime/config tests 120/120 passing, fast smoke 912/912 passing,
  build green, Cucumber 181 scenarios / 3414 steps passing, parity checks green,
  audit config/dependency checks clean with existing repo-wide knip/jscpd
  warnings. Full `bun run test` was interrupted after extended progress through
  install-heavy setup tests; no product failure observed.
- 2026-07-02T00:35:00Z Complete: implement - Codex Stop is now silent and
  synchronous, Codex extraction uses structured `codex exec`, per-agent model
  defaults are covered, Codex UserPromptSubmit retro nudge is wired, template
  hook mirrors are byte-identical, and focused runtime/config tests pass.
- 2026-07-02T00:23:00Z Complete: scenario-gate - independent review ended with
  0 must-fix; remaining should-strengthen items applied; review stamped; phase
  advanced to implement.
- 2026-07-02T00:22:00Z Review: fourth independent scenario gate had 0 must-fix
  and 2 should-strengthen; split UserPromptSubmit wiring from nudge semantics and
  broadened direct-file failure partitions.
- 2026-07-02T00:20:00Z Review: third independent scenario gate found no-leak
  coverage as must-fix; strengthened egress scenario with leak canary, split model
  override, added empty-findings boundary, and distinct-batch nudge assertion.
- 2026-07-02T00:19:00Z Review: second independent scenario gate found recursion
  guard coverage as must-fix; added child env assertion, retro-child no-spawn
  scenario, timeout failure partition, and surface tags.
- 2026-07-02T00:18:00Z Review: independent scenario gate found 1 must-fix and
  3 should-strengthen; applied fail-open state assertion, split failure classes,
  second-prompt nudge assertion, and exact Codex model default.
- 2026-07-02T00:13:00Z Complete: define-behavior - 6 scenarios defined across
  4 rules in `packages/cli/features/codex-retro-parity.feature`.
- 2026-07-02T00:12:00Z Complete: intake - #602 already supplied accepted scope,
  out-of-scope, done_when, and design decisions; moving to behavior definition.
- 2026-07-02T00:11:26Z Started: #602 scope ticket created after live Codex
  Stop-hook spike passed and was reported on #602
  (https://github.com/ArcadeAI/safeword/issues/602#issuecomment-4861045872).
