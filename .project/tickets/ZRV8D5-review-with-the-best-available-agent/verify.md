# Verify — review with the best available agent (ZRV8D5)

## Verify checklist

**Test Suite:** ✓ The prior full run passed 7061/7061 tests (6 skipped). After all review fixes, the combined affected CLI set passes 101/101; retro-relay separately passes 167/168 with its one intentional skip.
**Gherkin:** ✅ The prior full run passed 1110 executable scenarios. After review fixes, the six structural host-wiring examples pass all 102 steps; the newly explicit host-runtime examples remain `@manual` because the local runner cannot execute host agent behavior.
**Build:** ✅ Success — tsup ESM and DTS builds completed after the coordinator changes.
**Lint:** ✅ Clean — changed TypeScript and Markdown passed the pre-commit ESLint, Prettier, and markdownlint gates; `git diff --check` is clean.
**Scenarios:** All 39 scenario definitions are reconciled. Structural and CLI behavior have executable evidence; host-native runtime scenarios have explicit manual skips rather than overstated automation claims.
**PR Scope:** ✅ The branch changes remain within PR #2003: coordinator review routing, degraded host fallback assets, schema/generated parity, tests, docs, and ticket evidence.
**Dep Drift:** ✅ Clean — no dependency additions or version changes.
**Parent:** N/A — this feature was split from reliable-reviews-for-real-packets (DR6M6N), not blocked by it.
**Reconcile:** ✅ The implementation keeps the coordinator as the machine-enforced control plane and documents the host-owned continuation as model-mediated. Portable `allowed-tools: '*'` remains a deliberate cross-host deviation; the named Claude/Cursor reviewer is read-only, while Codex tool denial is instruction-enforced.
**Experience:** ✅ Walked the Technical Builder through opposite CLI failure → same-agent headless → host fresh-context → bounded main-thread self-review. Worst step is waiting through funded CLI timeouts before degraded feedback. New user-triggered steps versus before: 0. The rave moment remains: some honestly labeled review returns without asking the user to repair tooling first.
**Evidence limits:** ⚠️ Local coordinator behavior is collaborator-tested and the Codex host-native fresh-context route was exercised live. Claude Code Cloud, Codex Cloud, and Cursor Cloud were not available locally; their shipped assets and parity are contract-tested, while live execution remains manual. Host skills are model-mediated, so hostile-input containment and exact route obedience are prompt contracts rather than structural sandboxes.

## Review evidence

- Independent Claude review first requested changes for trusted policy provenance, branch-controlled rubric trust, evidence overstatement, and assurance clarity. Those findings were fixed in the coordinator envelope, shipped contracts, tests, and documentation.
- A final independent Claude attempt timed out before a verdict. The coordinator then produced a same-agent headless `request_changes` result and labeled it degraded; its remaining objection was the disclosed inability to deterministically execute host skills from Vitest.
- A fresh-context in-session Codex reviewer then exercised the actual host-native route and approved with no findings. This is live degraded same-agent evidence, not independent evidence.
- The fixed-rubric main-thread pass found no additional actionable defect after the targeted and full suites were green.
- The updated quality pass found that validated reviewer feedback was hidden from human CLI output, Cursor authors could not reach host fallback, contradictory exhaustion could enter the fallback contract, and the opt-out wording conflicted with the existing global override. The first three were fixed in code/contracts and collaborator tests; the last was reconciled in the specification without weakening the explicit power-user override.
- A later quality pass found that a configured alternate model could be treated as usable even when its executable did not advertise `--model`, spending route budget before degradation. Capability probing now requires `--model` only for alternate-model attempts and records an unsupported candidate as skipped rather than failed.
- After opposite-agent CLI review remained unavailable, a fresh-context in-session spec reviewer passed the final 39-scenario set with no findings. This is degraded same-model review evidence, not independent approval.

## Surface evidence

- Claude Code local: shipped read-only named reviewer and fixed `.safeword` contract; asset/parity tested.
- Claude Code Cloud: assets shipped; live execution skipped locally.
- Codex local: live fresh-context in-session smoke approved with no findings; generated asset parity tested.
- Codex Cloud: assets shipped; live execution skipped locally.
- Cursor local: named reviewer, rule wrapper, and concrete `/finish-review` command shipped; schema, generation, and parity tested; tool-denial enforcement remains host-dependent.
- Cursor Cloud: the concrete continuation command and supporting assets ship in the repository; live execution skipped locally.

## Done-when reconciliation

- ✅ Opposite local reviewers and configured alternate models run before degraded routes.
- ✅ Same-agent headless review precedes host-native fresh-context and terminal self-review.
- ✅ Shipped entry contracts allow only a blocked, `independence: none` `REVIEW_ROUTES_EXHAUSTED` envelope into the host continuation and instruct each host route to run at most once; live host obedience remains manual evidence.
- ✅ `prefer` may complete with degraded findings; `require` remains action required until an independent result exists.
- ✅ Human and JSON output distinguish cross-agent, same-agent headless, fresh-context, and main-thread assurance without claiming false independence.
- ✅ Trusted policy comes only from the coordinator envelope; packets, repository instructions, diagnostics, and credentials remain outside the accepted review contract.
- ✅ Canonical, dogfood, Claude, Cursor, and generated Codex/plugin assets remain registered and parity-tested.
- ✅ Cursor callers now resolve `/finish-review` through a generated, schema-owned command rather than relying on rule activation alone.

## Audit

The post-review diff audit passed with 0 errors. Architecture dependency checks, generated/schema parity, principle trace, namespace docs, learning metadata, build/type generation, and changed-area test quality were clean. The known limitations remain live cloud execution, host-level prompt enforcement, and portable tool-denial asymmetry; none is represented as stronger evidence than it is.
