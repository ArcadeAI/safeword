# Safeword Harbor evals

Run these commands from this directory with uv and Docker available. For a
fresh checkout, use `./check.sh` to run the locked harness tests and prove
the verifier gives the starter 0 and the reference solution 1. This check
runs locally and uses no model account. This suite pins Harbor 0.25.0 to
reproduce the recorded trials. The dependency lock and CLI contract should
be checked together when upgrading Harbor.

Use [the comparison suite](#manual-baseline-suite) to measure finished patches,
[the intake runner](intake/README.md) to assess plans before coding,
[the handbook comparisons](handbook/README.md) to test session instructions, and
[the scorecard](scorecard-template.md) to interpret the results.

```sh
uv run --locked harbor run --path task --agent oracle --env docker
```

The bundled synthetic task uses Harbor's oracle to run a known-good solution
and its verifier. Expect reward 1. It checks the plumbing without a model
call. The trial and verifier artifacts are in the local `jobs/` directory.

To publish this smoke to LangSmith, provide a workspace-scoped
`LANGSMITH_API_KEY` in the environment and set `LANGSMITH_ENDPOINT` if your
workspace uses a different region. Then run:

```sh
uv run --locked harbor run --path task --agent oracle --env docker \
  --plugin langsmith --pk dataset_name=safeword-harbor-smoke-v1 \
  --pk fail_fast=true
```

Open **Datasets & Experiments → safeword-harbor-smoke-v1 → Experiments** and
check that the trial shows reward 1. Harbor uploads task instructions, trial
metadata, and verifier results. Review future fixtures before adding the
upload flag. Keep raw session transcripts in their local archive.

[Harbor integration docs](https://docs.langchain.com/langsmith/harbor-integrations)

## Engine

Keep Engine paused or unconfigured for the eval project. LangSmith documents
recurring scans for active projects and Pause/Resume controls. Resume restarts
scanning, so it is unsuitable as a one-shot control. Enable analysis only if
LangSmith offers a manual-only control for the workspace.

[Engine setup docs](https://docs.langchain.com/langsmith/engine-setup)

## First Safeword comparison

[#5751](https://github.com/ArcadeAI/safeword/issues/5751) tracks the real
comparison. Pin the Claude Code version and start with a real-derived task,
checking baseline and full install before adding skills-only and hooks-only
arms. The synthetic task above verifies the integration, not Safeword's effect.

Run `./compare.sh` to compare no Safeword with the current checkout. Inject
the Claude and LangSmith credentials through your secret manager. Both arms
use the same resolved author model, Claude Code version, and task budget. The default is
three attempts per arm. Pass arm names to choose what to run or set
`SAFEWORD_EVAL_ATTEMPTS` to change the repeat count.

- `baseline` leaves Safeword inactive.
- `release` installs published Safeword 1.1.0 when explicitly selected.
- `checkout` archives the generated plugin and marketplace manifest from the
  current Git commit, provisions the fixture with the archived CLI, and
  registers the archived marketplace in the trial's Claude configuration.
  Commit any changes intended for the comparison and regenerate the plugin
  before committing changes that affect generated delivery.

Find the experiments in `safeword-edit-preservation-v2`. The verifier checks
the final implementation and the unrelated export. It does not grade
intermediate hook behavior. Inspect trial exceptions separately from verifier
failures and confirm the loaded plugin path in the agent trace.

For the additional task fixtures, run:

```sh
SAFEWORD_EVAL_TASK=false-done ./compare.sh
SAFEWORD_EVAL_TASK=simple-fix ./compare.sh
```

The first fixture has a visible test that passes before the fix and hidden
assertions for partial and empty pages. Check the agent trace separately to
see whether it ran tests and what it reported. The second fixture checks the
requested retry limit and the unchanged timeout. Compare turns and model
cost on this task to measure overhead.

LangSmith records the verifier's `reward` separately from `agent_finished`,
which requires a successful terminal result. Inspect budget stops and
runner errors separately. Each task has a dollar budget shared by author
and reviewer. The benchmark sets no agent turn limit.

To run the hidden-edge-case fixture with fresh project dependencies, use:

```sh
SAFEWORD_EVAL_TASK=false-done SAFEWORD_EVAL_READY_DEPS=1 ./compare.sh
```

This runs `npm ci` during setup in every arm, after any Safeword project
installation. The task's dollar budget still applies. Experiment names include
`ready-deps` so they can be compared with the dependency-recovery runs.

## Measure the proof each agent produces

Report counts per task and arm alongside successful delivery, time, and cost.
Use the starting commit to distinguish newly added or strengthened coverage
from existing checks the agent reran.

| Measure       | Count                                                                       | Evidence for useful coverage                                                                                        |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| BDD           | Distinct behavior scenarios added or strengthened                           | The scenario covers a requested behavior and has executable evidence.                                               |
| TDD           | Distinct regression checks added or strengthened                            | The check fails for the intended reason before the fix and passes after it. Record missing RED evidence separately. |
| Product evals | Distinct cases and graders added or strengthened for probabilistic behavior | A grader distinguishes known-good from known-bad outcomes. Record cases, graders, and trial repeats separately.     |

BDD and TDD describe different properties. A scenario can serve as both
behavior coverage and regression evidence. Report the overlap before totaling
unique checks. Harbor's own verifier and trial repeats belong to the benchmark,
outside the count of proof the agent produced.

Before a run, record which kinds of proof each task calls for. Report coverage
against that expectation and mark other kinds as not applicable. More tests
alone do not earn a higher score. Check whether the proof makes a real failure
visible and whether the agent ran it before claiming completion. The current
fixtures do not automatically collect these counts.

The proof pilot adds three synthetic fixtures. Run each with the same arms:

```sh
docker build -t safeword-harbor-proof-base:1.1.0 false-done/environment
for task in behavior-proof regression-proof eval-proof; do
  SAFEWORD_EVAL_TASK="$task" SAFEWORD_EVAL_READY_DEPS=1 SAFEWORD_EVAL_ATTEMPTS=1 ./compare.sh
done
```

For each trial, inspect `verifier/proof.tar.gz` for authored artifacts and the
local agent trace for the sequence and results of checks. Harbor's numeric
reward in these fixtures covers the hidden functional checks. The authored
proof is reviewed separately.

If fetching the published marketplace times out during release setup, archive
the chosen release tag's `plugin/` and `.claude-plugin/marketplace.json` and
provide its absolute path as `SAFEWORD_EVAL_RELEASE_ARCHIVE`. Match the tag to
the published CLI version pinned in the base image. The release trial then
uses the tagged local marketplace and the published CLI in the image.

The reservation pilot measures proof agents choose to add to a plain product
request. The prompt describes reservation, sold-out, and retry behavior. It
does not prescribe a development process. Build the shared image above, then
run `SAFEWORD_EVAL_TASK=reservation SAFEWORD_EVAL_READY_DEPS=1 ./compare.sh`.
Review the saved artifacts and trace separately from the hidden functional
score in `safeword-reservation-v3`. Version 3 requires the successful retry
status, including a retry after reserving the last unit.

### Human input

For every trial, record:

- **Requests for input:** Count each distinct checkpoint where the agent asks
  the user for clarification, approval, or a decision before proceeding. Count
  a message with several questions as one checkpoint. Record repeated requests
  as repeats of the same checkpoint.
- **Replies received:** Count replies actually delivered, and record whether
  they came from a person or a scripted user.
- **Effect:** Record what the reply clarified or authorized and whether the
  agent resumed. Review whether the request resolved meaningful uncertainty,
  honored an approval boundary, or asked for information already available.

A useful request is positive evidence. If a trial ends while waiting for a
reply, report **awaiting user input** alongside the functional score. A clean
CLI exit alone does not establish delivery. Keep first-response runs separate
from interactive runs, and give all interactive arms the same reply policy.

Reservation v2, one first-response trial per arm, manually scored from the
final messages:

| Arm                  | Input checkpoints | Replies received | Outcome                                        |
| -------------------- | ----------------: | ---------------: | ---------------------------------------------- |
| No Safeword          |                 0 |                0 | Delivered and passed the hidden checks         |
| Release 1.1.0        |                 1 |                0 | Asked for confirmation of scope and behavior   |
| Checkout `72165cde6` |                 1 |                0 | Asked for clarification of scope and interface |

These historical counts were tallied manually. Current runs save each relay
request and delivered answer locally. LangSmith does not receive the HITL counts.

For a live human relay, set `SAFEWORD_EVAL_HUMAN_RELAY=1` and
`SAFEWORD_EVAL_RELAY_DIR` to an absolute, local directory under `jobs/`.
The suite uses [answer-key.json](answer-key.json) for exact task-specific
replies. If there's no match, the runner pauses at the numbered
`-request.md`. During a supervised run, send any unresolved question to
the operator. The matching trace distinguishes a question from an ordinary
handoff. Write one
action to the corresponding `-response.json`:

- `{"action": "reply", "reply": "…"}` sends a scripted or human answer.
- `{"action": "continue"}` resumes clear unfinished work without an open
  question using the fixed prompt “Continue with your next step.” Apply
  the same rule across arms. Count these separately from input requests
  and replies.
- `{"action": "finish"}` ends the trial for grading.

Use an atomic file rename so the runner never sees a partial response.
Claude continues its existing session in the same trial.
If Claude emits a terminal result but the command stays open, the runner
gives it 60 seconds before stopping that invocation's leftover processes.
A new assistant message or tool result cancels that cleanup window.

For future evals, accept routine approval requests for work within the agreed
scope, including plans, scenarios, and permission to proceed. Reply
“Approved, proceed.” Count the request and record the reply as scripted.
For actual decisions, use the decision log to answer covered questions and
relay unresolved ones. If a message asks for both approval and a decision,
approve the agreed work and relay the unresolved decision.

The relay files stay on the host. Record the exact question, reply, and outcome
in the reservation decision log. Interactive results use a separate dataset.
Agent execution and the relay have no wall-clock or turn cap.

Use the [scorecard template](scorecard-template.md) to report each comparison.
The [audited reservation scorecard](reservation-scorecard.md) is a worked example.

See the [code review category pilot](review-category-pilot.md) for examples beyond reservations.

The held-out BDD Extractor fixture uses pre-fix commit `9e0aafee`.
Run `./prepare-extractor.sh` first. It creates a sanitized, history-free
snapshot and stages the historical test outside the agent image. The
verifier checks a padded short page, a page exactly at the thin threshold,
and fallback whitespace. The Docker calibration failed only the padded
case before the fix and passed all three after applying `2581909`.
Use the tagged release archive for the release arm so neither the baseline
nor the checkout can accidentally activate the project's old tooling.

The BDD Extractor fixture uses distinct Docker build targets. The baseline
image has no Safeword CLI. The treatment target uses a separate manifest and
lockfile that pin CLI 1.1.0 and installs them with a frozen install. Both Safeword arms reuse that layer and provision from their
own archived plugin with project dependency installation disabled by
`--offline`. A cold treatment build still needs the package registry.

## Intake cutoff

[Compare an intake change with the frozen handoff protocol](intake/HANDOFF.md) or [run a single intake trial](intake/README.md).

Use `intake_cutoff.py` around the author when a trial ends at feature intake.
It records the intake ticket, the first downstream edits, and the result of
checking the current independent approval. If the phase change and a downstream
edit appear in the same observation, the outcome is `order_unverified`, even
when the review receipt is valid. Report those trials as inconclusive when
comparing verified handoffs. The cutoff tests cover a phase change that occurs
during the file scan as well as the recorded pass and early-edit shapes.

```sh
python3 -m unittest discover -p test_intake_cutoff.py
```

## Bug-fix preservation wording experiment

Build the eval-only archive and use the same commit for the control:

```sh
mkdir -p jobs
python3 build-preservation-variant.py 72165cde6 jobs/preservation-72165cde6.tar
SAFEWORD_EVAL_REVISION=72165cde6 \
  SAFEWORD_EVAL_PRESERVATION_ARCHIVE="$PWD/jobs/preservation-72165cde6.tar" \
  SAFEWORD_EVAL_TASK=extractor-thin-text ./compare.sh checkout preservation
```

The example fixture is suitable for a wiring smoke; use fresh, frozen tasks
for comparative evidence. The variant changes only the existing debug skill's
bug-fix implementation guidance and its integrity metadata. The comparison
uses the same underlying checkout agent, with a `preservation` label on the
variant experiment. Confirm the debug skill was actually read when interpreting
the comparison. Record the base commit and archive SHA-256 with the results.

## Historical trace regression

Use this fixture to check whether a bug fix handles both ways of getting an
empty trace. The command must fail when it compares data and finds no matches
and when it has nothing to compare. It must still write the report and keep
working when matches exist, including partial-area failures.

From this directory, prepare the frozen BDD Extractor source, then run the
comparison with the usual Anthropic and LangSmith credentials.

```sh
./prepare-extractor-trace.sh
SAFEWORD_EVAL_TASK=extractor-trace-empty ./compare.sh checkout
```

The preparation script also accepts a path to a local BDD Extractor clone
containing the frozen revision. The v3 verifier runs the real `trace` CLI with a deterministic matcher in four cases:
compared with no matches, no overlapping areas, a match, and a match alongside an
area failure. It checks exit status, the empty-result explanation and the written
report. The remaining historical regression tests also have to pass.

Harbor scores the **final checkout**. In `trial-report.json`, `trace_delivery`
shows the four results and the separate CLI replay for commit hashes mentioned
in the final author message. A missing Git object is recorded as unresolved.
A pending entry means supplemental replay did not finish. Commit results never
replace the checkout score. Raw results are in `verifier/trace-delivery.json`.
Use dataset `safeword-extractor-trace-empty-v3` for new comparisons. Run
`./calibrate-graders.sh` after preparing the snapshot to check the grader
against known-good and broken implementations. The [trace scorecard](extractor-trace-empty/scorecard.md)
documents earlier versions and their results.

### Debug guidance decision

Keep the existing release guidance. The
[preservation wording test](extractor-debug-activation-scorecard.md) showed no improvement
when the debug skill was explicitly loaded. The
[handbook routing test](extractor-trace-empty/scorecard.md) showed no automatic
debug activation on the historical trace bug. Retain the experimental archives
and scorecards as evidence. The trace task is reusable with the normal checkout
arm and needs neither experimental archive.

Historical scorecards refer to the original operator’s local `jobs/` archive.
A fresh run creates new evidence under its own job directory.

## Manual baseline suite

The [merged feature and bug comparison](merged-feature-bug-scorecard.md) records three attempts per arm, including a CLI replay that exposed two different reasons for a zero reward.

Run `./prepare-extractor.sh` and `./prepare-extractor-trace.sh` to prepare the
two historical fixtures. Build the synthetic base image as shown above.
Resolve the npm `latest` tag to a stable version and ensure it matches the
fixture CLI pins. Archive that version's `plugin/` and
`.claude-plugin/marketplace.json` from its Git tag and pass the absolute
archive path as `SAFEWORD_EVAL_RELEASE_ARCHIVE`.

Run `./compare-suite.sh` with credentials injected. It runs five attempts
per task and arm by default, with the same model, budget, prompt, and reply
policy across arms. Set `SAFEWORD_EVAL_ATTEMPTS` for a smoke run. The website
task runs one trial at a time.

Each job writes `trial-report.json` with grader results, agent and tool
errors, tool calls, invoked skills, files read, hook responses, ticket
phase snapshots, relay messages and decisions, and draft PR cleanup.
The suite combines the reports in `suite-report.json`. URL requests
visible in tools are listed separately from URLs mentioned in calls or
output. Child-process network traffic may be absent. During cleanup, the
host closes an open draft only when the trace records its creation and
GitHub confirms it was created during the trial with a head commit from
that trial.

## Help-page discovery feature

Run `./prepare-extractor-discovery.sh` to freeze the historical extractor
before one-level discovery. Then use `SAFEWORD_EVAL_TASK=extractor-discovery`
with `./compare.sh`. The hidden
verifier serves local sites and scores discovery, the crawl boundary, sitemap
precedence, and preservation of existing homepage links. The added homepage
check is scored in dataset v2. An infrastructure failure without a reward
is reported as a verifier error. The [task scorecard](extractor-discovery/scorecard.md)
records the calibration controls and the answer to replay if an agent asks
about depth.

## Cross-repository comparison

Run `sh ./prepare-cross-repo-tasks.sh` with the Arcade monorepo and website
checked out under `~/Projects`. It creates two tasks from frozen revisions:

- `arcade-outlook` adds conversation listing to Outlook Mail in Arcade
  Monorepo. The verifier mocks Outlook and checks catalog registration,
  mailbox-wide results, pagination, and existing search behavior.
- `www-home` fixes the localized homepage carousel and scroll behavior in
  the `www` website. The verifier builds a local Astro fixture and drives it
  in Chromium. Use one trial at a time on a machine with 16 GB of memory.

Both tasks use the same starting image and lockfile for both arms. Neither
grader requires live service credentials. The five-task comparison also
includes `simple-fix`, `extractor-discovery`, and `extractor-trace-empty`.
The two extractor tasks use the same starting image in both arms.

The Outlook starter is `f80c8fd322`, and `763bd845ae` is the reference
implementation. The grader passes the historical fix and rejects a version
that drops the continuation token. Existing search checks accept either an
omitted or empty query on subsequent pages. Both representations omit the
original search query.

The website starter is `f821c3f42`, and `010843bc4` is the reference
implementation. The reference passed all five browser tests. The starter
reported missing Swiper and GSAP globals, and the carousel-only patch still
reported the missing GSAP global. Those two control runs were stopped after
capturing the expected browser errors. The grader now stops at its first
failed test to avoid rebuilding the site to repeat the same failure.

These account-backed trials assume trusted fixtures. The author and reviewer
run under the same container user. The local account can be available to code
executed during a trial. Use a dedicated test account for that work.

### Claude subscription and local results

`compare.sh` sets the same estimated USD budget per trial in every arm.
The default budgets are $0.50 for small fixes, $1.00 for standard tasks,
$2.00 for longer investigations, and $3.00 for reservation and extractor
discovery. Set `SAFEWORD_EVAL_BUDGET_USD` to override the selected task's
budget for all arms in a run.

Each comparison resolves the latest available model in each selected family
before the first trial. Defaults are Haiku for the author, Opus for Claude
review, and Sol when Codex review is enabled. Set
`SAFEWORD_EVAL_CLAUDE_FAMILY` for the author,
`SAFEWORD_EVAL_CLAUDE_REVIEWER_FAMILY` for Claude review, or
`SAFEWORD_EVAL_CODEX_FAMILY` for Codex review. The comparison and its suite
reuse exact model IDs, CLI versions, and rates from
`comparison.json`. The checkout's project-local `safeword` executable runs
the bundled CLI. Look for its hash in `agent/safeword-runtime.json`.

Update [provider-rates.json](provider-rates.json) from its linked vendor
pricing pages when rates or models change. You can pass a different verified
file in `SAFEWORD_EVAL_PROVIDER_RATES`. The preflight stops if a resolved
model has no verified rate.

The comparison counts author and reviewer usage against one per-trial dollar
cap and carries that spend across relay replies. The runner checks spend
after usage arrives, so the last in-flight call can put the trial over budget.
Subscription spend is reported as the API-equivalent estimate.

For a manually authorized subscription run, generate a Claude Code token
with `claude setup-token` and provide it securely as
`CLAUDE_CODE_OAUTH_TOKEN` in the runner's environment. Set
`CLAUDE_FORCE_OAUTH=1` for the Harbor Claude Code adapter to select
subscription authentication. Set `SAFEWORD_EVAL_LOCAL_ONLY=1` to keep
results under `jobs/` without uploading to LangSmith. Local-only mode
leaves the same grader and trial artifacts available for inspection.

For independent reviews in Safeword arms, set
`SAFEWORD_EVAL_CODEX_REVIEW_AUTH` to the absolute path of a local Codex
`auth.json` from a ChatGPT login. The runner installs the pinned Codex CLI,
checks the login, and gives Safeword access to the credential in a private
directory in that disposable trial. It removes the copy after the run.
Use this option for Docker fixtures and plugin bundles you trust with that
account. Credential provisioning applies to the Safeword arms.

```sh
SAFEWORD_EVAL_CODEX_REVIEW_AUTH="$HOME/.codex/auth.json" ./compare.sh checkout
```

`trial-report.json` includes `model_spend` for the author, each Codex and
Claude reviewer attempt, and their combined USD estimate. The raw reviewer
meter records token counts and model evidence in `agent/review-usage.jsonl`.
The author ledger in `agent/author-spend.json` is reconciled against Claude's
cumulative usage at each result. For tiered Claude models it also uses the
CLI estimate when the cumulative token totals cannot establish request-level
tiers. The live Codex meter prices individual requests at the frozen rates.
If only an aggregate survives and it spans a pricing tier, the report marks
the cost unknown. Historical logs without the live meter may use the locked
LiteLLM price table and name that source. The report preserves Claude's own
estimate alongside the comparison estimate. A reviewer attempt with missing
usage leaves the combined total unknown.
