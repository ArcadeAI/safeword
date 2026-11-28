import '../../../../../steps/world.js';

import assert from 'node:assert/strict';

import { Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from '../../../../../steps/world.js';
import hostReleases from '../../../src/lifecycle/host-releases.json' with { type: 'json' };
import { CodexWorkflowRuntimeActor } from '../../helpers/codex-workflow-runtime.js';

interface World extends SafewordWorld {
  internalWorkflowCaseId?: string;
  internalWorkflow?: CodexWorkflowRuntimeActor;
  internalWorkflowArms?: { arm: 'defective' | 'covered'; actor: CodexWorkflowRuntimeActor }[];
}
function actor(world: World): CodexWorkflowRuntimeActor {
  assert.ok(world.internalWorkflow instanceof CodexWorkflowRuntimeActor);
  return world.internalWorkflow;
}
async function prepare(
  world: World,
  arm?: 'defective' | 'covered',
): Promise<CodexWorkflowRuntimeActor> {
  const parameters = world.parameters as {
    codexGuardFixtureFile?: string;
    codexProvisioningIdentityFile?: string;
  };
  assert.ok(
    parameters.codexGuardFixtureFile && parameters.codexProvisioningIdentityFile,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated provisioning required',
  );
  const instance = new CodexWorkflowRuntimeActor(
    parameters.codexGuardFixtureFile,
    parameters.codexProvisioningIdentityFile,
    { caseId: world.internalWorkflowCaseId ?? '', arm: arm ?? 'single' },
  );
  world.internalWorkflow = instance;
  if (arm) world.internalWorkflowArms?.push({ arm, actor: instance });
  await instance.prepareCanonical();
  return instance;
}

const escapedCodexVersion = hostReleases.codex.version.replaceAll(
  /[.*+?^${}()|[\]\\]/gu,
  String.raw`\$&`,
);
Given(
  // The only dynamic segment is checked-in release data with every regex metacharacter escaped.
  // eslint-disable-next-line security/detect-non-literal-regexp -- Checked-in release data is escaped above.
  new RegExp(
    `^native Codex ${escapedCodexVersion} has (?:an installed canonical internal testing workflow eligible for automatic invocation|the canonical manual-only explain workflow|the canonical public quality-review workflow with its existing testing resource reference|the generated internal workflow catalogue and its canonical referenced resources)$`,
    'u',
  ),
  { timeout: 600_000 },
  async function (this: World) {
    await prepare(this);
  },
);
Given('the project has an existing function needing boundary tests', function (this: World) {
  actor(this);
});
When(
  'the builder requests focused tests without naming a workflow or resource',
  { timeout: 300_000 },
  function (this: World) {
    actor(this).testOrdinary();
  },
);
Then(
  'the current installed testing procedure is loaded and the tests run successfully',
  function (this: World) {
    actor(this).assertTesting();
  },
);

Given(
  `a native Codex ${hostReleases.codex.version} thread previously loaded an internal testing procedure with its essential instructions`,
  { timeout: 900_000 },
  async function (this: World) {
    const instance = await prepare(this);
    instance.establishRestartThread();
    instance.assertTesting(true);
  },
);
Given(
  'the installed canonical procedure and essential instructions have been refreshed since that process ended',
  { timeout: 300_000 },
  async function (this: World) {
    await actor(this).refresh();
  },
);
When(
  'a new Codex process resumes the thread for another ordinary testing request',
  { timeout: 300_000 },
  function (this: World) {
    actor(this).resumeTesting();
  },
);
Then(
  'the current installed essential instructions are delivered in startup developer context before task tools and the requested tests run successfully',
  function (this: World) {
    actor(this).assertRefreshed();
  },
);

When(
  'the builder explicitly invokes explain through its public entrypoint',
  { timeout: 300_000 },
  function (this: World) {
    actor(this).invokePublic('explain');
  },
);
Then(
  'the installed explain procedure loads while remaining absent from automatic discovery',
  function (this: World) {
    actor(this).assertPublic('explain');
  },
);
Given(
  'the project has tests needing review for behavior and wiring coverage',
  function (this: World) {
    actor(this).seedReviewTests();
  },
);
When(
  'the builder invokes the public workflow and follows its existing testing resource reference',
  { timeout: 300_000 },
  function (this: World) {
    actor(this).invokePublic('quality-review');
  },
);
Then(
  'the public procedure and its referenced current installed internal testing procedure are loaded',
  function (this: World) {
    actor(this).assertPublic('quality-review');
  },
);

Given(
  `native Codex ${hostReleases.codex.version} has paired review projects with a wiring defect concealed by green isolated tests and a correctly wired real-collaborator control`,
  { timeout: 1_200_000 },
  async function (this: World) {
    this.internalWorkflowArms = [];
    for (const arm of ['defective', 'covered'] as const) {
      const instance = await prepare(this, arm);
      instance.prepareWiring(arm);
    }
  },
);
When(
  'the builder requests the normal public quality review for each project',
  { timeout: 900_000 },
  function (this: World) {
    const arms = this.internalWorkflowArms;
    assert.ok(arms?.length === 2);
    assert.ok(arms[0]);
    arms[0].actor.prepareWiringGrade();
    for (const { actor: instance } of arms) instance.reviewWiring();
  },
);
Then(
  "the review identifies the defective project's missing real-collaborator coverage with an actionable finding while accepting the covered control",
  { timeout: 900_000 },
  function (this: World) {
    const arms = this.internalWorkflowArms;
    assert.ok(arms?.length === 2);
    assert.ok(arms[0] && arms[1]);
    arms[0].actor.assertWiringPair(arms[1].actor);
  },
);

Given(
  `native Codex ${hostReleases.codex.version} has loaded an internal workflow with the normal shared guards active`,
  { timeout: 900_000 },
  async function (this: World) {
    const instance = await prepare(this);
    instance.testOrdinary();
    instance.assertTesting();
  },
);
Given('shared policy denies a ticket-file write', function (this: World) {
  actor(this).setWritePolicy('denied');
});
Given('shared policy permits an ordinary project-file write', function (this: World) {
  actor(this).setWritePolicy('allowed');
});
When(
  'the host attempts that write after reading the procedure',
  { timeout: 300_000 },
  function (this: World) {
    actor(this).attemptWrite();
  },
);
Then('the policy denial is reported and the ticket file is not created', function (this: World) {
  actor(this).assertWrite();
});
Then('the permitted file contains its requested content', function (this: World) {
  actor(this).assertWrite();
});

When(
  'those installed references are followed from a different working directory',
  { timeout: 120_000 },
  function (this: World) {
    actor(this).traverseClosure();
  },
);
Then(
  'the complete contracted resource closure resolves within that same installed package',
  function (this: World) {
    actor(this).assertClosure();
  },
);

Given(
  'a generated native Codex package is missing a canonical internal sibling reference',
  { timeout: 900_000 },
  async function (this: World) {
    const instance = await prepare(this);
    instance.prepareMissing();
  },
);
When(
  'the required generated catalogue and resource checks run',
  { timeout: 120_000 },
  function (this: World) {
    actor(this).checkMissing();
  },
);
Then(
  'they reject the incomplete package and identify the missing internal resource',
  function (this: World) {
    actor(this).assertMissing();
  },
);
