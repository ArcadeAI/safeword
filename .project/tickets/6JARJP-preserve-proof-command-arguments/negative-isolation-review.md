# Keep authorization negatives unambiguous

Review 55d3f173 approved the integrity/predecessor repair and identified three
remaining confounders. All are addressed without changing any expected verdict
or destination: the predecessor guard includes all-obligations-assigned; the
missing-owner fixture says every recorded decision rather than claiming both;
and the reopened-owner Execution Plan consistently uses per-transport ownership
in its tasks and proof boundary, while its unchanged accepted Implementation
Plan still requires one shared service. The latter is now a genuine design
deviation rather than an internally contradictory accounting typo.

Two regression assertions failed before the fixture repair, with fourteen tests
passing. Afterwards, all 73 tests in four focused files passed, including both
provider profile controls, all fixture guards, proof tags and the missing-hook
control. Lint and formatting are clean. The nine-file post-main reconciliation
run separately passed 269 tests with two existing platform skips. The four
production repair modules are byte-identical to CI-green 72129cbf1; current main
cfe93e30 was merged and generated carriers regenerated, resolving only generated
identity conflicts. Main supplied the urllib3 lockfile fix; uv audit is now clean.

The test bank's accepted scenarios, implementation approaches and expectations
are unchanged by this final isolation repair. Production conformance/rubric and
admission evidence remain untouched. Please check the intended single-defect
property and whether any approving input now needs an unavailable predecessor.
Full live results must come from the updated bank, not the prior 27/28 run.
