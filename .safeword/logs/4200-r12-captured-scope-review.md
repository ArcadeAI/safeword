# R12 captured scope-context characterization

Review only these test/evaluation changes. Production review policy, models,
qualification evidence, and accepted scope are unchanged. The six R12 examples
now prepare actual private child/parent tickets, Product Plan, Implementation
Plan and scenarios through prepareReviewPacket. All nine required dependency
roles resolve to captured files whose bytes equal the actual source bytes.
Each negative replaces exactly one semantic binding field with a missing-content
marker while retaining the role and path; the positive retains all five fields.

The existing evaluation runner accepts a captured context and reviewed plan for
one named, fixed case. Only those two input fields can be overridden. Expected
verdict, finding authority, calibration, model pins and scoring stay fixed.
Every result hashes its actual input; root assertions compare that hash with the
selected snapshot. Reviewer prompts do not contain expected verdicts. The judge
sees the existing expected authority. No installed host gate proof is claimed.

The initial complete-context control failed while the missing-project case
passed. Retained report /var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-planning-eval-EnQt5r/result.json
showed real confounds: a CLI surface without CLI wiring proof, existing/new
endpoint contradiction, and vague recovery. The R12-specific common plan now
provides explicit CLI proof, consent failure/recovery, existing-endpoint rollback
and confidence limits. Expected verdicts and the canonical rubric were preserved.

/tmp/4200-r12-complete-context-repaired.json records the corrected positive
control passing (one scenario, 57 steps). The five negatives are running against
these frozen bytes in /tmp/4200-r12-missing-context-repaired.json. Manifest unit
checks pass 2/2 and all three package typechecks pass. OpenCode/cloud stay deferred;
historical full acceptance failures and remaining unbound examples remain open.

Challenge whether missing semantic content is isolated, actual captured packet
bytes reach the semantic reviewer, result binding prevents unrelated-case proof,
and the fixture remains narrow and honest. Do not broaden into unrelated route
or host proof. Identify actual correctness defects rather than optional hardening.

Review e4768eec-eeed-46f4-927c-ebe98b438b68 correctly rejected the first proof:
the fixed reviewer_boundary leaked which source was omitted, and assertions
examined the fixture boundary rather than captured contents. That five-negative
run was explicitly stopped (exit 143); it is not acceptance evidence.
The current factory now gives every case the identical neutral role-only
reviewer_boundary. The fixture writes source values directly from the case ID.
Assertions require each supplied value in its actual captured dependency role;
the omitted original value must be absent from all captured files. The complete
control restores all five fields using exactly the same packet construction,
plan, and neutral reviewer instructions. Its captured input differs from the
negative only in source fields and the resulting planning_context.

Current two-case positive/project-omission evaluation is running against frozen
bytes in /tmp/4200-r12-captured-discriminating-control.json; its positive already
completed successfully. Fresh manifest checks pass 2/2 and source lint passes.
Root steps are intentionally outside repository ESLint/TypeScript project scope;
forcing root lint returned that configuration limitation, not a source verdict.
The semantic judge remains the source-specific assertion; regex checks are only
supplementary. Existing evaluator time-budget limitations are acknowledged,
not broadened into a timeout-policy change.

Final reviewed-byte results: the complete/project pair passed 2/2 (114 steps)
in /tmp/4200-r12-captured-discriminating-control.json. The other four omissions
and ordinary-input regression passed 5/5 (285 steps) in
/tmp/4200-r12-remaining-and-default-regression.json. Claude review
d3530beb-246e-4188-bab2-50088ad4b31d approves these source bytes. Its remaining
warnings are acknowledged: explicit missing-content markers are narrower than
arbitrary absence; literal source absence is not semantic absence from the plan;
the judge supplies source-specific correctness; existing time budgets remain.
Fresh inventory: 159 nondeferred cases, 109 bound dry-skips (not passes), 50
undefined. Historical six failures/585 unfinished and sixteen deferred hosts
remain visible. Published 61843ab01 CI is green; this local group needs new CI.
