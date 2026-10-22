# Reject retained parallel policy ownership

First PR 3 repository-boundary component, bound only to Scenario: An interface
that leaves parallel policy ownership does not count as consolidation. This
is not full inventory, lane-disposition or owner-delta completion.

The real current Codex entrypoint executes the shared pre-tool gate and then
retains its own required-intake predicate, including a separate required-fields
list and frontmatter predicate. The negative fixture preserves that exact source
from commit 0456c2ff9 in owners/codex-intake-predicate.txt. After migration the
same source is reinserted into the owned fixture to retain the negative control;
it is never installed into a user's project or used to decide test results.
The fixture is a real tracked repository archive with current source overlaid
and read-only dependency symlinks. All mutations and cleanup remain under its
owned temporary parent directory.

The When is a real required repository-check subprocess in that fixture. Before
the contract-aware check exists, it invokes today's actual scripts/parity-check.ts
--mode=all; afterwards it invokes the accepted check-host-contract.ts --json
entrypoint. There is no missing-command/import stub, success-result injection,
or test-owned checker. Baseline setup succeeds and the existing production
check exits 0, reporting 277 pairs and 11 contracts in sync despite the retained
parallel decision. The test fails at the desired result boundary with
COMPETING_HOST_CONTRACT_OWNER and the stable codex.intake.required-fields ID.
A non-result process/setup failure is explicitly unavailable. GREEN requires
the real successor check to reject with exit 2 and identify that owner.

The final author run /tmp/safeword-repository-boundaries-red-final.log has one
failed test at that exact assertion, no missing import or setup error.
No production contract checker or policy consolidation has been implemented.
The fixture also confirms the real shared gate and adapter entrypoints exist.

Design investigation: retain the existing schema and integration registry as
canonical authorities, discover actual source/configuration edges, and add
used bindings beside existing policy owners. A separate universal execution
runtime or independently curated host catalogue would preserve the maintenance
problem and is rejected. Structural source inspection can use the installed
TypeScript compiler API rather than matching comments or duplicating decisions.
The first checker must name real violations; further facet, mutation/repair,
positive coverage and committed owner-delta controls remain in the accepted
plan. A partial static check cannot certify the full inventory.

Sources checked: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
and https://git-scm.com/docs/git-archive. The TypeScript primary guide explicitly
limits this Compiler API to versions below 7; use the repository's installed
compiler and do not upgrade it for this task. Premortem: a renamed predicate or
new route evades a narrow known-name guard; complete facet/disposition discovery
and adapter-owner constraints are still mandatory before actual-repository
completion can pass.

After the first approved RED, reviewer warnings strengthened the future GREEN:
output must identify the actual adapter authoring path as well as the stable
owner ID. The retained fixture now includes the original whole intake gate,
not just an unused predicate; when restoration is needed it is wired back into
runEnrolledPreToolUse's actual target-path decision route. The Given requires
that reachable call. Required-check CI wiring and positive full-consolidation
controls remain mandatory later tasks, not claims from this first negative
component. These support changes require a fresh independent RED before code.
