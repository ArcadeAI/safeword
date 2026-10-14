# Proposal: establish the smallest complete repair before choosing the landing group

Do not land #4906, #4989, #4990 and #4991 as currently combined. The isolated candidate reproduces a repeated-approval bypass after design-changing execution discovery. Independent code review e9d48f3b-c391-4a8e-9fed-6fc3ed0de745 confirmed the failure.

Recommendation: continue bounded dependency analysis before choosing expansion or a backport. Identify the complete existing higher-stack repair and compare its actual prerequisites with the cost of including its owning PRs. Prefer the smaller complete result; do not invent a separate authorization mechanism merely to land earlier.

Reason: the failing lower candidate proves that a repair is necessary, but does not establish which delivery route is smaller or safer. A faithful backport reuses the same policy; its risk is incomplete extraction or changing legacy compatibility. Expansion reuses existing branches but increases the review and verification surface.

The larger group's exact upper PR, dependency closure and verification delta have not yet been established. The current review did not test the higher group and is not evidence that expansion passes. The lower native-template fix was already backported surgically from existing higher code, demonstrating that extraction is possible for at least that isolated defect.

Before source changes: establish the smallest actual dependency closure, compare its canonical changed files and verification burden against an existing-code backport, and record the chosen boundary. Then verify both repeated-approval routes: human design approval disabled, and enabled with a prior approved decision for unchanged plan bytes. Also verify legitimate repair plus fresh review can resume, legacy accepted work is preserved until its defined planning return, and unrelated reviews cannot clear a recorded repair requirement. Do not invent new policy or silently change legacy conversion requirements.

The failed candidate is db50bc23db43e59ec5609ad9ff13f820afaf15d8 plus local foundation integration and the template repair. At the observed failing run, plan-approval.ts SHA-256 was fbdfc28c1daaf84fc15ab288213bd2874c96a03357b9c76441357c812a13559b and the test file was 68c4aea40d862d42a4dfbafcf376c61d4be8f340efa60bfb11ef3e9299da1824. Raw RED: /tmp/4200-first-group-reentry-red.log. Generated surfaces were rebuilt afterward and verified; that is not a passing reentry result.

The reviewed main d5885e58771cd87f8108196ce67986f7725a1974 has no packages/cli/src/commands/plan-approval.ts. The candidate introduces this public command and its discovery-routing path; the defect is not merely an unchanged main command inherited by this landing group.

This read-only dependency comparison is already authorized by the user's instruction to execute the plan. No new human choice is required to continue it. Present exact PR heads, evidence and consequences for explicit approval only when a concrete landing proposal is ready. Do not add deferrals, merge, promote or claim the epic complete.

Review this recommendation adversarially: Does a demonstrated lower-group defect justify expanding the group? Does a backport necessarily create a parallel mechanism? Is a human scope choice already necessary, or should bounded dependency analysis continue under the user's existing instruction to execute the plan? Is the test result current to the described bytes? Do not review the entire epic or request optional hardening.
