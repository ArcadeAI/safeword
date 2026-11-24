# Local closure timeout investigation

The normal current Codex Stop hook refused completion. The canonical ticket
remains in_progress/done; no completion status or readiness receipt was forged.
The dispatcher probe returned a no-op, so the current packaged Stop source was
invoked directly with this actual session identity to exercise the gate.

The gate resolves two BDD commands (root and CLI), each with a fixed five-minute
cap. The terminal reason contains the Cucumber invocation terminated by SIGTERM.
Process observations showed the second Cucumber process near that cap. There
were no failing scenario diagnostics before termination. The exact command,
timeout owner and raw terminal verdict are retained.

Competing explanations: a scenario regression, command duplication, or a local
runtime over the fixed cap. Exact-source CI cb18cb71f passed 596 scenarios /
11118 steps, so the scenario-regression hypothesis has no supporting failure.
The resolver does duplicate the two lanes, but each has its own independent cap;
duplication explains total wall time, not one command's termination. Earlier
local whole acceptance commands took more than five minutes as well, while CI
finished acceptance in less than five. Runtime budget is the surviving cause.
The machine load was 3.54 on 18 CPUs, so heavy CPU contention is not established.

One bounded retry of the unchanged normal gate also refused completion with the
same acceptance SIGTERM. Warm-up did not resolve the cap. No command, test filter,
timeout, state or policy changed. Both refused results are retained; the ticket
remains unfinished and the PR remains Draft. No further unchanged retry is planned.

The passing historical Cucumber output was only 11253 bytes from invocation to
summary, well below execSync's usual output-buffer limit. Cucumber's existing
BeforeAll guard already isolates Claude and Codex profiles, so there is no
evidence that changing the operator's profile or login would help. Neither is
modified. A separate prerequisite repair requires a scope decision rather than
quietly enlarging this surgical PR or waiving the completion gate.
