import assert from 'node:assert/strict';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  createObserverCandidate,
  expectCompleteObservation,
  expectFixedRequestRefusal,
  type ObserverCandidate,
  type ObserverCommand,
  runObserverCli,
  runSubstitutedCommand,
} from '../../tests/fixtures/bounded-observation.js';
import {
  candidateBytes,
  candidateGit,
  currencyCandidate,
  expectRetainedBytes,
  type RetainedObserverProof,
  retainSuccessfulProof,
  verifyRetainedProof,
} from '../../tests/fixtures/bounded-observation-currency.js';
import {
  createRequiredOutcomeCandidate,
  expectNamedRequiredRecovery,
} from '../../tests/fixtures/bounded-observation-failures.js';
import {
  advancePausedCandidate,
  attemptBytes,
  disposePausedObservation,
  expectPassingReportOnFailedRunner,
  failedRunnerCandidate,
  finishObservation,
  type PausedObservation,
  pauseObservation,
  releaseObservation,
} from '../../tests/fixtures/bounded-observation-lifecycle.js';
import {
  createUnmappedDistribution,
  expectNamedUnmappedCase,
  runUnmappedDistribution,
  type UnmappedDistribution,
} from '../../tests/fixtures/bounded-observation-profile.js';

interface ObserverWorld {
  observerCandidate?: ObserverCandidate;
  observerResult?: ObserverCommand;
  observerRetained?: RetainedObserverProof;
  observerBefore?: string;
  observerAlteredReport?: Buffer;
  observerDistribution?: UnmappedDistribution;
  observerPaused?: PausedObservation;
  observerInterrupted?: ObserverCommand;
  observerInterruptedBytes?: Record<string, Buffer>;
}

Given(
  'the fixed local CLI execution is paused after identifying its committed candidate and inputs',
  { timeout: 900_000 },
  async function (this: ObserverWorld) {
    this.observerPaused = await pauseObservation();
    this.observerCandidate = this.observerPaused.candidate;
  },
);

When(
  'the candidate advances to another commit before the run finishes',
  { timeout: 900_000 },
  async function (this: ObserverWorld) {
    assert.ok(this.observerPaused);
    advancePausedCandidate(this.observerPaused);
    releaseObservation(this.observerPaused);
    this.observerResult = await finishObservation(this.observerPaused);
  },
);

Then(
  'the result names the changed candidate and asks for a new run on a stable committed candidate',
  function (this: ObserverWorld) {
    assert.ok(this.observerResult);
    const message = this.observerResult.output.errors?.map(error => error.message).join('\n') ?? '';
    assert.match(message, /Candidate advanced during execution/u);
    assert.match(message, /rerun on a stable committed candidate/u);
  },
);

Given(
  'a bound candidate whose fixed runner passes every required assertion but exits unsuccessfully',
  function (this: ObserverWorld) {
    this.observerCandidate = failedRunnerCandidate();
  },
);

Then(
  'the retained diagnostics name the runner failure and the corrective action',
  function (this: ObserverWorld) {
    assert.ok(this.observerResult);
    expectPassingReportOnFailedRunner(this.observerResult);
  },
);

Given(
  'an interrupted fixed-lane attempt has a retained nonempty failure diagnostic',
  { timeout: 900_000 },
  async function (this: ObserverWorld) {
    this.observerPaused = await pauseObservation();
    this.observerCandidate = this.observerPaused.candidate;
    assert.equal(this.observerPaused.child.kill('SIGTERM'), true);
    this.observerInterrupted = await finishObservation(this.observerPaused);
    assert.equal(this.observerInterrupted.exitCode, 2);
    assert.equal(this.observerInterrupted.output.data?.status, 'interrupted');
    this.observerInterruptedBytes = attemptBytes(this.observerInterrupted);
    assert.ok(this.observerInterruptedBytes['diagnostic.log']?.length);
    releaseObservation(this.observerPaused);
  },
);

When(
  'the maintainer retries the same clean committed candidate successfully through the Safeword CLI',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    this.observerResult = runObserverCli(this.observerCandidate, [
      'proof',
      'observe-bounded-delivery',
    ]);
    expectCompleteObservation(this.observerResult, this.observerCandidate);
  },
);

Then(
  'the new successful observation is retained as a distinct attempt',
  function (this: ObserverWorld) {
    assert.ok(this.observerResult);
    assert.ok(this.observerInterrupted);
    assert.notEqual(
      this.observerResult.output.data?.attempt_id,
      this.observerInterrupted.output.data?.attempt_id,
    );
  },
);

Then(
  'the same earlier interrupted attempt and its diagnostic remain readable byte-for-byte unchanged and do not verify as success',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerInterrupted);
    assert.ok(this.observerInterruptedBytes);
    assert.deepEqual(attemptBytes(this.observerInterrupted), this.observerInterruptedBytes);
    const id = this.observerInterrupted.output.data?.attempt_id;
    assert.ok(id);
    const verified = runObserverCli(this.observerCandidate, [
      'proof',
      'verify-bounded-delivery',
      id,
    ]);
    assert.equal(verified.exitCode, 2);
    assert.equal(verified.output.data?.current, false);
    assert.deepEqual(attemptBytes(this.observerInterrupted), this.observerInterruptedBytes);
  },
);

Given(
  'one of the 37 bounded delivery cases has no declared assertion mapping',
  function (this: ObserverWorld) {
    this.observerDistribution = createUnmappedDistribution();
    this.observerCandidate = this.observerDistribution.candidate;
  },
);

Then(
  'the result names the unmapped case and asks for a reviewed complete mapping',
  function (this: ObserverWorld) {
    assert.ok(this.observerDistribution);
    assert.ok(this.observerResult);
    expectNamedUnmappedCase(this.observerDistribution, this.observerResult);
  },
);

Given(
  'the original ledgers, receipts and all 33 deferred case identities are recorded',
  function (this: ObserverWorld) {
    this.observerCandidate = createObserverCandidate();
    this.observerBefore = candidateBytes(this.observerCandidate);
    const path = nodePath.join(
      this.observerCandidate.root,
      '.project/tickets/C7HCN7-prepare-bounded-completion-recovery/proof-inventory.json',
    );
    const inventory = JSON.parse(readFileSync(path, 'utf8')) as {
      historicalDeferrals: {
        status: string;
        owners: Record<string, number>;
        cases: { digest: string }[];
      };
    };
    assert.equal(inventory.historicalDeferrals.status, 'deferred-unverified');
    assert.equal(inventory.historicalDeferrals.cases.length, 33);
    assert.equal(new Set(inventory.historicalDeferrals.cases.map(row => row.digest)).size, 33);
    assert.deepEqual(inventory.historicalDeferrals.owners, {
      DRD65E: 1,
      FC33HK: 12,
      KKP2R3: 2,
      MCWV4B: 18,
    });
  },
);

When(
  'the fixed-lane observation succeeds through the Safeword CLI',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    this.observerResult = runObserverCli(this.observerCandidate, [
      'proof',
      'observe-bounded-delivery',
    ]);
    expectCompleteObservation(this.observerResult, this.observerCandidate);
  },
);

Then(
  'the result identifies execution evidence only without RED, certification or completion authority',
  function (this: ObserverWorld) {
    assert.ok(this.observerResult);
    assert.equal(this.observerResult.output.data?.authority, 'execution-only');
    assert.equal(this.observerResult.output.data.purpose, 'bounded-delivery-observation:v1');
  },
);

Then(
  'the original scopes, ledgers, receipts, deferred identities and ticket phases remain unchanged',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.equal(candidateBytes(this.observerCandidate), this.observerBefore);
    assert.equal(candidateGit(this.observerCandidate, ['status', '--porcelain']), '');
    assert.equal(
      existsSync(nodePath.join(this.observerCandidate.root, '.safeword/state/reviews')),
      false,
    );
  },
);

Given(
  'a clean committed candidate bound to the approved T3E4NS proof set',
  function (this: ObserverWorld) {
    this.observerCandidate = createObserverCandidate();
    this.observerBefore = candidateBytes(this.observerCandidate);
  },
);

Then(
  'the execution names exactly the approved proof set and candidate',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectCompleteObservation(this.observerResult, this.observerCandidate);
  },
);

Then("the original checkout's product inputs remain unchanged", function (this: ObserverWorld) {
  assert.ok(this.observerCandidate);
  assert.equal(candidateBytes(this.observerCandidate), this.observerBefore);
  assert.equal(candidateGit(this.observerCandidate, ['status', '--porcelain']), '');
});

Given(
  'the approved candidate has an uncommitted proof configuration change',
  function (this: ObserverWorld) {
    this.observerCandidate = createObserverCandidate();
    appendFileSync(
      nodePath.join(this.observerCandidate.root, 'packages/cli/vitest.base.ts'),
      '\n// Controlled uncommitted input.\n',
    );
    this.observerBefore = candidateBytes(this.observerCandidate);
  },
);

Then('no proof execution starts', function (this: ObserverWorld) {
  assert.ok(this.observerResult);
  assert.notEqual(this.observerResult.exitCode, 0, this.observerResult.stdout);
  const path = this.observerResult.output.data?.report_path;
  assert.ok(path, 'A preflight refusal retains an attempt and diagnostic');
  assert.equal(existsSync(path), false, 'No runner report may exist after preflight refusal');
  const diagnosticPath = nodePath.join(nodePath.dirname(path), 'diagnostic.log');
  const diagnostic = readFileSync(diagnosticPath, 'utf8');
  assert.equal(diagnostic.includes('preparing an independent committed clone'), false);
  assert.equal(diagnostic.includes('Running the fixed eleven-file lane'), false);
});

Then(
  'the result names the changed input and asks for a committed clean candidate',
  function (this: ObserverWorld) {
    assert.ok(this.observerResult);
    assert.ok(this.observerCandidate);
    const message = this.observerResult.output.errors?.map(error => error.message).join('\n') ?? '';
    assert.match(message, /Uncommitted input packages\/cli\/vitest\.base\.ts/u);
    assert.match(message, /commit or clean/iu);
    assert.equal(candidateBytes(this.observerCandidate), this.observerBefore);
  },
);

Given(
  /^a successful observation followed by (.+)$/u,
  function (this: ObserverWorld, change: string) {
    this.observerRetained = currencyCandidate(change);
    this.observerCandidate = this.observerRetained.candidate;
  },
);

When(
  'the maintainer verifies that observation through the Safeword CLI',
  function (this: ObserverWorld) {
    assert.ok(this.observerRetained);
    this.observerResult = verifyRetainedProof(this.observerRetained);
  },
);

Then(
  /^verification reports (stale evidence without current success|current successful execution)$/u,
  function (this: ObserverWorld, currency: string) {
    assert.ok(this.observerResult);
    const current = currency === 'current successful execution';
    assert.equal(this.observerResult.exitCode, current ? 0 : 2);
    assert.equal(this.observerResult.output.data?.current, current, this.observerResult.stdout);
  },
);

Then(
  /^the result (names the changed assertion source and requests an observation of the new committed candidate|names the changed scope and requests review of an updated shipped contract before another observation|explains that no new observation is needed for this bookkeeping change|explains that no new observation is needed for this audit-only output)$/u,
  function (this: ObserverWorld, action: string) {
    assert.ok(this.observerResult);
    const message = this.observerResult.output.errors?.map(error => error.message).join('\n') ?? '';
    if (action.startsWith('names the changed assertion')) {
      assert.match(
        message,
        /Changed input file:packages\/cli\/tests\/integration\/planning-scope-review\.test\.ts/u,
      );
    } else if (action.startsWith('names the changed scope')) {
      assert.match(message, /Changed accepted scope/iu);
      assert.match(message, /review an updated shipped contract/iu);
    } else {
      assert.equal(this.observerResult.output.ok, true);
      assert.equal(this.observerResult.output.errors?.length, 0);
      assert.equal(this.observerResult.output.next_actions?.length, 0);
    }
    if (action.startsWith('names')) {
      assert.ok(
        this.observerResult.output.next_actions?.some(
          next => next.command === 'safeword proof observe-bounded-delivery',
        ),
      );
    }
  },
);

Then('the original retained evidence remains readable', function (this: ObserverWorld) {
  assert.ok(this.observerRetained);
  expectRetainedBytes(this.observerRetained);
});

Given(
  'the retained report of an authentic successful observation has changed',
  function (this: ObserverWorld) {
    this.observerCandidate = createObserverCandidate();
    this.observerRetained = retainSuccessfulProof(this.observerCandidate);
    const path = this.observerRetained.observation.output.data?.report_path;
    assert.ok(path);
    appendFileSync(path, '\n');
    this.observerAlteredReport = readFileSync(path);
  },
);

Then('verification refuses the altered evidence', function (this: ObserverWorld) {
  assert.ok(this.observerResult);
  assert.equal(this.observerResult.exitCode, 2);
  const message = this.observerResult.output.errors?.map(error => error.message).join('\n') ?? '';
  assert.match(message, /Altered report or diagnostics/u);
});

Then(
  'the result asks for a new observation of the unchanged committed candidate',
  function (this: ObserverWorld) {
    assert.ok(this.observerRetained);
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    assert.ok(this.observerAlteredReport);
    assert.equal(
      candidateGit(this.observerCandidate, ['rev-parse', 'HEAD']),
      this.observerCandidate.commit,
    );
    assert.ok(
      this.observerResult.output.next_actions?.some(
        next => next.command === 'safeword proof observe-bounded-delivery',
      ),
    );
    expectRetainedBytes(this.observerRetained, this.observerAlteredReport);
  },
);

Given(
  /^a bound candidate whose fixed proof lane reports a required assertion as (absent from the report|skipped|failed)$/u,
  function (this: ObserverWorld, result: string) {
    const normalized = result === 'absent from the report' ? 'absent' : result;
    const outcome = (['absent', 'skipped', 'failed'] as const).find(item => item === normalized);
    assert.ok(outcome !== undefined);
    this.observerCandidate = createRequiredOutcomeCandidate(outcome);
  },
);

Then('no successful observation is issued', function (this: ObserverWorld) {
  assert.ok(this.observerResult);
  assert.notEqual(this.observerResult.exitCode, 0, this.observerResult.stdout);
  assert.equal(this.observerResult.exitCode, 2);
  assert.notEqual(this.observerResult.output.data?.status, 'observed');
});

Then(
  'the result names that assertion and the corrective rerun action',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectNamedRequiredRecovery(this.observerCandidate, this.observerResult);
  },
);

Given(
  'a clean bound candidate whose fixed lane has passing required assertions for all 37 delivery cases',
  function (this: ObserverWorld) {
    this.observerCandidate = createObserverCandidate();
  },
);

When(
  'the maintainer requests a local observation through the Safeword CLI',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    this.observerResult =
      this.observerDistribution === undefined
        ? runObserverCli(this.observerCandidate, ['proof', 'observe-bounded-delivery'])
        : runUnmappedDistribution(this.observerDistribution);
  },
);

Then(
  'the CLI returns a verifiable observation identifying its command, candidate, runtime, inputs and complete results',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectCompleteObservation(this.observerResult, this.observerCandidate);
    const id = this.observerResult.output.data?.attempt_id;
    assert.ok(id);
    const verified = runObserverCli(this.observerCandidate, [
      'proof',
      'verify-bounded-delivery',
      id,
    ]);
    assert.equal(verified.exitCode, 0, verified.stdout);
    assert.equal(verified.output.data?.current, true);
  },
);

Then(
  'the retained full report supports every declared required assertion',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectCompleteObservation(this.observerResult, this.observerCandidate);
  },
);

After({ timeout: 900_000 }, async function (this: ObserverWorld) {
  if (this.observerPaused === undefined) {
    this.observerCandidate?.dispose();
  } else {
    await disposePausedObservation(this.observerPaused);
  }
});

Given(
  'a request that substitutes a command for the fixed proof lane',
  function (this: ObserverWorld) {
    this.observerCandidate = createObserverCandidate();
  },
);

When(
  'the maintainer submits the observation request through the Safeword CLI',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    this.observerResult = runSubstitutedCommand(this.observerCandidate);
  },
);

Then('execution is refused before that command runs', function (this: ObserverWorld) {
  assert.ok(this.observerCandidate);
  assert.ok(this.observerResult);
  expectFixedRequestRefusal(this.observerResult, this.observerCandidate);
});

Then(
  'the result names the unsupported override and the fixed request to use',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectFixedRequestRefusal(this.observerResult, this.observerCandidate);
  },
);
