import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import {
  propagationLanes,
  type RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import {
  prepareNativePropagationInputs,
  prepareNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import { startReviewJob } from '../../src/review/job.js';
import {
  bundleInventory,
  codexWorkflowTemporaryBase,
} from '../helpers/codex-internal-workflows.js';
import { reviewedWorkflowPair, type WorkflowReview } from '../helpers/codex-reviewed-workflow.js';
import {
  ReviewedCodexPropagation,
  stageHeadlessCodexPropagation,
} from '../helpers/headless-codex-propagation.js';
import type { CanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { requirePropagationVerificationMarker } from '../helpers/propagation-source.js';

const revisionFiles = [
  'runtime/cli.js',
  'skills/explain/SKILL.md',
  'templates/hooks/lib/done-gate.ts',
];

const repo = path.resolve(import.meta.dirname, '../../../..');

afterEach(() => vi.unstubAllEnvs());

async function approveStagedPairs(
  staged: ReturnType<typeof stageHeadlessCodexPropagation>,
  fixture: ConstructorParameters<typeof ReviewedCodexPropagation>[0],
  run: string,
) {
  const pairs: WorkflowReview[] = [];
  const verified = [];
  for (const { caseId, arm, manifest, coordinator, project: cwd, reviews } of staged) {
    vi.stubEnv('SAFEWORD_PLUGIN_CLI', coordinator);
    const approvals = [];
    for (const { targets, context } of reviews) {
      const outcome = await startReviewJob({ cwd, kind: 'quality-review', targets, context });
      expect(outcome.data, JSON.stringify(outcome.findings)).toMatchObject({
        status: 'approved',
      });
      approvals.push((outcome.data as { review_id: string }).review_id);
    }
    const [reviewId, rawDeltaReviewId] = approvals;
    assert.ok(reviewId && rawDeltaReviewId);
    const review = { caseId, arm, manifest, reviewId, rawDeltaReviewId };
    verified.push(reviewedWorkflowPair(fixture, review, run));
    pairs.push(review);
  }
  return { pairs, verified };
}

async function exerciseRevisions(
  actor: RetainedPolicyActor,
  revisions: readonly CanonicalCatalogueInputs[],
  stages: ({ inventory: string } | undefined)[],
  fault: 'approved' | 'installed drift' | 'disabled hook',
  { calls, disabled }: { calls: string; disabled: string },
) {
  const readCalls = () =>
    readFileSync(calls, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
  let installation: string | undefined;
  for (const [index, inputs] of revisions.entries()) {
    if (index > 0) await actor.refreshResources(inputs);
    const stage = stages[index];
    assert.ok(stage);
    const inventory = JSON.parse(readFileSync(stage.inventory, 'utf8'));
    if (index === 1 && fault !== 'approved') {
      assert.ok(installation);
      const [installed] = JSON.parse(installation) as [string, string];
      if (fault === 'installed drift')
        appendFileSync(path.join(installed, 'runtime/cli.js'), '\n// drift\n');
      else writeFileSync(disabled, '');
      await expect(actor.observe()).rejects.toThrow(
        fault === 'installed drift'
          ? 'installed tree differs'
          : 'isolated workflow: disabled event',
      );
      expect(readCalls().filter(row => row.kind === 'model')).toHaveLength(1);
      return;
    }
    const observed = await actor.observe();
    installation ??= observed.installation;
    expect(observed.installation).toBe(installation);
    const [installed] = JSON.parse(observed.installation) as [string, string];
    expect(bundleInventory(installed)).toEqual(inventory);
    expect(observed.markers).toEqual({
      workflowMarker: inputs.workflowMarker,
      guideMarker: inputs.guideMarker,
      helperMarker: inputs.helperMarker,
    });
    const entries = readCalls();
    expect(entries).toHaveLength((index + 1) * 2);
    const [bindings, model] = entries.slice(-2);
    const revision = revisionFiles.map(file => inventory[file]);
    expect(bindings).toMatchObject({ kind: 'bindings', installed, revision });
    expect(model).toMatchObject({ kind: 'model', installed, revision });
    expect(bindings.hooks).toHaveLength(5);
    expect(
      bindings.hooks.every(
        (hook: { enabled: boolean; trustStatus: string }) =>
          hook.enabled && hook.trustStatus === 'untrusted',
      ),
    ).toBe(true);
    expect(model.args).toContain('--dangerously-bypass-hook-trust');
    expect(model.args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
  }
}

// Integration boundary: the retained native actor, generator, capture and
// authenticated review reader run for real. Only the vendor and reviewer are synthetic.
it.each([
  'approved',
  'missing approval',
  'unequal middle',
  'installed drift',
  'disabled hook',
] as const)(
  'checks reviewed headless propagation with %s',
  async fault => {
    const root = mkdtempSync(path.join(codexWorkflowTemporaryBase(), 'codex-guard-headless-'));
    try {
      const profile = path.join(root, 'profile');
      const project = path.join(root, 'project');
      const installedPath = path.join(profile, 'plugins/cache/candidate');
      cpSync(path.join(repo, 'packages/cli/codex-plugin'), installedPath, { recursive: true });
      mkdirSync(project);
      writeFileSync(path.join(profile, 'config.toml'), '');
      writeFileSync(path.join(profile, 'auth.json'), '{}');
      const calls = path.join(root, 'calls.jsonl');
      const disabled = path.join(root, 'disabled');
      const binary = path.join(root, 'vendor');
      writeFileSync(
        binary,
        String.raw`#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const args = process.argv.slice(2), profile = process.env.CODEX_HOME;
const installed = path.join(profile, 'plugins/cache/candidate');
const runtime = path.join(installed, 'runtime/cli.js');
const record = (kind, extra) => {
  const revision = ${JSON.stringify(revisionFiles)}.map(file => createHash('sha256').update(fs.readFileSync(path.join(installed, file))).digest('hex'));
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({kind, revision, installed, ...extra})+'\n');
};
if (args.includes('--version')) console.log('codex-cli 0.167.0');
else if (args.includes('marketplace')) console.log('{}');
else if (args.includes('plugin') && args.includes('add')) {
  const root = path.dirname(profile);
  const registry = JSON.parse(fs.readFileSync(path.join(root, '.agents/plugins/marketplace.json')));
  fs.rmSync(installed, { recursive: true, force: true });
  fs.cpSync(path.resolve(root, registry.plugins[0].source.path), installed, { recursive: true });
  console.log(JSON.stringify({ installedPath: installed }));
} else if (args.includes('app-server')) {
  require('node:readline').createInterface({input: process.stdin}).on('line', line => {
    const { id } = JSON.parse(line);
    if (id === 1) console.log(JSON.stringify({ id, result: {} }));
    if (id === 2) {
      const hooks = ['sessionStart','userPromptSubmit','preToolUse','postToolUse','stop'].map(
        eventName => ({eventName, enabled: eventName !== 'stop' || !fs.existsSync(${JSON.stringify(disabled)}), sourcePath: path.join(installed,'hooks.json'), trustStatus:'untrusted'}));
      record('bindings', {hooks});
      console.log(JSON.stringify({ id, result: {data: [{errors: [], warnings: [], hooks}]} }));
    }
  });
} else if (args.includes('exec')) {
  record('model', {args});
  if (!args.includes('--dangerously-bypass-hook-trust')) process.exit(2);
  const helper = 'bun "'+runtime+'" project runtime audit-principle-trace';
  const executed = spawnSync('bun', [runtime, 'project', 'runtime', 'audit-principle-trace'], {encoding:'utf8'});
  if (executed.status !== 0) throw Error(executed.stderr);
  console.log(JSON.stringify({type:'item.completed',item:{type:'command_execution',command:"sh -c '"+helper+"'",aggregated_output:executed.stdout,exit_code:0}}));
  console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:fs.readFileSync(path.join(installed,'skills/explain/SKILL.md'),'utf8')+fs.readFileSync(path.join(installed,'skills/explain/references/HOST_CONTRACT_GUIDE.md'),'utf8')}}));
  console.log(JSON.stringify({type:'turn.completed'}));
} else throw Error('Unexpected native request '+args);
`,
        { mode: 0o755 },
      );
      const worker = path.join(root, 'reviewer.mjs');
      const jobModule = path.join(repo, 'packages/cli/src/review/job.ts');
      const result = path.join(repo, 'packages/cli/src/cli-protocol/result.ts');
      const approve = `
import {completeReviewJob} from ${JSON.stringify(jobModule)};
import {createResult} from ${JSON.stringify(result)};
completeReviewJob(process.cwd(),process.env.SAFEWORD_REVIEW_JOB_ID,createResult({state:'healthy',data:{command:'review run',status:'approved',author_agent:'codex',actual_reviewer:'claude',independence:'cross-agent',reviewer_output:{schema_version:1,dispatch_id:'fixture-review',reviewer_agent:'claude',verdict:'approve',summary:'Staging control',findings:[]}}}));
`;
      writeFileSync(
        worker,
        `import {spawnSync} from 'node:child_process'; const child=spawnSync('bun',['--no-env-file','-e',${JSON.stringify(approve)}],{stdio:'inherit'}); process.exit(child.status??1);`,
      );
      const run = path.join(root, 'run');
      mkdirSync(run);
      const { previous, policy, current } = prepareNativePropagationInputs(run, true);
      assert.ok(policy);
      const fixture = { root, profile, project, installedPath, binary };
      const staged = stageHeadlessCodexPropagation(fixture, [previous, policy.inputs, current]);
      if (fault === 'unequal middle') {
        const alternateRoot = path.join(run, 'alternate');
        cpSync(previous.canonicalRoot, alternateRoot, { recursive: true });
        const alternate = { ...policy.inputs, canonicalRoot: alternateRoot };
        requirePropagationVerificationMarker(alternate, `VERIFICATION_${randomUUID()}`);
        const different = stageHeadlessCodexPropagation(fixture, [previous, alternate, current])[1];
        assert.ok(different);
        staged[1] = different;
      }
      vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'review-keys'));
      vi.stubEnv('XDG_STATE_HOME', path.join(root, 'review-keys'));
      vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
      const { pairs, verified } = await approveStagedPairs(staged, fixture, run);

      const open = () => new ReviewedCodexPropagation(fixture, pairs, run);
      if (fault === 'missing approval' || fault === 'unequal middle') {
        if (fault === 'missing approval') {
          const pair = pairs[1];
          assert.ok(pair);
          pairs[1] = { ...pair, rawDeltaReviewId: '' };
        }
        expect(open).toThrow(
          fault === 'missing approval' ? 'propagation approval missing' : 'middle revision differs',
        );
        expect(existsSync(calls)).toBe(false);
        return;
      }

      const execution = open();
      const lane = propagationLanes({ headless: true }).find(row => row.agent === 'codex');
      assert.ok(lane);
      const actor = await prepareNativeResourceActor(
        lane,
        execution.revisions[0],
        fixture,
        run,
        execution,
      );
      const [first, second] = verified;
      const stages = [first?.stages[0], first?.stages[1], second?.stages[1]];
      try {
        await exerciseRevisions(actor, execution.revisions, stages, fault, { calls, disabled });
      } finally {
        actor.close?.();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  180_000,
);
