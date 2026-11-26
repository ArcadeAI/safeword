# Which reviewer caught the unapproved choice?

Keep the existing intake rubric. The candidate caught 12 of 24 open choices, up from 1 of 24. It passed the release criterion in one of four combinations. Catching a choice means a blocking finding specifically identified the unsupported recovery decision. An approval with a warning, or a rejection about some other issue, earns no credit.

| Reviewer and feature | Open choice caught, current → candidate (of 6) | Settled plan approved, current → candidate (of 6) | Complete sets passed, current → candidate (of 3) |
| --- | ---: | ---: | ---: |
| Claude, café | 0 → 0 | 6 → 6 | 0 → 0 |
| Codex, café | 0 → 6 | 6 → 6 | 0 → 3 |
| Claude, CSV | 1 → 4 | 6 → 5 | 0 → 0 |
| Codex, CSV | 0 → 2 | 1 → 1 | 0 → 0 |

A passing set requires the two open variants to block on the right issue, and the two settled variants to pass without asking again. Three repetitions per host and feature. The threshold was two passing sets out of three in **each** combination. One sample per domain and three repeats estimate behavior on these fixtures only.

## What reviewers actually saw

In the ordinary bookmark trial with Claude as author, the completed Codex review recorded the spec, explicit dimensions/personas/surfaces context, and resolved ticket, rules and project context. In the Codex-authored trial, the completed Claude review had the spec, no explicit extra context, and resolved ticket, rules, personas, principles and surfaces. Neither review recorded the original user message as an independent source. The author could restate the request in a ticket or spec. Reviewed dispatches: `3fe7c2c4-2faa-4c72-8ffe-1e0b3cda4150` and `63e5ecfa-394b-4061-beb5-9dc793681e1c`.

In the 96 main reviews, both reviewer variants received the same independently supplied user request and the same plan for each condition. The café plan chose a possible second announcement after a crash. The CSV plan chose to publish good names when a file includes invalid rows. Within each domain only the request changed: silent on this choice, delegated unrelated naming details, explicitly chose the outcome, or explicitly delegated that recovery choice.

Twelve additional controls removed the user request and used the current rubric. None blocked on the target choice. On the comparable silent-request cases with the user request included, the current rubric blocked on the target once in 12. Passing the request alone did little for these reviewers. With no request in the packet, the trials cannot distinguish an unrecorded agreement from a decision never made.

## Why the verdicts differed

One candidate Claude review argued that preserving the waitlist and keeping a failed save from changing the file justified repeating the announcement. Those requirements preserve data. They leave open what staff should hear on the next call. This shows how that verdict justified approval.

The CSV fixture also contained a real ambiguity. An unclosed quote can swallow later lines, so even a reviewer who knows to publish valid rows can still need a decision about which rows are recoverable. Several reviews also flagged the one-column header rule. We counted neither issue as finding the missing publication decision. No review of a settled case explicitly asked the user to choose the same publication or announcement policy again. One current-rubric warning asked about the adjacent all-invalid case. These were reviewer-only trials, with zero live user interactions.

## Experiment record

Used product revision `115c70586`. The only candidate instruction change replaced the existing source-tracing passage with this text:

> When outcomes differ in what someone loses, repeats, or recovers, identify both outcomes. Point to the user's words or a previously accepted decision choosing one or delegating that choice. Explain how the words cover this outcome. The proposed plan cannot authorize itself. If the supporting source is absent, request the existing decision first. Ask one focused question only if it is open.

Each isolated container used the existing headless reviewer and a $3 individual cap. Confirmed models were `claude-opus-5-5` and `gpt-6.2-sol`. Current and candidate shared packet contents, per-case dispatch ID, model and pricing snapshot, with variant-specific contract fingerprints. Conditions were interleaved. The reviewer's inputs excluded scores and expected verdicts.

| Metered calls | Claude | Codex | Estimated USD |
| --- | ---: | ---: | ---: |
| Current rubric, request included | 24 | 24 | 3.06 |
| Candidate rubric, request included | 24 | 24 | 2.80 |
| Current rubric, request withheld | 6 | 6 | 0.77 |
| **Total** | **54** | **54** | **6.64** |

Totals use unrounded amounts. Each trial made one reviewer call. No retries, additional review rounds or draft PRs. Costs are token-price estimates for local-account usage. Private frozen packets, reviewer bundles, verdicts, usage ledgers and scores are under `experiments/harbor/jobs/TFNBXC/` in the Harbor infrastructure worktree.

For a follow-up, try asking the reviewer whether the opposite recovery policy could also satisfy the user's words. The café case exposes that exact inference error. Freeze a new CSV fixture that explicitly defines malformed quoting and header width before reusing CSV for an adoption decision.

## Follow-up: opposite policy and verdict severity

**Decision. Keep the current rubric.** Asking whether the opposite policy could also satisfy the request caught all 12 open CSV choices and only one of 12 open café choices. A stricter verdict sentence caught two of 24 open choices across the two features. Neither met the threshold of two complete sets out of three for each host and feature.

| Variant (60 reviews each) | Open café choice blocked, of 12 | Open CSV choice blocked, of 12 | Matching or delegated plan approved, of 24 | Explicit contradiction corrected, of 12 | Estimated USD |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current | 0 | 6 | 24 | 12 | 3.36 |
| Opposite-policy question | 1 | 12 | 24 | 12 | 3.37 |
| Verdict severity | 0 | 2 | 23 | 12 | 3.39 |

| Host and feature | Complete sets, current | Complete sets, opposite policy | Complete sets, verdict severity |
| --- | ---: | ---: | ---: |
| Claude, café | 0/3 | 0/3 | 0/3 |
| Codex, café | 0/3 | 0/3 | 0/3 |
| Claude, CSV | 0/3 | 3/3 | 0/3 |
| Codex, CSV | 1/3 | 3/3 | 0/3 |

The two variants independently added the following text immediately before the existing approval instruction:

- Opposite policy: “Could the opposite policy also satisfy the user's words? If both fit, the difference materially affects the user, and the user has not delegated this choice, flag the unresolved decision.”
- Verdict severity: “If your finding says the user still needs to choose between materially different outcomes, return request_changes.”

We fixed CSV parsing, header width, failure handling and all-invalid behavior in both the request and plan before testing. Only mixed-file publication was at issue. Each feature used the same plan across five requests: silent, delegation limited to naming, explicit agreement, explicit delegation of that policy, and explicit disagreement. Each set required both open choices to block on the exact issue, both settled plans to pass and the conflicting plan to be corrected without reopening the decision. We inspected the finding text. For example, blocking the café plan on terminal output buffering earned no credit for the crash policy.

Both reviewers could follow a stated choice against the plan. No settled policy needed a repeat question in these reviews. On an open café case, Claude still approved under the stricter verdict instruction and suggested the user could confirm the repeat call during scenario review. The one settled plan rejected under that instruction concerned output buffering. These verdicts measure reviewer behavior only. No operator was interrupted.

Product revision `cfb2022e9`. Claude Opus 5.5 (`claude-opus-5-5`) and Codex (`gpt-6.2-sol`) reviewed isolated, matched packets in interleaved order. Confirmed model identity, dispatch identity and one metered invocation per verdict for all 180 reviews. Total estimated spend was **$10.12**, with zero retries. The private inputs, bundles, frozen protocol, findings, per-trial scores and usage are in the Harbor infrastructure worktree under `experiments/harbor/jobs/TFNBXC-forks/`. The repaired CSV results have their own concurrent baseline. Counts from the earlier CSV fixture are not pooled with these.

Next experiment: ask the intake author to surface consequential choices before writing the plan, leaving the reviewer unchanged. Measure whether the author asks once when the policy is open and proceeds without asking when it is settled. These two exposed domains remain regression cases.

## Author pilot: asking before writing a recovery rule

Keep the current intake guide. In 12 independent café trials, neither author asked before drafting a crash policy when the instruction left that choice open. The extra instruction reached both authors: all six candidate tool traces contain the new text in the returned intake guide. Both variants honored the supplied answer and exercised explicit delegation without asking again.

| Author behavior | Current guide | Candidate guide |
| --- | ---: | ---: |
| Asked before drafting when the choice was open | 0/2 | 0/2 |
| Asked only after drafting and independent review | 1/2 | 0/2 |
| Honored the supplied announce-first choice without reopening it | 2/2 | 2/2 |
| Chose a crash policy without asking when the decision was delegated | 2/2 | 2/2 |
| Passed independent review and advanced to scenario definition | 6/6 | 6/6 |
| Author and reviewer estimated spend | $4.42 | $3.86 |

The open candidate Claude run chose to save the removed party as “last called” and show it in the list. The open candidate Codex run required changes to be saved before reporting success, including a failed save producing no call announcement. Both plans passed. On the baseline, Codex selected removal before reporting. Claude asked only after its reviewer objected to the draft. It offered two remove-first options. The operator had already chosen announce-first, so the coordinator returned the saved answer. Claude incorporated it in the approved plan. The relay recorded one routed question, zero repeat questions and zero new user interruptions.

Each host (Claude Opus 5.5 and Codex GPT-6.2 Sol) authored one fresh plan per guide and request. The other host reviewed it under the existing reviewer rubric. The three requests used the same café feature with crash policy omitted, explicitly supplied, or explicitly delegated. The host-only answer key supplied the saved policy only when needed. The pilot tested this single regression case once per combination. It does not estimate a cross-project effect.

The candidate inserted this text at the start of the first intake step:

> Before drafting a Rule, identify any point where two reasonable choices leave the user with materially different outcomes. If the request or an accepted decision settles that choice, carry it forward. If the user delegated that choice, make it. Otherwise ask one question naming the two outcomes and wait for the answer before writing either into the plan.

Baseline `f1ea8ab00`, experimental bundle `5c7f0bea3`. Each trial had an isolated workspace, the same pinned models, a $3 author-plus-reviewer cap, and the same reviewer rubric digest. Approval receipts were checked against the saved plans. Total metered estimate was **$8.30**, including $0.0184 for relay classification. Private protocols, instructions, transcripts, plans, receipts and scores are under `experiments/harbor/jobs/TFNBXC-author/` in the Harbor infrastructure worktree. No draft PRs were observed.

The next distinct hypothesis is to give a reviewer the request first and record which recovery choices it considers open before showing it the author's plan. Blind that first pass to the author's proposed answer and score both omission and explicit delegation.

## Request-first reviewer experiment

**Keep one review pass as the default.** From the request alone, reviewers found the unresolved CSV publication choice in 12/12 trials. They found the unresolved café announcement/removal choice in 0/12. The second pass reproduced that split exactly. Seeing the draft first therefore cannot fully explain these café misses. A crash that corrupts the queue file and an interruption after staff hear a name but before removal is saved are distinct failures. Several inventories discussed only the former or raised unrelated questions such as undoing a mistaken call.

| Reviewer and feature | Exact open choice blocked, current → request-first (of 6) | Matching or delegated plan approved (of 6) | Contradictory plan corrected (of 3) | Complete sets (of 3) |
| --- | ---: | ---: | ---: | ---: |
| Claude, café | 0 → 0 | 6 → 6 | 3 → 3 | 0 → 0 |
| Codex, café | 0 → 0 | 5 → 6 | 3 → 3 | 0 → 0 |
| Claude, CSV | 0 → 6 | 6 → 6 | 3 → 3 | 0 → 3 |
| Codex, CSV | 3 → 6 | 6 → 6 | 3 → 3 | 0 → 3 |

Neither host met the two-of-three-set threshold on the café. The inventories correctly identified explicit delegation in 12/12 delegated trials. All 24 matching or delegated plans passed the two-pass review without reopening the target choice. One approval suggested confirming an adjacent detail about warning staff that a repeat announcement might be occurring. No question was sent to a user.

### How the comparison worked

We reused the frozen café and repaired CSV packets, image, models and prices from the opposite-policy experiment. For each host and feature we varied only the user instruction across five conditions: silent about the decision, delegated naming only, explicitly chose the plan's policy, delegated the exact choice, or explicitly chose the opposite. Three repeats per condition. The 60 new single-pass controls and 60 two-pass trials were interleaved.

Before seeing the plan, the same pinned model read only the user request and listed consequential recovery choices under Chosen, Delegated and Open. A fresh container ran the unchanged Safeword reviewer over the full original packet plus the exact first-pass summary, marked as reviewer notes. The first process had no mounted plan, answer key or expectations. We checked source content, review packet parity, exact note transfer, confirmed models and usage ledgers. Scores reflect the target issue in the actual finding text. An unrelated blocking finding earns no credit. The experiment measures this whole two-pass treatment; it does not isolate ordering from the additional model call and instructions.

| Calls | Count | Estimated spend |
| --- | ---: | ---: |
| Single-pass controls | 60 | $2.42 |
| Request-first inventories and final reviews | 120 | $7.33 |
| Excluded setup and retry calls | 18 | $0.79 |
| **Total** | **198** | **$10.54** |

Sixteen early inventories used a runtime path without the required confirmed-model receipt. We repeated them using the planning-review runtime before scoring. Two additional metered retry inventories were excluded after output collection failed. The reported 120 final verdicts all have verified model and dispatch identity. Runs used Claude Opus 5.5 and Codex GPT-6.2 Sol, with a $3 cap per scored trial. Private inputs, inventories, verdicts, metering, exclusions and scores are in `experiments/harbor/jobs/TFNBXC-request-first/` in the Harbor infrastructure worktree.

A smaller next experiment would ask for one concrete interruption between a visible action and a saved change. Test whether that surfaces the actual user decision in both the café and an unseen two-step feature, while preserving explicit choices and delegation.

## Single-pass interruption and retry question

**Keep the current rubric.** The addition was one sentence: “What could the user already have seen or heard when the operation stops, and what happens if they retry?” It changed neither host's café result. In one candidate approval, Claude explicitly identified the tradeoff as “possible double call, never a silently lost party” and justified it because it protected the existing work. The request had never authorized that preference. This verdict demonstrates that recognizing the consequence can still end in approval.

The fresh feature was a pottery studio label station. The printer can produce a physical label before the station learns the outcome. The plan forbids resending an uncertain print, even when this leaves a box unlabeled. This chooses the reverse risk from the café plan, which permits a repeat announcement. We ran contemporaneous baseline and candidate reviews in isolated containers. Three repetitions per host, condition and variant. The questions, grader and expected outcomes stayed out of the fixtures.

| Primary test | Open choice correctly blocked, current → candidate (of 6) | Matching or delegated plan approved (of 6) | Contradiction corrected (of 3) | Complete sets (of 3) |
| --- | ---: | ---: | ---: | ---: |
| Claude, café | 0 → 0 | 6 → 6 | 3 → 3 | 0 → 0 |
| Codex, café | 0 → 0 | 5 → 6 | 3 → 3 | 0 → 0 |
| Claude, label station | 3 → 4 | 3 → 1 | 3 → 3 | 0 → 0 |
| Codex, label station | 6 → 6 | 0 → 0 | 3 → 3 | 0 → 0 |

The five conditions were an omitted policy, delegation restricted to naming/storage, an explicit matching policy, delegation of the exact recovery choice, and an explicitly conflicting policy. Each passing set required both open choices to block on missing authority, both settled plans to pass without a redundant question, and the contradiction to be corrected without asking again. Neither arm reached the two-of-three threshold on any primary host/feature combination. Most rejected settled label plans raised a separate problem with saving an explicit printer rejection and preserving the promised retry. An optional recommendation in one baseline review suggested reconfirming a delegated risk. There were no live user questions.

### Separating the label station's storage failure

After observing that adjacent finding, we ran 60 additional reviews with the same five controls and reviewer wording. Both arms received the same clarified fixture: local writes succeed, and recording and reporting a definitive printer reply cannot be interrupted. A job can still print without its reply reaching the station. We report this follow-up separately because the fixture was edited after inspection.

| Clarified label station | Open choice correctly blocked (of 6) | Matching or delegated plan approved (of 6) | Contradiction corrected (of 3) | Complete sets (of 3) |
| --- | ---: | ---: | ---: | ---: |
| Claude, current → candidate | 6 → 6 | 6 → 6 | 3 → 3 | 3 → 3 |
| Codex, current → candidate | 5 → 6 | 2 → 3 | 3 → 3 | 0 → 0 |

Some Codex findings distinguished what happens to the original submission when the printer reply never arrives from what happens on a later retry. A finding only about the original submission earned no credit for catching the unsupported retry policy. Counts from the two label fixtures are not pooled.

The 120 primary verdicts and 60 follow-up verdicts have confirmed model and dispatch identities. Product base `1d88d7098`; pinned reviewers Claude Opus 5.5 and GPT-6.2 Sol; $3 per-review cap. One follow-up call timed out and its replacement completed. Metered estimates sum to **$11.00** for 179 completed calls. The timed-out call and one completed primary Codex verdict lack final usage receipts, so total spend is unknown. We retained the valid Codex verdict. The private frozen packets, rubric variants, blinded finding annotations, receipts and per-trial results are in `experiments/harbor/jobs/TFNBXC-interruption/` in the Harbor infrastructure worktree.

A diagnostic follow-up would keep the café request silent and reverse only the draft's recovery rule. If reviewers block one direction but approve the other, that supports testing whether they treat their own preferred default as user authorization.

## Café plan reversal

The current reviewers treated the two crash policies differently. When the request left the decision open, they blocked the plan on missing user authorization **0/12** times for announcing first and **9/12** for removing first. These counts combine the silent request and the request delegating only command names and storage. In the strictly silent subset the rates were **0/6** and **4/6**.

| Reason for a block | Announce first | Remove first |
| --- | ---: | ---: |
| Claude identified missing authorization for the crash choice | 0/6 | 3/6 |
| Codex identified missing authorization for the crash choice | 0/6 | 6/6 |

On the open cases, ten announce-first plans were approved, and two were blocked for other issues. Three remove-first plans were approved, including two that recommended asking the user. A warning that allows work to proceed earns no blocking credit. The two unrelated announce-first objections concerned durability after a machine reset and retrying after both the announcement and removal had already completed.

**Controls.** Reviewers flagged all 12 plans that contradicted an explicit user choice, in both directions. Eleven of the 12 plans matching the user's choice were approved. Ten of 12 plans with explicitly delegated crash policy were approved. The other three blocks across those two controls concerned the exit status if terminal output failed. They did not ask the user to choose a crash policy again.

**Interpretation.** Announce-first risks calling the same party twice. Remove-first risks staff never hearing the name of someone already removed. Several remove-first findings cited the user's phrase “remove the called party” and the absence of a way to recover a skipped party. This demonstrates sensitivity to which outcome the plan chooses in this fixture. It does not distinguish a general preference for protecting against loss from a reasonable reading of this particular request. A follow-up could vary only the wording that implies a sequence and repeat the paired comparison.

**Method.** Base `410355a5d`, current single-pass rubric, pinned Claude Opus 5.5 and Codex GPT-6.2 Sol. For this matched pair, shared inventory and cross-references were made neutral in both drafts. The serialized spec files then differed by exactly one line, Rule R3, which described the two orders and their respective failure and retry outcomes. The surrounding ticket, request and other packet context were identical within each pair. Each model received each plan in isolation for three repeats under five request conditions. Scoring used the finding text and distinguished an authority objection from an implementation issue. This was a diagnostic on one feature without a production prompt change.

All 60 scored verdicts have matching dispatch and model identity. Measured spend was **$3.56** across 59 verdicts. One additional completed verdict and one timed-out attempt lacked final cost receipts. The timeout was retried. Private frozen packets, condition definitions, receipt logs and verdict annotations are under `experiments/harbor/jobs/TFNBXC-policy-reversal/` in the Harbor infrastructure worktree.

## Neutral wording of the café request

**The direction of the proposed policy still mattered when the user described only success.** On the two neutral phrasings combined, reviewers required authorization for risking a missed party in **11/12** trials and for risking a repeat call in **1/12**. Codex flagged the repeat-call risk once. Claude approved one remove-first plan on the grounds that it achieved the requested successful outcome. The original phrase “remove the called party” was unnecessary for the observed asymmetry.

| Request wording in the concurrent comparison | Missing-authorization blocks when announcing first | Missing-authorization blocks when removing first |
| --- | ---: | ---: |
| Original request, including “remove the called party” | 0/6 | 6/6 |
| Successful outcome, name received listed first | 0/6 | 6/6 |
| Same successful outcome, party absent listed first | 1/6 | 5/6 |

The neutral variants described the same state at the end of a successful call: staff have received the earliest waiting party's name and that party is absent from the saved list. We counterbalanced which outcome was mentioned first. None of the three requests chose a crash policy. The ticket and shared spec restatements used neutral language in all three conditions. For each wording, only Rule R3 differed between the two plans. For each plan, only the user request changed across the three wordings. This concurrent comparison is separate from the prior reversal trial.

The score counts a blocking finding on user authority for the specific missed-party versus repeat-call choice. An objection about output delivery or what happens after both steps finish did not count. On the neutral inputs, the host totals were 0/6 announce-first and 5/6 remove-first for Claude, and 1/6 and 6/6 respectively for Codex.

All 36 reviews completed with verified dispatch and model identities, one metered call each and **$2.49** in estimated spend. No retries or live questions. Base `eaf29f312`, unchanged production reviewer, pinned Claude Opus 5.5 and Codex GPT-6.2 Sol. Private packets, protocol, findings and per-trial scores are in `experiments/harbor/jobs/TFNBXC-neutral-order/` in the Harbor infrastructure worktree.

This is one feature with three repeats per model and cell. It supports a café-specific directional effect. It cannot identify the reviewers' motivations or show how they would respond when repeating an action does more harm. A useful next comparison would reverse the relative consequences in a new feature while leaving the user's retry preference unspecified.

## Shipping-label recovery

A clerk wants a parcel to have a paid shipping label and a closed local request. A workstation restart can separate the carrier purchase from the local update. Buying first can charge another nonrefundable $12 on retry. Closing first can leave postage unpaid, which the clerk can check and buy manually in the carrier portal. The request specified the successful outcome and left the crash policy open. Each pair of drafts differed only in the rule selecting the policy.

| Reviews that blocked on missing user authorization | Claude, buy first | Claude, close first | Codex, buy first | Codex, close first |
| --- | ---: | ---: | ---: | ---: |
| Original shipping fixture | 6/6 | 0/6 | 6/6 | 5/6 |
| Clarified shipping fixture | 6/6 | 0/6 | 6/6 | 6/6 |

The original fixture left room for a separate objection about what happens if the carrier rejects payment. All 24 initial reviews requested changes, including six Claude close-first verdicts that raised other issues. For the follow-up we gave both arms the same workstation guarantee for definitive rejections, clarified the already-closed exit status, and aligned the persona summary with the restart rule. We scored that follow-up separately. Claude approved all six clarified close-first drafts. Four included a nonblocking suggestion to confirm or record acceptance of the manual recovery burden. Codex required a user decision in all six.

On neutral café requests, Claude blocked 0/6 plans risking a duplicate announcement and 5/6 risking a missed party. Here it blocked 6/6 risking a duplicate charge and 0/6 risking a missed, manually recoverable purchase. Codex also changed its response to duplicates from 1/6 to 6/6, while continuing to flag the missed-action plan. These are repeated reviews of two particular features. The comparison changes domain, financial stakes and recoverability together, so it cannot isolate price as the cause.

Each shipping fixture used two equivalent order-balanced requests, three repeats per host, the same pinned Opus 5.5 and GPT-6.2 Sol, and the unchanged production reviewer at product base `adda65a5d`. Matched files were checked before dispatch. All 48 completed verdicts have matching model and dispatch identities and individual cost receipts. No retries or live user questions. Estimated spend was **$3.17** across both sets. The score counts only blocking findings that identified missing authority for the specified restart policy. Private packets, findings and coding are in `experiments/harbor/jobs/TFNBXC-shipping-order/` and `TFNBXC-shipping-clarified/`.

A narrow next test would keep the clarified shipping fixture fixed and explicitly delegate the recovery decision to the agent. Check whether each reviewer accepts either documented choice or continues to demand user input.

## Delegating the shipping-label recovery decision

Adding “You choose how the CLI recovers after an interruption.” moved approvals from 6/24 in the previous clarified shipping comparison to 21/24. None of the 24 delegated reviews required the requester to ratify the policy. Four Claude approvals still suggested checking that the user accepted a possible duplicate charge. These were nonblocking suggestions in the verdict text. No live question was sent.

| Plan | Claude approvals, earlier → delegated | Codex approvals, earlier → delegated |
| --- | ---: | ---: |
| Buy first, ordinary retry can charge another $12 | 0/6 → 5/6 | 0/6 → 4/6 |
| Close first, clerk can recover missing postage manually | 6/6 → 6/6 | 0/6 → 6/6 |

The three requests for changes all concerned an ordinary retry silently spending another $12. Each acknowledged delegated recovery and asked the author to change what the clerk sees or controls before another charge. One Codex verdict also asked how to finish a paid but still-open local request. These were product design objections the author could act on independently. Treating every request for changes as an escalation to the requester would miscount all three.

The only change to the logical plan and context files was the delegation sentence appended to each user request. We reused the byte-identical reviewer bundle, container image, model pins, and per-review spend cap from the clarified comparison. Two order-balanced wordings, three fresh isolated reviews per wording, policy and host. The undelegated results are historical controls. All 24 verdicts matched their dispatch and pinned reviewer and had individual usage receipts. Estimated spend was **$1.55**. Private fixtures, protocol, raw findings, annotations and scores are in `experiments/harbor/jobs/TFNBXC-shipping-delegated/`.

For this fixture, score requester approval, optional suggestions, and changes to the clerk-facing design separately. A reviewer can respect delegated authority and still find a problem with how an ordinary retry spends money.

## Choosing a skill during intake

**Keep the candidate experimental.** The proposed intake paragraph tells the author to apply a supplied rule, choose a routine delegated detail directly, use `figure-it-out` for a delegated decision with material consequences, and use `elicit` when a consequential choice depends on the user's preference. An isolated worktree generated the two native plugins from the same source change at base `a6dd9653b`. No live user prompt named a skill.

| Request at the remaining shipping-desk decision | Claude Opus 5.5 | Codex GPT-6.2 Sol |
| --- | --- | --- |
| Never charge twice | Recorded the constraint directly | Recorded the constraint directly |
| You choose the recovery policy | Chose close-first and explained why, without loading the skill | Loaded `figure-it-out`, chose close-first and explained why |
| You choose the command name | Chose `ship <parcel-id>` directly | Chose `shipping-desk <parcel-id>` directly |
| Recovery preference open | Chose and wrote a rule without asking | Loaded `figure-it-out` and wrote a rule without asking |
| Same open request, with delegation queued if asked | Wrote a rule before asking | Wrote a rule before asking |
| Follow-up: neutral open request, “the plan still has an open item” | Asked the recovery question directly | Loaded `elicit` and asked the recovery question |
| Follow-up: clerk explicitly wants to discuss and decide, then replies “you choose” | Asked before editing and wrote a reasoned rule after the reply. No target skill observed | Asked before editing, then loaded `figure-it-out` and wrote a reasoned rule. No `elicit` load observed |

The original open and handoff requests were identical before the first reply. Their shared introduction included “settle the remaining point,” which could be read as permission to choose. In neither handoff lane was the queued delegation delivered. In the explicit-discussion follow-up both authors asked one recovery question, left the spec byte-identical until the reply, and then chose without asking again. Claude recommended clerk verification before every purchase; Codex chose portal verification for uncertain purchases. The two skills were available in both plugin bundles. Claude went from the startup handbook to the project files and bypassed the intake guide on the primary trials. Codex read the guide and still sometimes treated an open decision as delegated.

The neutral follow-up removed “settle” and described an open item. Both authors asked the clerk a recovery question before changing the plan. Codex opened the actual `elicit/SKILL.md` file. Claude asked directly; its explanation also incorrectly said only purchase-first preserves retry after a rejection, although the fixture guarantees an open request on definitive rejection. These single runs establish which behaviors occurred and motivate a controlled repeat.

Score the observable choice and the skill load separately. On Claude, look for a successful Skill call or a direct read of the skill. On Codex, inspect the command and its returned skill contents; seeing a path in a directory listing earns no credit. For the handoff, compare the plan snapshot taken before the relay with the original and the final rule. Clerk confirmations inside a proposed product design are distinct from questions sent to the requester.

The 14 scored author runs cost an estimated $2.42. Ten excluded launches used a macOS-generated tar archive containing AppleDouble files that tripped Claude's plugin integrity check. Those cost $1.31, bringing total metered spend to **$3.73**. The corrected archive was identical across the three scored sets. All runs used isolated Harbor containers, native account authentication and a $3 per-trial budget. Snapshots covered the intake decision only. No draft PRs appeared in the traces. Each private job directory under `experiments/harbor/jobs/TFNBXC-skill-routing*` retains its native transcripts, relay messages, plan snapshots and activity report. The clean job also retains `routing.patch`.

First test whether one sentence in the startup handbook brings resumed intake tickets back through the BDD intake guide on Claude. Repeat the open and delegated cases using a neutral shared introduction, and grade both the question and the actual skill load.

## Reopening the intake guide on resume

One startup-handbook sentence increased observed guide use from **1/6 to 6/6** on resumed shipping-desk tickets with Claude Opus 5.5. Both arms contained the same experimental intake routing paragraph. The candidate appended this sentence to the existing resume instruction:

> When resuming a feature ticket in intake, invoke the native `safeword:bdd` skill and open its `DISCOVERY.md` guide before asking a product question or editing the plan.

| Observed in the original 12 trials | Earlier handbook | Candidate |
| --- | ---: | ---: |
| Successfully loaded BDD and read intake guidance before the question or plan edit | 1/6 | 6/6 |
| Called `figure-it-out` when the user delegated recovery | 0/3 | 3/3 |
| Wrote a reasoned recovery rule when delegated | 3/3 | 3/3 |
| Called `elicit` when the user left recovery open | 0/3 | 1/3 |
| Left the open plan untouched pending a reply | 2/3 | 2/3 |

The candidate's three open cases ended differently. One used `elicit` and asked the requester to choose among recovery outcomes. Another recommended a saved purchase marker and asked whether the new marker and clerk confirmation fit the scope, leaving the file alone. The third wrote a draft rule first and then asked who should buy missing postage. Opening the guide made delegated skill use more consistent in this sample. It did not improve the count of open plans preserved before a reply.

Each arm ran three isolated repeats of each case. The neutral prompt was identical across arms. The delegated case added only “You choose how the CLI recovers after an interruption.” The runner ended at the first decision checkpoint. Scoring used successful native tool results, their order, the final author message and the actual spec bytes. The source revision and intake variant match the preceding author pilot. Comparing the two bundle inventories found only the handbook copies and Claude's corresponding integrity manifests changed. There were no draft PRs or live operator questions. This was a single-feature author-routing experiment.

Two candidate delegated traces ended with successful Opus author messages and recorded plans, but Harbor flagged the terminal usage receipt because it also listed Haiku with one web-search request. The flags were unrelated to the $3 budget. We retained those observations in their original cells and ran two separate replacements. Both replacements passed the model check, read the guide, used `figure-it-out` and recorded a decision. Substituting them yields the same table. Native terminal receipts totaled **$3.36** for the 12 original trials and **$0.66** for the two replacements, **$4.03** overall. Using terminal receipts avoids undercounting the flagged calls. Private bundles, exact prompts, `handbook.patch`, traces and activity reports are in `experiments/harbor/jobs/TFNBXC-resume-handbook/`.

Retain the sentence as a candidate for a fresh feature. For open choices, measure whether the author presents the real tradeoff before writing a rule as well as whether it invokes the skill.

## Resuming a telescope scheduling feature

**Keep the resume sentence for reliably loading the intake guide on Claude.** We reused the exact two plugin bundles from the shipping comparison. The new ticket asked who gets the club telescope when more than one member requests the same night. Both timestamp priority and a draw were feasible. Each bundle ran three trials with the choice open and three with one added sentence delegating it. The prompt never named a skill.

| Behavior observed before the first decision checkpoint | Earlier handbook | With resume sentence |
| --- | ---: | ---: |
| Read the intake guide before asking or editing | 2/6 | 6/6 |
| Read the paragraph on delegation and user preferences | 1/6 | 6/6 |
| Invoked `figure-it-out` for a delegated choice | 1/3 | 3/3 |
| Wrote a reasoned allocation rule when delegated | 3/3 | 3/3 |
| Asked about a draw versus timestamp priority before changing an open plan | 3/3 | 3/3 |
| Invoked `elicit` on an open choice | 0/3 | 0/3 |

All six delegated plans chose a draw at publication and explained that a week-long window would otherwise reward people who could submit early. All six open trials put that tradeoff to the requester and left the original spec intact. One control read a later section of the guide without seeing the routing paragraph. The table counts that access separately so it earns credit for opening the guide. The sample shows more consistent use of the intended skills on delegated decisions. The observed allocation decision and clarification behavior were the same in both arms. The shipping case had one premature edit in each arm, so the telescope result does not resolve that earlier issue.

All 12 isolated Harbor runs produced a final Opus 5.5 author message and a plan snapshot. Four runs that used web search (one control and three candidate) tripped Harbor's single-model check at completion: Opus authored every message and the native usage receipts assigned search requests to Haiku. We retained those runs under the protocol fixed before launch. There were no retries, draft PRs, independent reviews or live operator questions. The trial stopped at the first decision. Estimated spend from native receipts was **$1.25** for the control and **$1.78** for the candidate, **$3.04** combined before rounding. Private prompts, seeds, bundle hashes, tool and skill traces, replies, plan snapshots and grades are under `experiments/harbor/jobs/TFNBXC-telescope-resume/`.

Across shipping and telescope, the candidate reached the guide before the decision in 12/12 original trials. This supports adopting the sentence for resumed Claude intake tickets. Future open-choice tests should score whether the question resolves the user's preference before a rule is written. A native `elicit` call is a separate measurement.

## Codex on both handbook versions

This matched comparison used GPT-6.2 Sol through the local Codex account. Both arms included the same intake paragraph for distinguishing delegated choices from open preferences. Only the candidate had the additional handbook sentence for resuming intake. The shipping and telescope fixtures, prompts, seeds, frozen plugin bundles, first-decision cutoff and $3 cap were the same as in the Claude comparisons. Each feature had three repeats per handbook and prompt.

The open shipping case asks whether a clerk should use the carrier portal or take on the risk of a duplicate purchase. The telescope case asks whether submission time or a draw decides a contested night. We checked the actual question and the spec snapshot in each open case. In delegated cases, the user added one sentence assigning the decision to the author. We checked for a written decision with reasons and for any question handing the choice back.

| Codex outcome across both features | Earlier handbook | With resume sentence |
| --- | ---: | ---: |
| Read the intake guide and the routing paragraph before asking or editing | 12/12 | 12/12 |
| Used `figure-it-out` and recorded a reasoned decision when delegated | 6/6 | 6/6 |
| Used `elicit` and asked the relevant question before changing an open plan | 6/6 | 6/6 |

Within each feature and each handbook, guide reads were 6/6, delegated decisions were 3/3 and open questions were 3/3. Codex loaded skills by reading their native `SKILL.md` files. We checked the actual tool output and event order. Every open spec matched its original bytes and no open run recorded a file edit. All delegated plans documented a policy and its rationale. Every telescope plan selected an equal-chance draw; shipping plans varied in how the clerk recovered from an uncertain purchase. These fixtures showed no measurable routing gain or regression for Codex. The earlier handbook was already at ceiling on these particular prompts; the ambiguous “settle the remaining point” prompt was outside this comparison.

All 24 scored trials had completed turns, expected model and bundle receipts, and individual cost records. Twelve other launches ended in workspace-routing failure during a network interruption, with no assistant message, completed turn or spend receipt. One telescope replacement produced a decision but stopped on unpriced usage before emitting a completed turn. A fresh trial replaced it. Estimated cost was **$2.39** for the scored set ($1.24 earlier, $1.14 candidate, rounded separately). The interrupted metered attempt recorded a partial **$0.16**, bringing the recorded estimate across attempts to **$2.55**; exact spend across all attempts is unavailable. No trial created an observed draft PR, reached independent review or needed a live operator reply. Private native traces, grading, plans, exclusions and activity reports live in `experiments/harbor/jobs/TFNBXC-codex-resume-comparison/`.
