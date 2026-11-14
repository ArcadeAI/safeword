# Independent boundary decision for the first #4200 merge group

Assess the exact candidate source, not readiness of higher PRs. The candidate combines remote #4991 db50bc23 with latest foundation #4906 711e32412, preserving D1 admission tests and real semantic acceptance proof. No existing PR has been changed, promoted or merged.

The native template lookup is narrowly backported from c91547387/d74a2dc15. Its new actual CLI regression failed before the fix (PLAN_APPROVAL_FAILED, missing project template) and passes after it. Four targeted files passed 101 tests before the later reentry regression assertion was added. The four acceptance features passed 145 scenarios / 6,769 steps. Types and all generated surfaces passed before the latest source repair; generated runtimes still need rebuilding after that repair.

The added reentry assertion actually fails: Execution review requests Implementation repair; first approve-plan returns exit 2 and moves to plan-implementation; the next unchanged invocation returns exit 0 and advances to plan-execution. It should remain denied until repair and fresh review. Raw result is retained at /tmp/4200-first-group-reentry-red.log. Do not treat selected pending tests as successful proof.

Higher PR commits 93781e058 and c91547387 address this with retained discovery context, current-context invalidation, and legacy conversion refusal. Lower candidate's test fixture is legacy (no product_plan_contract v1). Merely appending a notice plus unconditional legacy refusal would also block its currently passing fresh-review repair path until explicit conversion. New current-context identity machinery is not present in this group.

Questions: Is this a genuine safety dependency preventing independent landing of #4906/#4989/#4990/#4991? What smallest subset of existing higher-stack behavior fixes the lower candidate correctly without a parallel policy or silent legacy migration? Identify exact dependencies or a safe existing implementation, and distinguish inherited defects from newly exposed authorization paths. No synthetic evidence, new deferral, test weakening, or full-readiness claim is permitted.
