# OpenCode V2 native guard RED

The actual feature rows at lines 198 (CLI) and 199 (TUI) are executable through
the OpenCode guard component. Both fail only at the final filesystem assertion:
the forbidden ticket write reaches disk after valid native setup and dispatch.
No production V2 adapter has been implemented yet.

Canonical command:

```sh
scripts/dev env \
  SAFEWORD_OPENCODE_TEST_CONFIG=/tmp/safeword-2enrh5-targets.aOFAud/opencode-fixture.json \
  bun packages/cli/scripts/run-host-contract-proof.ts --proof native-opencode --require-targets
```

Initial authored run: exit 2, one passed setup hook, two failed scenarios,
six passed steps and two failed Then steps, 54.792 seconds. Report:
`/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-host-contract-proof-nvSYvJ/cucumber.json`.
Failure: NATIVE_OPENCODE_V2_GUARD_MISSING.

All four V1 production controls (CLI/TUI, allowed/denied) pass before the
component runs. Each V2 Given also proves its real permitted-write contrast.
The final failure requires a unique native shell dispatch, an actual tool
result, the candidate active in the host registry from its exact owned package
path, byte-identical package contents, and the forbidden file present.
Missing setup, failed registration, undefined steps or a partial population
cannot be classified as that RED.

The explicit bootstrap carrier supplies no policy. Its manifest prevents it
from certifying any passing contract outcome. Its permitted write is a setup
control only. Even a later passing component returns incomplete (3) until the
remaining catalogue, worker, registration and runtime obligations are wired.
No scenario-ledger checkbox is checked for this partial outline.

## Independent execution receipts

- c97074da-9bf5-4fa3-97f8-3bd5d1b59e30 approved the first executable proof.
- The final primary proof additionally requires GREEN to observe the candidate's
  real shared-runtime dispatch through a transparent process recorder. It binds
  the packaged runtime path, normalized event/tool/input, project, native session
  and exit status. A legacy fallback or independently authored adapter predicate
  cannot supply that record. The recorder forwards actual arguments, stdin,
  stdout, stderr and exit status unchanged and supplies no policy decision.
- 9f78c492-5283-4389-a40b-d40c46f3bc04 approved that updated proof after actually
  running the command: exit 2, no timeout/signal/truncation, 53 seconds against
  180 seconds, with the expected literal in both full output streams.
- The public executable-RED gate reports GREEN authorized by that fresh
  cross-agent Claude/opus receipt. This authorizes implementation, not completion
  of the full outline or native OpenCode group.
- Quality review 47563e80-50a9-42ef-b0ea-3d9bc98934f9 approved the bootstrap
  fixture before the extra shared-runtime attribution check. Its earlier
  conditional-package-loading error is fixed; the package is now mandatory.

## Regression and dependency checks

- Complete CLI suite: 727 files passed; 11,686 tests passed, 14 skipped,
  915.81 seconds. Log: `/tmp/safeword-contract-pr1-full-suite.log`.
- Updated population and existing Codex/Cursor controls: 51/51 passed in six
  files. Log: `/tmp/safeword-native-population-regressions.log`.
- Codex's complete native diagnostic group after sharing the process recorder:
  five scenarios/19 steps passed, 53.550 seconds, exit 0. Report:
  `/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-host-contract-proof-nGE75t/cucumber.json`.
- Typecheck and targeted lint pass. Earlier root lint/build, all five generated
  surfaces and all 277 parity pairs/11 contracts also passed.
- The SDK-only locked dependency tree contains 262 packages, including
  @opencode/plugin 2.0.32 and Effect 4.0.1. Bun 1.3.14 audit returned exit 0 and
  no advisories. The manifest, complete lock and raw audit output are retained
  under opencode-v2-sdk-audit/.
- A separate workspace audit reported seven existing advisories across six
  packages. The SDK audit does not clear the shared CLI bundle; inspect the
  final generated carrier's dependency closure before judging its applicability.
  No blanket clean-workspace or release-readiness claim is made.

Next: implement the isolated V2 transport using the shared dispatcher and
canonical packaging, prove actual candidate dispatch on CLI and TUI, then
continue the accepted complete-catalogue/worker/coexistence obligations.
