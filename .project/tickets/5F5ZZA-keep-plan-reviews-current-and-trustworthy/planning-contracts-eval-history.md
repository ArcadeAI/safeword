# Planning-contract eval history

The fixed judged corpus uses three reviewer runs per case and requires at least
two correct judgments. Each run's exact manifest, reviewer outputs, judge
reasons, and per-case status are in `planning-contracts-eval.json`.

During harness development, complete runs scored 8/11, 9/11, 9/11, and 10/11
before an 11/11 run. None of the incomplete runs was treated as passing. The
inconclusive cases exposed ambiguous or incomplete synthetic packets (corrected
plan bytes, persona failure outcomes, and the missing-boundary case), an
ambiguous `scope_expanded` projection, and a judge that lacked the canonical
phase contract. The fixtures now isolate the intended rule, the judge receives
the actual phase contract, and both are pinned by manifest digests. Focused
three-run checks of the disputed cases preceded that full run. Two further R7
cases were then added for a public source requesting private project material
and a source declaring no reuse limits. Each passed a focused three-run check;
the expanded fixed corpus then passed **13/13** cases with three runs each.
The current raw report and manifest retain every reviewer verdict and judge
reason for that final run.

The semantic eval is distinct from deterministic installed-boundary tests and
from the reviewer-capability catalogue. It does not prove that every real-world
planning packet will be judged correctly.
