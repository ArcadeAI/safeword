---
id: TFNBXC
slug: verify-product-choice-authority
type: task
epic: 3TJD0A
phase: done
status: done
created: 2026-11-26T16:19:57.264Z
last_modified: 2026-11-26T18:24:06Z
---

# Catch unapproved product choices before feature intake closes

**Goal:** Help reviewers catch consequential choices the user has neither made nor delegated while preserving settled decisions.

**Why:** Both reviewers accepted the same crash policy with and without user authorization.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-26T16:19:57.264Z Started: Created ticket TFNBXC

## What happened

Both reviewers saw the same café waitlist plan. If the app crashes between announcing a party and saving its removal, the plan risks calling the party twice. The two review packets differed only in their dispatch ID and the user request. The first request delegated command names and storage. The second also explicitly chose the repeat-call risk. Both requests were available to the reviewers. Across three replays per reviewer, Claude and Codex approved all six unsupported choices and all six supported choices. This isolates a missed distinction in this fixture. The verdicts alone cannot establish the models’ reasoning.

The current Product Plan rubric already asks reviewers to trace consequential choices to the request, an accepted rule or explicit delegation. An earlier experiment made the blocking instruction more direct. Codex caught the omission in 3/3 trials and Claude in 0/3. [Previous experiment](../JPT08W-catch-unowned-choices/ticket.md)

## Decision to test

Try a single change inside the existing independent review. For a choice that changes what the user might lose, repeat or recover, have the reviewer identify the two outcomes and point to the user's words or a previously accepted decision that authorizes the selected outcome or delegates that specific choice. An author's proposed rule cannot establish its own acceptance. If the evidence is missing from the packet, recover the existing decision first. Ask the user one concrete question only if the choice remains open.

A stronger reminder costs little, but the previous run already exposed its host dependence. Requiring a receipt for every rule would make auditing easier and add work even for command names. Try the narrow evidence check first. Its main failure mode is citing real but irrelevant text, such as treating permission to choose storage as permission to choose who might lose their place. A second risk is reopening choices already settled in an accepted plan.

## Evaluation and adoption

1. Inspect one ordinary review dispatch on each host. Record exactly which user or previously accepted source reached the independent reviewer. The frozen replay explicitly included the request. If an ordinary dispatch drops it, evaluate supplying the existing source separately from changing reviewer instructions.
2. Keep the plan fixed. Test the café case, then a held-out CSV import where the plan saves valid rows after finding a bad row. Vary only the request in each domain. An omitted policy or delegation limited to naming should yield one focused finding. An explicit policy or delegation covering that recovery choice should yield approval. Keep the expected verdicts private from the reviewer. This use of controlled input changes follows [CheckList](https://aclanthology.org/2020.acl-main.442/).
3. Compare current and candidate reviewers on the same frozen packets, host model and budget, three repeats per case per host. Score a set only when both open cases get the correct finding and both settled cases pass without a redundant question. Require at least two complete sets out of three on each host in each domain. Report counts, unnecessary questions, extra reviewer calls and spend. If it misses the threshold, retain the current rubric and record the failure.

## Result

Retain the current rubric. The proposed change passed the adoption threshold only for Codex reviewing the café plan. It failed the other three host and feature combinations. All 108 reviews returned a verdict with confirmed model identity and metered spend. [Scorecard](./scorecard.md)

The opposite-policy and severity follow-ups also missed the adoption threshold. [180-review follow-up](./scorecard.md#follow-up-opposite-policy-and-verdict-severity).

The [author pilot](./scorecard.md#author-pilot-asking-before-writing-a-recovery-rule) found zero early questions in either arm. Retain the existing intake guide.

The [request-first reviewer experiment](./scorecard.md#request-first-reviewer-experiment) improved CSV results and still missed every open café choice. Retain the single-pass default.

The [single-pass interruption question](./scorecard.md#single-pass-interruption-and-retry-question) missed every open café choice. Retain the current rubric.

The [paired café plan reversal](./scorecard.md#café-plan-reversal) showed that reviewers blocked missing authorization much more often for removal before announcement.

The [neutral-wording follow-up](./scorecard.md#neutral-wording-of-the-café-request) reproduced the directional difference without “remove the called party.”

The [shipping-label comparison](./scorecard.md#shipping-label-recovery) recorded 48 reviews testing repeat charges and manual recovery.

The [delegated shipping trial](./scorecard.md#delegating-the-shipping-label-recovery-decision) found zero required requester approvals in 24 reviews and three actionable objections to silent repeat charges.

The [intake skill-routing pilot](./scorecard.md#choosing-a-skill-during-intake) checked the supplied, delegated, open, routine and handoff cases on both author hosts.

The [Claude resume-handbook comparison](./scorecard.md#reopening-the-intake-guide-on-resume) measured intake guide use, delegated decisions and open-choice questions separately.

The [telescope holdout](./scorecard.md#resuming-a-telescope-scheduling-feature) reproduced the resume-guide effect on a second feature.
