# Current proof mapping — updated 2026-11-11

November 13: #7190 verified head `75d96de44` is admin-merged as `fd784a2fd`
with explicit user authority; checked Ready promotion succeeded. The absent
human approval was bypassed, not fabricated. User chose to wait for upstream
ESLint and leave converter dependencies unchanged. Its failed audit and native
proof limitation remain; no original scenario, missing RED or deferred case is
promoted. The earlier proposal below is diagnostic only and not authorized.

Latest observation, November 12: main `8daeec44c` includes #7201. Draft #7190
integrated it at `f7081a0ea`; complete local verification, two full CLI passes
(719 files / 11629 pass / 14 skip each), 599 acceptance scenarios, 52 proof
checks, builds, lint/typechecks and audits pass. Fresh independent approval
and the real 50-asset offline installer probe pass. Task VRJ93G is closed in
documentation-only `75d96de44`, pushed to Draft #7190; final-head CI
`43271285963` passes first attempt, including both Node jobs and release lanes.
Implementation-head CI `43260512508` passed after one unchanged Node 22 job
rerun; its first full CLI suite passed but a separate 30s Claude release check
timed out. That failure, earlier full failures, missing RED and all 33 deferred
cases remain. No Ready promotion, merge or new native-host journey is credited.
The converter's original audit still fails on direct rerun. A diagnostic copy
with the packed CLI and a single minimatch 11.0.8 override passes audit,
lint/typecheck, 34 process tests and six BDD scenarios; source/test bytes are
unchanged and invalid code still fails lint. This is not a native session or
completed journey. Applying the proposal requires an exception to the earlier
no-major-override restriction; original dependencies/lock remain unchanged.
PR #7190's test-only merge is not required for native execution. The following
earlier observations remain historical rather than current state.

Historical source: main `e00ea1e65` plus approval-progress candidate `d2100c869`.
That full CLI run passed 718 files / 11,624 tests, with 14 skipped;
its release lane passed 81 tests. Logs and failed predecessors remain in
the permanent trial archive, `epic-followthrough-2026-11-09/`.
These are automated mechanics, not measured user comprehension or native-host
journeys. No original scenario completion or historical RED is inferred.

Current main `e49310a74` includes both #7077 and #7078. Their final PR CI
runs `43086247056` / `43083667144` passed, but later main run `43090952840`
failed both Node jobs on the same 60s OpenCode catalogue installation timeout
(`tests/opencode/catalogue.test.ts:86`). Each had 11,631 passing tests,
10 skips and one failure. Cause remains unconfirmed. No rerun or repair is
claimed. See [next-critical-path-2026-11-11.md](./next-critical-path-2026-11-11.md).

Follow-up: user-approved Draft PR #7190 at `1c54c4a78` changes only this
catalogue test's setup to offline mode, preserving all assertions and the
timeout. Local catalogue/profile checks pass 28/28; all 50 catalogue assets
match in a direct offline probe; independent review approves. Exact historical
CI timing was not reproduced. CI run `43130744212` passed on its first attempt,
including both Node suites; the fix remains Draft and is not on main. The failed
main run remains failed. Delivery-ticket closure and Ready/merge authority are
still outstanding. No Ready/merge authority or
original epic scenario credit is inferred from this Draft.

Closure attempt: full local verification exited 1 despite green PR CI. Two
CLI passes had 2 and 1 different timing failures; all three cases passed an
unchanged isolated rerun. Acceptance (599 scenarios), proof checks (52), build
and typecheck passed. Raw Bun/uv audits report 9/16 inherited findings. Existing
Draft #7201 addresses the dependencies/toolchain separately and is not merged.
VRJ93G stays at verify/in_progress, with no done receipt; #7190 stays Draft.
The local documentation checkpoint is `e886e8543`, unpushed; PR head remains
`1c54c4a78`. Rebase/reverify after #7201 lands; do not duplicate its changes or
replace failed full verification with the isolated passing checks.

| Original obligations | Existing, exercised checks | Remaining limit |
| --- | --- | --- |
| 4, 5, 12: canonical identity and distinct authority | `integration/planning-contract-generation.test.ts`, `integration/installed-planning-copy-admission.test.ts`, `integration/native-planning-copy-dispatch.test.ts`, `review/planning-contract-reconciliation.test.ts`, `review/execution-plan-contract-identity.test.ts`; generated shared clauses, mismatched copies, actual admission boundaries and canonical reconciliation | Installed adapters and fixtures cannot establish every live native-host outcome. |
| 5, 7, 16: selective currency and human approval | Existing scheduling/contract/human-approval integration checks remain mapped. Work Log repair and referenced-destination controls are now on main via #7077. Final-head direct CLI status stays approved for progress and becomes stale for a contract link destination change. | Pre-upgrade approvals can become stale once. Native evidence is assisted; the new walkthrough is CLI-only. Enabled-human selectivity and every historical invalidation symptom are not thereby proved. |
| 6: guidance and versioned Product contracts | `hooks/product-plan-contract.test.ts` proves CLI/hook digest parity, inherited semantic changes and unmarked legacy behavior; generated planning-contract checks cover author/reviewer shared clauses | Version-transition and in-flight migration experience remain bounded by original child/host evidence; do not promote digest tests into a full migration demonstration. |
| 11, 15: legacy entry and repair | `integration/plan-transition-gate.test.ts` rejects unresolved choices and missing sections, admits corrected reviewed plans and markerless legacy paths | A markerless legacy fixture is narrower than every already-implementing accepted-version case. |
| 14: delivery mechanics | `integration/delivery-checklist-cli.test.ts`, `integration/delivery-checklist-boundary.test.ts`, `integration/pr-readiness-delivery-gate.test.ts`, `execution-plan/delivery-proof.test.ts` | Saved Claude trial closed with open checklist rows; no fabricated PR preparation or large-contribution delivery credit. |
| 9, 17: actual Codex boundary | Real local Sol session with normal approved trust, all five hook events and an assisted converter journey through reviewed plans, TDD and implementation; 34 process tests and five converter scenarios plus one starter pass. | Stops at failed dependency audit/verify; no actual converter PR or fully verified native delivery. Candidate-pinned development setup, not default-install proof. Shared enabled-plugin settings match baseline, but marketplace cache registry refreshed; byte-identical shared state is not claimed. |
| 13: disputed findings | Main's `commands/review-disposition.ts` supports confirmed user decline of optional info/warnings on approved reviews | `26FK42-resolve-disputed-plan-findings` remains at implementation planning, has no implementation plan and no completed R/G/R rows. Source search finds no typed dispute router/fresh-adjudication path. Optional decline does not satisfy correctness adjudication, durable pending recovery or typed terminal outcomes. This is genuinely missing implementation, not merely ticket ceremony. |

Product Plan scaffold repair #7078 now makes the real local writer render the
seven fields accepted by the existing structural validator. This is not semantic
approval of placeholders, every tracker path or a new native journey. Both
bounded repair tasks reached real PRs and were admin-merged; this is narrower
than original obligation 17's plain-feature journey on every authoritative host.

No native Cursor feature journey, nontechnical-builder comprehension exercise,
or full epic completion is claimed. All 33 deferred cases remain exactly
MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1. No qualification campaign, persistent
review-route change, new eligibility or retrospective RED credit was introduced.
