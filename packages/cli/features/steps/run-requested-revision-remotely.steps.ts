import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from '../../../../steps/world.js';
import { evaluateRemoteTestWorkflow } from '../../src/test-execution/remote-workflow-contract.js';
import {
  evaluateCancelledRequest,
  evaluateInvalidRevision,
  evaluateUnavailableRevision,
  evaluateUnsupportedLane,
  type RejectedRequestObservation,
  REMOTE_WORKFLOW_TEMPLATE,
  RemoteWorkflowHarness,
  type RemoteWorkflowObservation,
} from './support/remote-workflow-harness.js';

interface RemoteRevisionWorld extends SafewordWorld {
  contractCandidate?: string;
  contractResult?: { accepted: boolean; violations: string[] };
  requestedSha?: string;
  invalidRevision?: string;
  rejection?: Omit<RejectedRequestObservation, 'result'> & {
    result?: RejectedRequestObservation['result'];
  };
  unavailableSha?: string;
  unavailable?: RejectedRequestObservation;
  harness?: RemoteWorkflowHarness;
  observation?: RemoteWorkflowObservation;
  selectedLane?: string;
  executedLanes?: string[];
  divergent?: RejectedRequestObservation;
  reportedResult?: RemoteWorkflowObservation['result'];
  cancelledPhase?: 'validation' | 'checkout' | 'revision verification';
}

function bundledWorkflow(): string {
  return readFileSync(REMOTE_WORKFLOW_TEMPLATE, 'utf8');
}

function mutateWorkflow(source: string, violation: string): string {
  switch (violation) {
    case 'declares no token permissions': {
      return source.replace(/permissions:\n {2}contents: read\n\n/u, '');
    }
    case 'grants repository write permission': {
      return source.replace('contents: read', 'contents: write');
    }
    case 'omits checkout': {
      return source.replace(
        / {6}- name: Check out requested revision[\s\S]*?(?= {6}- name: Verify)/u,
        '',
      );
    }
    case 'persists the checkout credential': {
      return source.replace('persist-credentials: false', 'persist-credentials: true');
    }
    case 'references checkout by a mutable version': {
      return source.replace(/actions\/checkout@[0-9a-f]{40}/u, 'actions/checkout@v7');
    }
    case 'references an additional remote action by a mutable version': {
      return source.replace(/actions\/setup-node@[0-9a-f]{40}/u, 'actions/setup-node@v7');
    }
    case 'passes a Safeword-provided secret to the job': {
      return source.replace(
        '    runs-on: ubuntu-latest',
        '    runs-on: ubuntu-latest\n    env:\n      SAFEWORD_TOKEN: ${{ secrets.SAFEWORD_TOKEN }}',
      );
    }
    default: {
      throw new Error(`Unknown workflow contract violation: ${violation}`);
    }
  }
}

Given('the bundled managed remote test workflow candidate', function (this: RemoteRevisionWorld) {
  this.contractCandidate = bundledWorkflow();
});

Given(/^a candidate remote test workflow (.+)$/, function (this: RemoteRevisionWorld, violation) {
  this.contractCandidate = mutateWorkflow(bundledWorkflow(), violation);
});

Given(
  /^a remote test request selects the (done|full) lane$/,
  function (this: RemoteRevisionWorld, lane: string) {
    this.selectedLane = lane;
    this.harness = new RemoteWorkflowHarness();
  },
);

Given(
  'checkout lands on a different commit than the valid requested SHA',
  function (this: RemoteRevisionWorld) {
    this.harness = new RemoteWorkflowHarness();
  },
);

Given(
  /^a valid remote test request is cancelled during (validation|checkout|revision verification)$/,
  function (this: RemoteRevisionWorld, phase: 'validation' | 'checkout' | 'revision verification') {
    this.cancelledPhase = phase;
  },
);

Given(
  'a remote test request selects the lane value {string}',
  function (this: RemoteRevisionWorld, lane: string) {
    this.selectedLane = lane;
  },
);

Given(
  'a remote test request names a full commit SHA unavailable to checkout',
  function (this: RemoteRevisionWorld) {
    this.unavailableSha = 'fedcba9876543210fedcba9876543210fedcba98';
  },
);

Given(
  /^a remote test request names (?!a valid full commit SHA|a full commit SHA unavailable)(.+)$/,
  function (this: RemoteRevisionWorld, invalidRevision: string) {
    this.invalidRevision = invalidRevision;
  },
);

After(function (this: RemoteRevisionWorld) {
  this.harness?.dispose();
});

Given(
  'a remote test request names a valid full commit SHA that is not a branch tip',
  function (this: RemoteRevisionWorld) {
    this.harness = new RemoteWorkflowHarness();
    this.requestedSha = this.harness.requestedSha;
  },
);

When(
  'the remote test job runs a test plan that {word}',
  function (this: RemoteRevisionWorld, behavior: string) {
    assert.ok(behavior === 'passes' || behavior === 'fails');
    assert.ok(this.harness);
    this.observation = this.harness.run(behavior);
  },
);

When('the remote test job evaluates the request', function (this: RemoteRevisionWorld) {
  if (this.invalidRevision !== undefined) {
    this.rejection = evaluateInvalidRevision(this.invalidRevision);
    return;
  }
  assert.notEqual(this.selectedLane, undefined);
  this.rejection = evaluateUnsupportedLane(this.selectedLane ?? '');
});

When('the remote test job attempts the request', function (this: RemoteRevisionWorld) {
  assert.ok(this.unavailableSha);
  this.unavailable = evaluateUnavailableRevision(this.unavailableSha);
});

When('the remote test job verifies the checkout', function (this: RemoteRevisionWorld) {
  assert.ok(this.harness);
  this.divergent = this.harness.runDivergentCheckout();
});

When('the remote test job reports the interrupted request', function (this: RemoteRevisionWorld) {
  assert.ok(this.cancelledPhase);
  this.reportedResult = evaluateCancelledRequest(this.cancelledPhase);
});

When('the remote test job executes the request', function (this: RemoteRevisionWorld) {
  assert.ok(this.selectedLane);
  assert.ok(this.selectedLane === 'done' || this.selectedLane === 'full');
  assert.ok(this.harness);
  this.executedLanes = this.harness.run('passes', this.selectedLane).executedLanes;
});

When('the runner contract evaluates the candidate', function (this: RemoteRevisionWorld) {
  assert.ok(this.contractCandidate);
  this.contractResult = evaluateRemoteTestWorkflow(this.contractCandidate);
});

Then(
  'the requested SHA, observed checkout ref, and reported revision are identical',
  function (this: RemoteRevisionWorld) {
    assert.ok(this.observation);
    assert.equal(this.observation.requestedSha, this.requestedSha);
    assert.equal(this.observation.checkoutRef, this.requestedSha);
    assert.equal(this.observation.result.observed_sha, this.requestedSha);
  },
);

Then('no repository checkout or test command runs', function (this: RemoteRevisionWorld) {
  assert.equal(this.rejection?.checkoutCount, 0);
  assert.equal(this.rejection?.testCount, 0);
});

Then('the job fails without reporting a test result', function (this: RemoteRevisionWorld) {
  assert.ok(this.rejection?.result);
  assert.equal(this.rejection.result.status, 'rejected');
  assert.ok(!this.rejection.result.observed_sha);
});

Then(
  'the job fails without running tests or reporting a substitute revision',
  function (this: RemoteRevisionWorld) {
    assert.equal(this.unavailable?.checkoutCount, 1);
    assert.equal(this.unavailable?.testCount, 0);
    assert.equal(this.unavailable?.result.status, 'rejected');
    assert.equal(this.unavailable?.result.rejected_reason, 'checkout_unavailable');
    assert.equal(this.unavailable?.result.requested_sha, this.unavailableSha);
    assert.ok(!this.unavailable?.result.observed_sha);
  },
);

Then('the reported conclusion is {word}', function (this: RemoteRevisionWorld, conclusion: string) {
  assert.equal(this.observation?.result.status ?? this.reportedResult?.status, conclusion);
});

Then('no repository test command runs', function (this: RemoteRevisionWorld) {
  assert.equal(this.divergent?.testCount, 0);
});

Then('the result rejects the checkout with both commit SHAs', function (this: RemoteRevisionWorld) {
  const result = this.divergent?.result;
  assert.equal(result?.status, 'rejected');
  assert.equal(result?.rejected_reason, 'head_mismatch');
  assert.ok(result?.requested_sha);
  assert.ok(result.observed_sha);
  assert.notEqual(result.requested_sha, result.observed_sha);
});

Then('the result has no rejection reason', function (this: RemoteRevisionWorld) {
  assert.ok(this.reportedResult);
  assert.ok(!this.reportedResult.rejected_reason);
});

Then(
  /^the (done|full) Safeword test-plan lane runs$/,
  function (this: RemoteRevisionWorld, lane: string) {
    assert.deepEqual(this.executedLanes, [lane]);
  },
);

Then('no other Safeword test-plan lane runs', function (this: RemoteRevisionWorld) {
  assert.deepEqual(this.executedLanes, [this.selectedLane]);
});

Then(
  'the candidate is accepted under the minimum runner contract',
  function (this: RemoteRevisionWorld) {
    assert.deepEqual(this.contractResult, { accepted: true, violations: [] });
  },
);

Then(
  'the candidate is rejected as outside the minimum runner contract',
  function (this: RemoteRevisionWorld) {
    assert.equal(this.contractResult?.accepted, false);
    assert.ok(this.contractResult.violations.length > 0);
  },
);
