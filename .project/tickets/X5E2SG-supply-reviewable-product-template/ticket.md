---
id: X5E2SG
slug: supply-reviewable-product-template
type: task
phase: done
status: done
created: 2026-11-10T05:39:56.004Z
last_modified: 2026-11-10T05:39:56.004Z
---

# Give builders a Product Plan template that passes planning checks

**Goal:** Make the shipped Product Plan scaffold declare every field already required by planning review

**Why:** Native Codex trial KZVTRD followed the shipped template and hit missing_planning_context because four required Product Bet fields were absent

## Scope and proof

Add the four Product Bet fields already required by validatePlanningProductFrame to the canonical spec-template.md: Persona outcome inventory, Known facts, Assumptions and Unresolved product decisions. Preserve all current labels and scaffold behavior; do not weaken validation or change accepted scope, review routes, qualification, error classification or unrelated legacy manual templates. Refresh generated mirrors through the repository generators.

Regression: create a standalone feature through the actual local ticket writer and require its Product Plan scaffold to satisfy the existing structural Product Bet validator. This proves scaffold compatibility, not semantic approval of placeholder content. Observe RED on current main, then GREEN after the template correction; retain native failures and the assisted repair separately.

## Root cause

The file-existence hypothesis is false: the native trial spec exists and matches the documented five-field template. Explicit --context does not repair the failure. Planning-role resolution calls validatePlanningProductFrame and wraps its missing-field error as missing_planning_context. The validator requires seven named fields; the canonical template provides only three of those seven. Existing planning-context test fixtures manually supply the four missing fields, explaining why those tests pass while the real scaffold fails. This task fixes the source template, not the wrapper message.

## Work Log

- 2026-11-09 (Pacific) Completed locally: RED regression committed as 34418fe50; canonical template and generated copies fixed in 33126fb3f. Planning/writer checks 27/27, additional writer/schema checks 68/68, release checks 81/81; typecheck, lint, generated freshness and diff audit pass. Actual CLI scaffold passes the unchanged structural validator. Shared completion check returns ok:true, including acceptance. Cross-agent code review aa9feb5e and verification review 0a0983f1 approve; authenticated phase stamps earned. This is structural template compatibility, not semantic approval or a full native journey. The wrapper-message limitation, original missing RED, all failed evidence and 33 deferred cases remain. No push, remote PR, merge, qualification or route change.

- 2026-11-10T05:39:56.004Z Started: Created ticket X5E2SG
