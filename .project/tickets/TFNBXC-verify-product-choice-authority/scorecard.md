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
