---
id: 3TJD0A
slug: reliable-lean-intake
type: epic
phase: done
status: done
scope:
  - Evaluate whether reviewers distinguish an authorized recovery policy from an assumption in the plan.
  - Evaluate handbook reductions, including downstream routing, stale-plan consent and architecture decisions.
  - Five intake evaluations on Claude and Codex.
  - Evaluate duplicate intake prose and required confirmation pauses as separate changes.
out_of_scope:
  - Full feature implementation outside the focused routing and code-quality checks.
done_when:
  - Each candidate has a recorded two-host decision and selected changes pass combined verification.
product_plan_contract: v1
children:
  - TFNBXC
  - JPT08W
  - 2M8A2C
  - XACF52
  - 4BAM6A
  - WCXR0P
  - QJ3EK7
  - PH91BA
  - J97V67
  - AWECEC
  - GF2EF8
  - PEA6ZB
  - P4H33N
  - ZX3EEA
created: 2026-11-26T07:08:24.535Z
last_modified: 2026-11-26T18:24:06Z
---

# Get reliable feature plans with shorter instructions for Claude and Codex

**Goal:** Validate decision ownership, fresh-feature intake, and three isolated prompt reductions on both hosts.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-26T07:08:24.535Z Started: Created ticket 3TJD0A

## Evaluation plan

For the original five intake evaluations, baseline is product revision `904e78010`. Pin both hosts to the same comparison snapshot. Keep each candidate isolated.

1. Replay the café reviewer pair three times per host with a single sentence about the source of product choices. Require at least two paired successes out of three per host. Measure exact findings, approvals and spend.
2. Run a new equipment-loan feature on both hosts. Test disclosure of an existing-loan conflict and preservation of the supplied unmatched-return rule. Each trial needs a correct plan and independent approval before any scenario or code. Charge author and reviewer against the shared $3 cap. Route new product decisions to the operator.
3. Remove the repeated Product Plan walkthrough from the handbook.
4. Remove the duplicate phase-to-file table from the BDD skill.
5. Condense duplicated checkpoints, project-context instructions and template examples in the intake guide. Preserve child and exceptional paths.

Compare each deletion to baseline on the same inputs, verify both host bundles, and replay the accepted combination on both hosts before adoption. Record failures and incomplete evidence separately. Jobs use new workspaces and local account credentials. Keep raw logs private.

## Results

[Scorecard, evidence and decisions](./scorecard.md)

All five evaluations have recorded decisions. The 65-line reduction passed six trials on both hosts across three features. Keep the original reviewer wording. Raw evidence showed no draft PRs requiring cleanup.

Follow-up: [Handbook reductions and behavioral checks](../QJ3EK7-lean-session-guidance/ticket.md).

All 78 planned trials have scored outcomes. The approved shift plan allows back-to-back assignments and rejects positive-duration overlap for the same employee.

## Net effect of the completed work

Word counts compare the canonical Markdown templates at `904e78010` and `1babb6821`, counting whitespace-separated words once per source file. Generated copies and evaluation infrastructure are excluded.

| Source | Before | After | Words changed |
| --- | ---: | ---: | ---: |
| SAFEWORD.md | 4,064 | 3,128 | −936 |
| bdd/SKILL.md | 790 | 729 | −61 |
| bdd/DISCOVERY.md | 2,323 | 2,143 | −180 |
| guides/architecture-guide.md | 692 | 884 | +192 |
| guides/planning-guide.md | 2,068 | 2,222 | +154 |

The three core files shrank by 1,177 words (16.4%). Including the two guides, the net reduction was 831 words and 84 lines. On the one-file feature the shorter handbook cleared intake in 4/4 trials compared with 2/4 for the original. Both failures invoked BDD and then wrote scenarios before independent approval. The trial count supports a regression check. Total spend and pass rate across other work remain open empirical questions.

## Intake priorities

These ratings express the value of keeping an instruction in the intake path. Only the previously scored variants have measured outcomes.

| Value | Material | Proposed treatment |
| --- | --- | --- |
| 1/5 | Repeated Killer Demo formula, “feel like magic” prose, parser explanation in the child template, repeated empty-file instructions | Keep one example, the required heading syntax and one combined project-context question. Cut duplicate explanations. |
| 2/5 | Overlapping phase and resume tables, conversation techniques, directory trees, work-log examples, later verification mechanics | Consolidate the phase map. Leave repair details and downstream procedures in their owning references. |
| 2/5 | Four compulsory confirmation pauses for every standalone feature | Test one final confirmation plus questions when a choice changes the outcome. |
| 3/5 | Why now, milestone shape, demo wording, glossary, principles, unaffected platforms, separate dimensions artifact | Scale detail to its consequence. Keep an observable demo and the justified skip for one obvious dimension. |
| 3/5 routinely; 5/5 when triggered | Child inheritance, stale-plan review, legacy tickets, demand research, hard-to-reverse decisions | Keep short triggers. Retain explicit consent and independent worktree review for stale plans. |
| 4/5 | Intended user and job, measurable success, individually testable Rules and stable IDs, scope, exclusions, affected surfaces and preserved behavior | Keep these in the plan and ticket so reviewers can identify what the user agreed to. |
| 5/5 | Route even a one-file feature to intake. Walk through first, interrupted and repeat use. Distinguish supplied answers, delegated choices and unresolved user decisions. | Protect and test with paired supplied and hidden preferences. |
| 5/5 | Independent review of current plan, blocking findings versus suggestions, collection of pending review and same-ticket phase advance before scenarios or code | Protect. Score the approved plan and first downstream edit on both hosts. |

## References reached from intake

- **Start:** [SAFEWORD.md](../../../packages/cli/templates/SAFEWORD.md) routes new capabilities to [the BDD skill](../../../packages/cli/templates/skills/bdd/SKILL.md), which links directly to [DISCOVERY.md](../../../packages/cli/templates/skills/bdd/DISCOVERY.md). The handbook also points feature and task starts to the [planning guide](../../../packages/cli/templates/guides/planning-guide.md).
- **Project inputs:** Discovery names the configured persona, glossary and surface files and asks the agent to read the configured principles. Defaults are `<namespace-root>/{personas,glossary,surfaces,principles}.md`. Group missing context into one question. A child feature also reads its parent’s `spec.md` for the job, milestone and inherited demo.
- **Plan authoring:** The CLI scaffolds `spec.md` from the [standalone template](../../../packages/cli/templates/spec-template.md) or [child template](../../../packages/cli/templates/child-spec-template.md). Discovery explicitly points authors repairing a handwritten plan to the standalone template. The ticket, plan and `dimensions.md` are work products.
- **Independent review:** Discovery calls the [quality-review skill](../../../packages/cli/templates/skills/quality-review/SKILL.md) with the ticket’s `spec.md` as its sole review target. The reviewer’s product rubric originates in the marked section of Discovery.
- **Conditional references:** [Demand research](../../../packages/cli/templates/skills/demand-research/SKILL.md) for a consequential unresolved demand claim or an explicit request. The handbook names the [cold-start check](../../../packages/cli/templates/guides/cold-start-check.md) for a recorded one-way decision and the [architecture guide](../../../packages/cli/templates/guides/architecture-guide.md) for significant implementation choices. Its [LLM eval guide](../../../packages/cli/templates/guides/llm-evals-guide.md) applies to AI features, and its [skill eval guide](../../../packages/cli/templates/guides/skill-eval-optimization-guide.md) applies when measuring a prompt change like this one.
- **Exit:** Discovery links directly to [SCENARIOS.md](../../../packages/cli/templates/skills/bdd/SCENARIOS.md). Open it after the same ticket successfully advances to `define-behavior`.

## Follow-up protocol

1. **Trim duplicate prose first.** Isolate the repeated demo wording and downstream verification explanation in Discovery. Keep the observable demo requirement, its template example and the later phase checks. Compare against the completed epic baseline on Claude and Codex.
2. **Test confirmation count separately.** Compare four pauses with one final plan confirmation plus consequential questions. Use a fully specified request, a hidden data-loss decision and a child ticket. Record unnecessary confirmations, missed decisions, plan correctness, independent approval and the first downstream edit. Adopt only if confirmations fall while both hosts preserve the decisions, parent boundaries and approval order.
3. Keep the remaining lower-ranked items in the backlog. Replay accepted changes together before closing this follow-up.

## Intake-only experiments

- [Keep feature discovery focused on product choices](../PH91BA-concise-intake-guide/ticket.md)
- [Make empty project and plan templates easier to fill](../J97V67-concise-intake-templates/ticket.md)
- [Reduce repeat approvals for feature owners](../AWECEC-fewer-intake-pauses/ticket.md)
- [Load planning details only when the work needs them](../GF2EF8-focused-planning-reference/ticket.md)
- [Get product plans to independent review with fewer detours](../PEA6ZB-direct-intake-review/ticket.md)
- [Keep specialist advice available when it matters](../P4H33N-conditional-intake-guides/ticket.md)
- [Help returning authors find the right phase once](../ZX3EEA-single-bdd-phase-map/ticket.md)

Scope ends when the Product Plan advances to define-behavior. Leave later scenario writing, architecture planning and verification procedures in place.

The seven intake-only tickets have recorded decisions. [Follow-up results, scope and evidence](./intake-only-results.md).

Reopened for [review of unapproved product choices](../TFNBXC-verify-product-choice-authority/ticket.md). The earlier trial results stand.

Closed the reopened intake evaluation. The reviewer change missed its two-host, two-feature adoption threshold. [Results and decision](../TFNBXC-verify-product-choice-authority/scorecard.md).

Two further independent-review variants were evaluated on both hosts. [Results for the opposite-policy question and verdict instruction](../TFNBXC-verify-product-choice-authority/scorecard.md#follow-up-opposite-policy-and-verdict-severity).

The [12-trial author pilot](../TFNBXC-verify-product-choice-authority/scorecard.md#author-pilot-asking-before-writing-a-recovery-rule) completed with the current intake guide retained.

The [request-first comparison](../TFNBXC-verify-product-choice-authority/scorecard.md#request-first-reviewer-experiment) completed on both hosts with the single-pass default retained.

The [café and label-station comparison](../TFNBXC-verify-product-choice-authority/scorecard.md#single-pass-interruption-and-retry-question) completed with the existing reviewer rubric retained.

The [café plan reversal](../TFNBXC-verify-product-choice-authority/scorecard.md#café-plan-reversal) isolated the effect of changing the proposed crash policy.

The [neutral-wording café trial](../TFNBXC-verify-product-choice-authority/scorecard.md#neutral-wording-of-the-café-request) completed with 36 verified reviews.

The [shipping-label comparison](../TFNBXC-verify-product-choice-authority/scorecard.md#shipping-label-recovery) recorded 48 reviews testing repeat charges and manual recovery.

The [delegated shipping trial](../TFNBXC-verify-product-choice-authority/scorecard.md#delegating-the-shipping-label-recovery-decision) found zero required requester approvals in 24 reviews and three actionable objections to silent repeat charges.
