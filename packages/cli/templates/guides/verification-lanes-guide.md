# Verification Lanes Guide

How to choose when a test or check should run: focused, smoke, live-fire,
release, migration, static, or slow/performance.

---

## Core Idea

Test type answers **what behavior is being proved**. Verification lane answers
**when and how much evidence is needed**.

Use both labels:

```text
Unit test + focused lane        → fast proof while implementing
E2E test + smoke lane           → quick proof the main journey still works
Acceptance test + release lane  → proof the shipped artifact satisfies requirements
Integration test + migration    → proof old data still upgrades correctly
```

Do not force every lane into the unit/integration/E2E taxonomy. Smoke,
live-fire, release, migration, static, and slow/performance are execution
strategies. They can contain any test type.

Choose the lane for a specific verification run, not for the test file forever.
The same test can be focused while developing, smoke before a PR, and release
before publishing. If a run touches real external systems, real credentials, or
customer-like infrastructure, apply the live-fire guardrails even when its
primary lane is smoke, release, or slow/performance.

---

## Lane Decision Tree

Answer in order. Stop at the first match. Choose the lane that explains why this
run exists now.

1. **Are you proving only the current change while writing code?**
   - YES → Focused lane
   - NO → Continue

2. **Do you need a quick signal that the product is basically usable?**
   - YES → Smoke lane
   - NO → Continue

3. **Is the main reason for this run to prove behavior against real external
   systems, real credentials, production-like infrastructure, or a real
   customer-like workspace?**
   - YES → Live-fire lane
   - NO → Continue

4. **Are you proving that a built, packaged, or deployed artifact is ready to ship?**
   - YES → Release lane
   - NO → Continue

5. **Are you proving old data, old config, or old installs still work after an upgrade?**
   - YES → Migration lane
   - NO → Continue

6. **Is the check static analysis rather than runtime behavior?**
   - YES → Static gate
   - NO → Continue

7. **Is the check too expensive for normal local or per-commit runs?**
   - YES → Slow/performance lane
   - NO → Re-evaluate the test type in `.safeword/guides/testing-guide.md`

**Tie-breaker:** if a check fits two lanes, choose the lane that explains why it
is run at its cadence. Example: a Playwright checkout test that runs in two
minutes before every PR is a smoke lane test; the same journey run across
browsers, locales, and payment providers before release is a release lane test.

---

## Lane Reference

| Lane             | Purpose                                      | Typical Cadence             | Example Command                     |
| ---------------- | -------------------------------------------- | --------------------------- | ----------------------------------- |
| Focused          | Prove the behavior currently being changed   | During TDD                  | `npm test -- path/to/test`          |
| Smoke            | Prove core product paths are not broken      | Before handoff, PR, deploy  | `npm run test:smoke`                |
| Live-fire        | Prove real-environment behavior              | Manual, scheduled, pre-prod | `npm run test:live`                 |
| Release          | Prove the artifact is shippable              | Before release              | `npm run test:release`              |
| Migration        | Prove old state upgrades safely              | Before release              | `npm run test:migration`            |
| Static gate      | Catch non-runtime correctness issues         | Every verify or CI run      | `npm run lint && npm run typecheck` |
| Slow/performance | Prove scale, speed, or long-running behavior | Scheduled or release        | `npm run test:slow`                 |

Commands are placeholders. Use the package manager and scripts the project
already has.

---

## Good Verification Lane Or Busywork

A good verification lane changes an engineering decision. It tells the team
whether to keep coding, hand off, merge, release, roll back, or investigate the
environment. A busywork lane consumes time without changing the next action.

Before adding a new lane or check, answer in order. Stop at the first failure.

1. **What decision will this run unblock?**
   - Clear answer → Continue
   - No clear answer → Do not add the lane; name the decision first

2. **What plausible failure would cheaper checks miss?**
   - Clear answer → Continue
   - No clear answer → Use a focused test, static gate, or existing suite

3. **Is the cadence matched to cost and flake risk?**
   - YES → Continue
   - NO → Move it later, make it opt-in, or split a cheaper smoke check

4. **Will the evidence identify what ran and what failed?**
   - YES → Continue
   - NO → Add artifact, environment, command, data, and failure-action details

5. **Is ownership clear for expensive, slow, or side-effecting runs?**
   - YES → Keep the lane
   - NO → Define the triage owner, cleanup rule, and escalation path first

### Good Lane Signals

| Signal                    | What It Means                                            |
| ------------------------- | -------------------------------------------------------- |
| Decision-linked           | The result changes whether work proceeds                 |
| Cheapest sufficient proof | The lane runs no earlier or broader than needed          |
| Distinct risk             | It catches a failure cheaper checks cannot catch         |
| Specific evidence         | Output names command, artifact, environment, and scope   |
| Clear owner               | Someone knows how to diagnose and maintain failures      |
| Controlled side effects   | Cost, data mutation, notifications, and cleanup are safe |
| Failure action            | The guide says whether to fix, retry, rollback, or skip  |

### Busywork Smells

| Smell                      | Why It Wastes Time                        | Better Move                             |
| -------------------------- | ----------------------------------------- | --------------------------------------- |
| Runs because it exists     | No decision depends on the result         | Remove it or document the decision      |
| Full suite labeled smoke   | Slow signal blocks fast feedback          | Keep only core alive checks             |
| Accidental live-fire       | Real side effects hide in default tests   | Make it opt-in with guardrails          |
| Source tests as release    | Does not prove packaged artifact behavior | Install and test the built artifact     |
| Performance without metric | Cannot fail deterministically             | Define workload, threshold, and runtime |
| Static gate as behavior    | Type/lint success does not prove workflow | Add runtime behavior coverage           |
| Anonymous environment      | Failure cannot be reproduced              | Record environment and artifact         |
| No owner                   | Failures rot or get ignored               | Assign triage ownership                 |

### Examples

Good verification lane:

```text
Decision: Can we publish the package?
Risk: Published artifact is missing the CLI bin or template files.
Lane: Release
Command: npm pack, install tarball into a temporary project, run public CLI.
Evidence: tarball name, temp project path, CLI command output, files verified.
Failure action: block release and inspect package file inclusion.
```

Busywork lane:

```text
Decision: unclear.
Lane: Smoke.
Command: npm test.
Risk: "General confidence."
Evidence: pass/fail only.
```

If a lane fails this gate, convert it into one of:

- A focused test for the specific behavior
- A static gate for source or metadata validity
- A smaller smoke check
- A release or migration check with artifact and fixture details
- A scheduled slow/performance run with a metric and owner
- A live-fire run with explicit opt-in guardrails

---

## Focused Lane

Use focused tests while implementing. They should be narrow enough to run
repeatedly and strong enough to fail when the behavior is wrong.

**Use when:**

- Working through RED/GREEN/REFACTOR
- Fixing a bug with a known reproduction
- Refactoring and protecting the touched behavior

**Evidence required:**

- The specific failing test fails for the right reason before implementation
- The same test passes after implementation
- Nearby affected tests pass when practical

**Good examples:**

```bash
npm test -- src/cart/discount.test.ts
npm test -- --runInBand auth
pytest tests/test_invoice_totals.py::test_rejects_negative_quantity
```

**Bad examples:**

```bash
npm test
```

This is too broad for a focused lane if it hides which behavior drove the
change.

```bash
npm test -- --updateSnapshot
```

This is not proof unless the snapshot change was reviewed as the intended
behavior.

---

## Smoke Lane

Smoke tests are a small, curated set of high-value checks that answer: "Is the
product basically alive?"

**Use when:**

- Before handing work back to a user
- Before opening or merging a PR
- After building or deploying
- Before running expensive full suites

**Include:**

- One or two primary user journeys
- Startup/import/bootstrap checks
- Critical write/read loops
- Core authentication or authorization path when the app has one
- One representative integration with important dependencies

**Exclude:**

- Exhaustive edge cases
- Full browser/device matrices
- Long-running performance workloads
- Tests that require fragile shared state

**Good smoke suite:**

```text
- App starts
- User signs in
- User creates the central resource
- User reloads and sees the resource
- Health endpoint returns OK
```

**Bad smoke suite:**

```text
- Every checkout edge case
- Every supported browser and locale
- Every admin flow
- Full load test
```

That is a regression or release suite, not smoke.

**Smoke failure rule:** treat a smoke failure as a stop signal. Either fix it,
prove the test is wrong, or explicitly record why the product is intentionally
not smoke-green.

---

## Live-Fire Lane

Live-fire tests run against real or production-like boundaries. They are useful
because high-fidelity tests catch configuration, packaging, credential,
network, permission, and provider behavior that hermetic tests miss.

**Use when the risk is at the boundary:**

- Real third-party APIs
- Real auth providers
- Real queues, webhooks, storage, browsers, CLIs, or installed packages
- Production-like config, routing, permissions, or infrastructure
- Installed behavior in a real project workspace

**Do not run live-fire tests by default when they can:**

- Spend money
- Send email, texts, webhooks, or customer-visible notifications
- Modify production data
- Depend on rate-limited or flaky external services
- Require secrets unavailable in normal CI

**Required guardrails:**

- Opt-in command or tag, never hidden inside the default unit suite
- Dedicated test accounts, projects, tenants, or sandboxes
- Clear cleanup strategy
- Idempotent setup where possible
- Explicit cost and side-effect notes
- Separate failure triage for "product failed" vs "environment unavailable"

**Good live-fire evidence:**

```text
Live-fire: PASS
Environment: staging
Account: test tenant
Side effects: created and deleted one test resource
Cost: none expected
Cleanup: confirmed
```

**Bad live-fire evidence:**

```text
Ran live tests. One failed but probably network.
```

That does not say what environment ran, what changed, or whether cleanup
happened.

---

## Release Lane

Release tests prove that the artifact users receive works, not just that source
code passes tests.

**Use before:**

- Publishing a package
- Cutting a binary or container image
- Deploying a build to production
- Shipping a plugin, extension, CLI, SDK, or template bundle

**Common release checks:**

- Build from a clean checkout
- Install the packaged artifact into a temporary project
- Run the public CLI or API entrypoint
- Verify package exports, file inclusion, and executable permissions
- Verify peer dependency and engine compatibility
- Run the smoke suite against the built artifact
- Validate generated assets are present and usable

**Good release check:**

```bash
npm pack
tmp=$(mktemp -d)
cd "$tmp"
npm init -y
npm install /path/to/package.tgz
npx your-cli --version
npx your-cli init --dry-run
```

**Bad release check:**

```bash
npm test
```

Source tests can pass while the published package is missing files, exports, or
runtime permissions.

---

## Migration Lane

Migration tests prove that existing users can upgrade safely.

**Use when changing:**

- Data schema
- Config file format
- File layout
- Generated code or templates
- Package names, exports, or command names
- Storage, cache, or queue semantics
- Authentication or authorization policy

**Test fixtures should include:**

- Current version state
- Previous supported version state
- Partially customized state
- Missing optional files
- Unknown future fields
- Corrupt or invalid state with expected recovery behavior

**Core assertions:**

- User-owned data is preserved
- Generated or managed data updates correctly
- The migration is idempotent
- Rollback or retry behavior is clear
- Warnings are actionable

**Good migration test names:**

```text
preserves_user_edits_when_upgrading_config
adds_missing_managed_files_without_deleting_custom_files
rerunning_migration_after_partial_failure_is_safe
```

**Bad migration test name:**

```text
migration works
```

It does not identify the user value or failure mode.

---

## Static Gates

Static gates do not run product behavior. They inspect source, generated files,
types, dependency graphs, formatting, or policy rules.

**Common static gates:**

- Typecheck
- Lint
- Format check
- Markdown or documentation lint
- Gherkin lint
- Dependency graph validation
- Dead-code detection
- Security/static analysis
- Package metadata validation

**Use static gates to catch:**

- Type and API mismatches
- Invalid generated files
- Broken documentation syntax
- Unsafe dependency edges
- Missing package metadata
- Policy violations that do not require runtime execution

**Do not use static gates as a substitute for behavior tests.**

```text
Typecheck passing means the program is type-compatible.
It does not mean the user workflow works.
```

---

## Slow and Performance Lane

Slow/performance tests prove behavior that is too expensive for routine local
or per-commit feedback.

**Use when testing:**

- Large datasets
- Long-running jobs
- Concurrency, retries, and backpressure
- Load, latency, memory, or throughput
- Cross-browser/device/locale matrices
- Full regression suites

**Required metadata:**

- Expected runtime
- Resource requirements
- What metric fails the test
- How to reproduce locally or in CI
- Owner or escalation path

**Good performance assertion:**

```text
95th percentile response time stays under 300 ms for 500 requests/minute
with the standard test dataset.
```

**Bad performance assertion:**

```text
App should be fast.
```

That cannot fail deterministically.

---

## CI Cadence

Use this default cadence unless the project has a stronger local convention.

| Event             | Recommended Lanes                   |
| ----------------- | ----------------------------------- |
| During coding     | Focused                             |
| Before handoff    | Focused + relevant static gates     |
| Pull request      | Static gates + smoke + affected BDD |
| Before release    | Release + migration + full smoke    |
| Scheduled nightly | Slow/performance + broader matrices |
| Manual high-risk  | Live-fire                           |
| After deployment  | Smoke + selected live-fire health   |

**Tie-breaker:** move a lane earlier only when the failure is cheap to diagnose
there. Expensive checks that frequently fail for environmental reasons belong
later, with clearer ownership and artifacts.

---

## Failure Triage

Classify the failure before fixing.

| Failure Type              | First Action                                      |
| ------------------------- | ------------------------------------------------- |
| Product behavior changed  | Fix implementation or update requirements         |
| Test assertion is wrong   | Explain and get approval before changing the test |
| Environment unavailable   | Record outage evidence and retry once             |
| Fixture drift             | Repair fixture or add migration coverage          |
| Flaky timing              | Replace sleeps with condition-based waits         |
| External provider changed | Decide whether to adapt, pin, mock, or escalate   |

Never skip, weaken, or delete tests just to pass a lane. If the lane is too
expensive or noisy, change its cadence or ownership deliberately.

---

## Project Documentation

Each project should document its local lanes in `tests/SAFEWORD.md`,
`tests/AGENTS.md`, or the nearest existing testing documentation.

Include:

- Lane names and commands
- What each lane proves
- Cadence: local, PR, release, scheduled, manual
- Required secrets or services
- Expected runtime
- Owners for live-fire, release, migration, and slow lanes
- Cleanup and side-effect rules
- What evidence to include when reporting results

Minimal template:

```markdown
# Test Lanes

| Lane      | Command                | Runs       | Proves             | Owner         |
| --------- | ---------------------- | ---------- | ------------------ | ------------- |
| Focused   | `npm test -- <file>`   | during TDD | touched behavior   | feature owner |
| Smoke     | `npm run test:smoke`   | PR         | core journeys      | app team      |
| Live-fire | `npm run test:live`    | manual     | real provider path | platform team |
| Release   | `npm run test:release` | release    | packaged artifact  | release owner |
```

---

## Key Takeaways

- Test type is about behavior scope; verification lane is about cadence and risk.
- Smoke is small and curated. It is not the full regression suite.
- Live-fire is opt-in and guarded because it touches real boundaries.
- Release tests prove the artifact users receive, not just source code.
- Migration tests protect existing users and customized state.
- Static gates are verification lanes, but they do not replace behavior tests.
