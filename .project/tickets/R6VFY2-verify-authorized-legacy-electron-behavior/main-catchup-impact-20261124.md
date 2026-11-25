# Impact of catching up with main

Assessment target: local exception branch codex/sgwmbs-reviewed-retrospective,
starting at c004dbfe4305ef70145f5fa517899c7c2972a350. Fetched main is
47464164c; 31 incoming commits. This integrates main into the local branch,
without publishing the extension or changing the installed working plugin.

## Merge and compatibility

Authored source merged without conflicts. Eight generated files conflicted:
the two bundled CLIs, plugin identity/inventory, and four lifecycle fixture
files. They were regenerated from combined source using the supported generator,
not hand-merged. All five generated surfaces passed verification, including the
real lifecycle fixture contract. All 277 parity pairs and 11 contracts pass.
The merged lockfile installs frozen; CLI type checking passes.

Main does not change the exception's trusted policy, monitored replay kernel,
signed row/closing validation, or separate 120-second combined-check deadline.
The updated source CLI read the existing actual Soulless final closing record
and approved all 17 enrolled rows. That is read-only compatibility evidence,
not a claim of 17 new replays or reconstruction of missing original histories.

## Concrete integration impact

Main now rejects explicit failed Test Suite, Gherkin, Build, Lint, Typecheck or
Scenarios markers anywhere outside fenced examples in verify.md. Soulless's
current report retains earlier failed checkpoints at lines 196, 253, 364 and
389. The updated shared report checker therefore refuses that full report with
"Scenarios failed", although its current opening section passes and the actual
17-row closing record still validates. The diagnostic comparison operated only
on strings in memory; neither the report nor any receipt was changed.

Before installing this combined build for Soulless, separate the current
verification report from the historical checkpoint narrative. Preserve all
historical failures in a linked history document and retain the missing-history
limitation in the current report. Do not clear old failures by pretending the
original test-first records exist, or weaken main's check to bypass the issue.
No such report migration or installed-plugin update is included in this catch-up.

Main also enforces outstanding done checks on Codex Stop after ticket closure
by edit, including continuation turns. That strengthens closure enforcement;
it does not revoke existing retrospective records. Planning reviews now include
cited architecture documents and the configured overview. A future upstream
submission must obtain current planning/review evidence against that context;
the earlier approvals are retained as historical, not relabeled as new reviews.

The previously installed CLI remains at SHA-256
48de020dce911c7b0a39be666649eba7621a27ef5c20e5ab24ea1d20079506ad.
The merged Soulless PR and its branch/records are unchanged by this assessment.

Evidence: /tmp/issue163-main-catchup-generation.log,
/tmp/issue163-main-catchup-parity.log, /tmp/issue163-main-catchup-types.log,
/tmp/issue163-main-catchup-existing-close.json and
/tmp/issue163-main-impact-report-sections.json.

## Combined-source regression result

All 462 tests passed in 38 files, with one worker, in 865 seconds. The selection
covers the legacy Electron exception and existing retrospective contracts,
review packets/planning roles/architecture citations, shared report and readiness
checks, and both Codex and Claude close-by-edit completion paths. These are
combined-source working-tree results before the merge commit; a complete repeat
of the earlier 12,263-test source suite is not claimed. Log:
/tmp/issue163-main-catchup-protection.log.

Conclusion: main integrates without an exception-code conflict or a failing
selected regression. The documented report-format incompatibility remains a
follow-up for revalidating the old Soulless ticket with the updated checker.
