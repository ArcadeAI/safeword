# Disposition of the Harbor and intake experiments

Baseline: 6cf85049bfeeda9d168a5a2d44ea6ef773db5a22. No experimental code is recommended for porting. Two observed behaviors merit follow-up. The intake hook permitted production edits, and independent reviewers missed unsupported recovery choices. [Intake edit enforcement](https://github.com/ArcadeAI/safeword/issues/8559) · [Recovery choice review](https://github.com/ArcadeAI/safeword/issues/8558)

## Code and evidence decisions

| Group | Disposition |
| --- | --- |
| Harbor evaluation suite and infrastructure | **Shipped.** [#8436](https://github.com/ArcadeAI/safeword/pull/8436) shipped the reproducible suite, [#8538](https://github.com/ArcadeAI/safeword/pull/8538) preserved historical trials and receipts, and [#8550](https://github.com/ArcadeAI/safeword/pull/8550) grades the delivered extractor CLI separately from named commits. Retire older extractor graders and lockfiles as candidates. Preserve the original snapshots, verifier inputs and traces privately. |
| Primary product changes | **Shipped or superseded.** Relative to b4d635f57, the primary checkout had 53 unstaged tracked paths and zero staged paths. [#8398](https://github.com/ArcadeAI/safeword/pull/8398) carries the spec-only review, current receipt and same-ticket advance. Main uses the host-specific review command and requires independent review where configured. Both persona code spellings are accepted. The current handbook and discovery preserve early intake exit and grouped blockers and add choice-authority guidance. Retire the older source, mirrors, untracked handoff command and receipt helper. Keep the patches as evidence. |
| Answer key and routing fixtures | **Shipped.** Parsed JSON has identical contents for all 13 local answer groups and all six routing fixtures, including their prompts, starter and reference implementations, and assertions. Main adds five answer groups. |
| Intake cutoff script and tests | **Superseded.** From experiments/harbor, the same command, **python3 -m unittest test_intake_cutoff**, passed 8/8 on main and produced one failure and one error with only the untracked script substituted. The older code missed nested production assets and ticket scenarios and lacked the approval-order helper. |
| Compact workflow guidance and guard | **Preserve evidence and retire the candidates.** The KJ0DAN restoration matrix on codex/harbor-eval-suite records three early feature smoke trials that passed Gherkin without obtaining planning review. The disposable guard reached scenario review in one live trial and stopped on reviewer authentication and fallback failures. The current offline replay below confirms a gap and exposes limits in the candidate. |
| Lean guidance, starter templates and experimental review routes | **Shipped where selected.** The selected 65-line cut passed six author trials on three features. The broad cut had a premature implementation edit. The corrected starter templates passed eight handoffs. Five value-lab templates match main byte for byte. Main's sixth template adds first-interface registration. Retire the temporary TypeScript and fixture changes, and the earlier command, empty-interface and registry-reuse variants. [Lean scorecard](../../.project/tickets/3TJD0A-reliable-lean-intake/scorecard.md) · [Intake-only results](../../.project/tickets/3TJD0A-reliable-lean-intake/intake-only-results.md) |
| Resume, decision routing and reviewer variants | **Shipped where selected.** Claude read the guide before the decision in 12/12 candidate trials across two features. Codex passed the measured behaviors in both arms. Retire the two pre-promotion patches and the stronger ask-before-rule variant. It increased skill calls while both contemporary arms asked first in 3/3 open trials. The reviewer candidate found 12/24 open choices versus 1/24 under control, meeting the adoption criterion in one of four host/domain combinations. Retire the candidate and track the problem in #8558. [Choice authority scorecard](../../.project/tickets/TFNBXC-verify-product-choice-authority/scorecard.md) |

## Six original tickets

The original authored records are retained privately. The tracked scorecard and its CSV and receipt tables are the source for published controls. [Historical intake scorecard](intake/historical-intake-scorecard.md)

| Ticket | Finding and disposition |
| --- | --- |
| **TKSQXT**, assessment | Keep the original results.md, ticket and spec for the intermediate trial sequence. The historical scorecard preserves the fresh routes, queue clarification, frozen reviews, stale approval, first-scenario timing, description-only holdout, and candidate and parking grades. The later CSV follow-up used both hidden preferences correctly in 4/4 intake-only trials. The later parcel promotion passed 3/3 on each host after a surface-name fix, but two Codex plans still omitted the recipient detail. Keep workflow order and plan correctness separate. |
| **WYEP68**, setup | Keep the receipts. Both hosts opened the installed skill and guide. Wrong root and missing guide controls stopped before author launch. |
| **8FQ7MF**, routing | Fresh feature, bug and patch results shipped in the historical scorecard. Both hosts resumed the ticket. Codex reached 23 draft scenarios after correcting persona format. Claude stayed in intake after broader reviews. Both lack first-review spend. The original set lacked a linked-child routing control. Later child intake trials are documented in the lean evaluation. Treat the missing original control as a coverage limit. |
| **ZW8FBQ**, useful questions | Published queue controls show both hosts asked once when the overflow rule was open and implemented the saved answer. Claude first wrote a provisional rule. Both hosts reused the supplied rule without asking. All four trials left the Product Plan milestone unobserved. Keep the private timing and ordering evidence. |
| **76J82C**, Product Plan review | Published controls distinguish the complete, missing-rule and silent-drop plans. Intermediate replays identified all three current blockers together and main carries that rubric wording. Keep the six-round churn sequence privately. Recovery-choice reliability is tracked in #8558. |
| **9R9XBV**, reviewed handoff | First-scenario timing and stale receipt checks shipped. The intermediate Codex follow-up got current approval before a linked scenario and stopped in execution planning at the budget limit. CLI correctness was unmeasured. Claude passed hidden CLI checks but skipped the approved handoff. Keep those runs privately. The handoff mechanism shipped in [#8398](https://github.com/ArcadeAI/safeword/pull/8398). |

## Checkout dispositions

The private archive index records each absolute path, exact head, staged and unstaged patch, authored untracked file and selected ignored material. The eight intake arms share base 904e78010. All changed source templates match their corresponding historical arm revisions by content. Preserve the indexed patches for generated differences. Dependency links, caches, bytecode and build products can be recreated.

| Checkout ID | Distinct material and disposition |
| --- | --- |
| **primary** | Keep this checkout. It owns the shared Git directory and contains work outside this audit. Harbor patches, six tickets, authored files, ignored jobs and hidden fixtures were archived separately. One pre-existing dangling job link was preserved as a link. Its temporary target was already absent. |
| **harbor-infra** | Clean at f5963308a, branch point 733c38660. Its older infrastructure branch and ignored jobs and verifier inputs are retained privately. Remove after the three nested variant worktrees are removed. |
| **TFNBXC-ask-before-rule** | 17 unstaged paths at 4a51aef96. Two source templates contain the unselected stricter candidate. Retire. |
| **TFNBXC-resume-handbook** | 16 unstaged paths at a6dd9653b. Experimental handbook and discovery copies preceded promotion. Shipped. |
| **TFNBXC-skill-routing** | 11 unstaged paths at a6dd9653b. Experimental discovery guidance preceded promotion. Shipped. |
| **intake-3tjd0a-block** | 15 staged paths, stricter review wording, c564b21d2. Retire. |
| **intake-3tjd0a-combined** | 27 staged paths, broad cut, 12a51a678. Retire. |
| **intake-3tjd0a-guide** | 14 staged paths, discovery consolidation, a9e78db68. Retire as a standalone arm. |
| **intake-3tjd0a-handbook** | 11 staged paths, handbook recap cut, 09cbdfc83. Selected parts shipped. |
| **intake-3tjd0a-lean** | 31 staged paths, selected cut, c6b193776. Shipped. Private review receipts retained. |
| **intake-3tjd0a-map** | 13 staged paths, phase map cut, 51708d6b9. Selected parts shipped. |
| **intake-3tjd0a-narrow** | 14 staged paths, smaller discovery cut, 8a870ac97. Selected parts shipped. |
| **intake-3tjd0a-owner** | 15 staged paths, decision-owner review variant, 3c1eb5513. Retire. |
| **intake-value-lab** | 20 staged and six unstaged paths at 1cf7846f6. Corrected templates shipped. Retire the temporary dependency and generated differences. Private review receipts retained. |

The earlier closeout lists eight retired refs. The recovery bundle includes all eight, alongside the earlier manifest and saved-path archive. The thirteen experimental worktrees listed above can be removed with the owner's authorization after archive verification. The primary checkout stays in place.

## Production-edit guard replay

The same command, **scripts/dev node &lt;adapted-guard-probe.mjs&gt;**, ran the archived 91-case matrix against main and against a temporary plugin copy with the candidate's two additions. The adaptation changed fixture paths and called hook handlers directly. The result covers hook decisions, with the plugin dispatcher outside the comparison.

Main allowed all 12 named production-write attempts at intake. The candidate blocked 10/12 and missed both copy destinations. It also allowed both indirect-script controls. Across all phases, 26 decisions changed from allow to deny, six stayed denied and 59 stayed allowed. The candidate classified only two HTTP fixture filenames. Its narrow effect supports retiring the experiment. The bound-feature production edit still merits attention, with explicit controls for shell and unbound behavior. [Acceptance test in #8559](https://github.com/ArcadeAI/safeword/issues/8559)
