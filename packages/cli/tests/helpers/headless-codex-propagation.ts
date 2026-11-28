import assert from 'node:assert/strict';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';

import { bundleInventory, nativeHooks } from './codex-internal-workflows.js';
import { assertCodexGuardFixture, type CodexGuardFixture } from './codex-native-continuation.js';
import {
  requireWorkflowBindings,
  reviewedWorkflowPair,
  type WorkflowReview,
  workflowReviewGroups,
} from './codex-reviewed-workflow.js';
import { stageWorkflowPair } from './codex-workflow-runtime.js';
import { createContractRepoFixture } from './contract-repo-fixture.js';
import {
  type CanonicalCatalogueInputs,
  observedCatalogueMarkers,
} from './native-catalogue-probe.js';

const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated workflow';
const propagationCase = 'headless-propagation';
const arms = ['previous-policy', 'policy-current'] as const;
export type PropagationRevisions = readonly [
  CanonicalCatalogueInputs,
  CanonicalCatalogueInputs,
  CanonicalCatalogueInputs,
];

function assertOwnedParent(fixture: CodexGuardFixture) {
  assertCodexGuardFixture(fixture);
  const author = process.env.CODEX_HOME ?? path.join(process.env.HOME ?? '', '.codex');
  assert.notEqual(
    fixture.profile,
    existsSync(author) ? realpathSync(author) : path.resolve(author),
    'CODEX_AUTHOR_PROFILE_REFUSED',
  );
}

export function stageHeadlessCodexPropagation(
  fixture: CodexGuardFixture,
  revisions: PropagationRevisions,
) {
  assertOwnedParent(fixture);
  const source = createContractRepoFixture({ generated: false });
  try {
    return arms.map((arm, index) => {
      const artifacts = mkdtempSync(path.join(fixture.root, 'internal-workflows-'));
      const profile = path.join(artifacts, 'generation-profile');
      mkdirSync(profile);
      const selection = { caseId: propagationCase, arm };
      const pair = stageWorkflowPair(
        fixture,
        artifacts,
        selection,
        label => {
          const revision = revisions[index + Number(label === 'B')];
          assert.ok(revision);
          cpSync(revision.canonicalRoot, path.join(source, 'packages/cli/templates'), {
            recursive: true,
          });
          return { source, revision };
        },
        profile,
      );
      return {
        ...selection,
        manifest: path.join(pair.project, 'staged-inputs.json'),
        coordinator: pair.coordinator,
        project: pair.project,
        reviews: workflowReviewGroups(pair),
      };
    });
  } finally {
    rmSync(path.dirname(source), { recursive: true, force: true });
  }
}

type Stage = ReturnType<typeof readStages>[number];

function readStages(fixture: CodexGuardFixture, pairs: WorkflowReview[], artifacts: string) {
  assert.deepEqual(
    pairs.map(({ caseId, arm }) => ({ caseId, arm })),
    arms.map(arm => ({ caseId: propagationCase, arm })),
    `${unavailable}: propagation approval pairs differ`,
  );
  const approvals = pairs.flatMap(pair => [pair.reviewId, pair.rawDeltaReviewId]);
  assert.ok(approvals.every(Boolean), `${unavailable}: propagation approval missing`);
  assert.equal(new Set(approvals).size, 4, `${unavailable}: propagation approvals duplicate`);
  const [first, second] = pairs.map(pair => reviewedWorkflowPair(fixture, pair, artifacts));
  const [previous, middle] = first?.stages ?? [];
  const [sameMiddle, current] = second?.stages ?? [];
  assert.ok(previous && middle && sameMiddle && current, unavailable);
  for (const key of ['inventory', 'inputs'] as const)
    assert.deepEqual(
      JSON.parse(readFileSync(middle[key], 'utf8')),
      JSON.parse(readFileSync(sameMiddle[key], 'utf8')),
      `${unavailable}: middle revision differs`,
    );
  return [previous, middle, current] as const;
}

/** Authority stays bound to one disposable parent, two approved pairs and one child installation. */
export class ReviewedCodexPropagation {
  private readonly initialStages: ReturnType<typeof readStages>;
  readonly revisions: PropagationRevisions;

  constructor(
    private readonly fixture: CodexGuardFixture,
    private readonly pairs: WorkflowReview[],
    private readonly artifacts: string,
  ) {
    assertOwnedParent(fixture);
    this.initialStages = readStages(fixture, pairs, artifacts);
    const revision = (stage: Stage): CanonicalCatalogueInputs => {
      const canonicalRoot = path.join(stage.source, 'packages/cli/templates');
      const markers = observedCatalogueMarkers(
        [
          'skills/explain/SKILL.md',
          'skills/explain/HOST_CONTRACT_GUIDE.md',
          'hooks/audit-principle-trace.ts',
        ]
          .map(file => readFileSync(path.join(canonicalRoot, file), 'utf8'))
          .join('\n'),
      );
      return { ...markers, canonicalRoot };
    };
    const [previous, policy, current] = this.initialStages;
    this.revisions = [revision(previous), revision(policy), revision(current)];
  }

  select(inputs: CanonicalCatalogueInputs): Stage {
    const index = this.revisions.findIndex(
      revision => revision.canonicalRoot === inputs.canonicalRoot,
    );
    assert.ok(index !== -1, `${unavailable}: selected propagation revision differs`);
    const stage = readStages(this.fixture, this.pairs, this.artifacts)[index];
    assert.ok(stage);
    assert.deepEqual(stage, this.initialStages[index], `${unavailable}: selected revision changed`);
    return stage;
  }

  async modelArguments(
    inputs: CanonicalCatalogueInputs,
    candidate: string,
    child: CodexGuardFixture,
  ): Promise<string[]> {
    const stage = this.select(inputs);
    assertCodexGuardFixture(child);
    assert.ok(child.root.startsWith(`${this.fixture.root}/`), `${unavailable}: foreign child`);
    assert.equal(child.binary, this.fixture.binary, `${unavailable}: foreign binary`);
    const inventory = JSON.parse(readFileSync(stage.inventory, 'utf8'));
    const assertTrees = () => {
      assert.deepEqual(
        bundleInventory(candidate),
        inventory,
        `${unavailable}: candidate tree differs`,
      );
      assert.deepEqual(
        bundleInventory(child.installedPath),
        inventory,
        `${unavailable}: installed tree differs`,
      );
    };
    assertTrees();
    const hooks = await nativeHooks(child.binary, child.profile, child.project);
    appendFileSync(
      path.join(this.artifacts, 'codex-native-bindings.jsonl'),
      `${JSON.stringify({
        revision: stage.inventory,
        installed: child.installedPath,
        project: child.project,
        runtimeSha256: inventory['runtime/cli.js'],
        hooks,
      })}\n`,
    );
    requireWorkflowBindings(hooks, child.installedPath);
    assertTrees();
    return ['--dangerously-bypass-hook-trust'];
  }
}
