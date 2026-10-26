import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { inspect } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
import { VERSION } from '../../src/version.js';
import { realBunExecutable } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const roots: string[] = [];

function generatedSourceSnapshot() {
  return ['review', 'planning'].flatMap(directory => {
    const root = nodePath.join(packageRoot, 'src', directory);
    return readdirSync(root)
      .filter(file => file.endsWith('.generated.ts'))
      .map(file => {
        const path = nodePath.join(root, file);
        return { path, bytes: readFileSync(path), mtime: statSync(path).mtimeMs };
      });
  });
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

function approvingReviewer(agent: 'claude' | 'codex'): { bin: string; calls: string } {
  const bin = createTrustedReviewerDirectory('safeword-native-copy-reviewer-');
  const calls = nodePath.join(bin, 'calls.log');
  writeFileSync(
    nodePath.join(bin, agent),
    String.raw`#!${process.execPath}
const agent = ${JSON.stringify(agent)};
const capabilities = ${JSON.stringify(REVIEWER_CAPABILITIES[agent])};
if (process.argv.includes('--version')) { console.log(agent + ' 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(capabilities); process.exit(0); }
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  // Execution delivery metadata also has schema_version; select the root JSON line.
  const packet = JSON.parse(input.slice(input.lastIndexOf('\n{"schema_version":1') + 1));
  require('node:fs').appendFileSync(${JSON.stringify(calls)}, 'review' + String.fromCharCode(10));
  const result = {
    schema_version: 1, dispatch_id: packet.dispatch_id, evidence_records: { schema_version: 1, records: [] }, reviewer_agent: agent,
    verdict: 'approve', summary: 'Native copy fixture approval.', findings: [],
    ...(packet.kind === 'plan-execution' ? {
      planning_destination: 'plan-execution',
      execution_plan_record: {
        slicing_decision: 'one_pull_request', rationale: 'One coherent change.',
        slices: [{ name: 'Complete delivery', purpose: 'Deliver the reviewed plan.',
          boundary: 'The accepted CLI boundary.', prerequisites: [],
          proof: 'The installed CLI review passes.', completion_signal: 'The review is approved.',
          relies_on_unmerged_successor: false }],
        obligation_owners: [{ obligation: 'Accepted behavior', slices: ['Complete delivery'] }],
        decision_statuses: [{ decision: 'Keep the accepted approach.', status: 'unchanged' }],
        accepted_scenarios_covered: true, accepted_approach_preserved: true,
        normalized_plan_digest: packet.execution_plan_normalized_digest,
        delivery_definition: packet.execution_plan_delivery_definition
      }
    } : {})
  };
  process.stdout.write(JSON.stringify(agent === 'claude' ? { structured_output: result } : {
    type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(result) }
  }));
});
`,
    { mode: 0o755 },
  );
  return { bin, calls };
}

type NativePlanningPhase = 'product-plan' | 'plan-implementation' | 'plan-execution';

function nativeAssetAuthor(host: 'claude' | 'codex', phase: NativePlanningPhase) {
  // Execution admission currently permits only Claude reviewers. Preserve that
  // policy: this one layout check uses a Codex author, not Claude-host parity.
  return host === 'claude' && phase === 'plan-execution' ? 'codex' : host;
}

function writePhaseTicket(ticket: string, phase: NativePlanningPhase): void {
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    `---\nid: NAT123\ntype: feature\nphase: ${phase === 'product-plan' ? 'intake' : phase}\nstatus: in_progress\n${phase === 'product-plan' ? 'product_plan_contract: v1\n' : ''}---\n`,
  );
  writeFileSync(
    nodePath.join(ticket, 'spec.md'),
    phase === 'product-plan' ? PLANNING_ROLE_PRODUCT : '# Product Plan\n\nAccepted behavior.\n',
  );
  writeFileSync(
    nodePath.join(ticket, 'impl-plan.md'),
    '# Implementation Plan\n\nPreserve the accepted scope and implement its reviewed approach.\n',
  );
  if (phase !== 'plan-execution') return;
  const executionCase = EXECUTION_PLAN_CONFORMANCE_CASES.find(
    candidate => candidate.id === 'one-coherent-change',
  );
  if (executionCase === undefined) throw new Error('Missing canonical Execution Plan fixture');
  writeFileSync(nodePath.join(ticket, 'execution-plan.md'), executionCase.execution_plan);
  writeFileSync(nodePath.join(ticket, 'impl-plan.md'), executionCase.implementation_plan);
  writeFileSync(nodePath.join(ticket, 'behavior.feature'), executionCase.scenario);
}

describe('Complete native planning author-copy dispatch', () => {
  it.each(
    (['claude', 'codex'] as const).flatMap(host =>
      (['product-plan', 'plan-implementation', 'plan-execution'] as const).map(phase => ({
        host,
        phase,
      })),
    ),
  )(
    'uses final generated $host/$phase assets and blocks outside-rubric drift before reviewer launch',
    { timeout: 60_000 },
    ({ host, phase }) => {
      const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-native-copy-'));
      roots.push(root);
      const generated = nodePath.join(root, 'generated');
      if (host === 'claude') mkdirSync(generated);
      const project = nodePath.join(root, 'project');
      const ticket = nodePath.join(project, '.project/tickets/NAT123-native-copy');
      writePhaseTicket(ticket, phase);
      if (phase === 'product-plan') writePlanningInventories(project);
      const kind = phase === 'product-plan' ? 'quality-review' : phase;
      const target = {
        'product-plan': 'spec.md',
        'plan-implementation': 'impl-plan.md',
        'plan-execution': 'execution-plan.md',
      }[phase];
      const contexts =
        phase === 'plan-execution' ? ['impl-plan.md', 'behavior.feature'] : ['ticket.md'];
      const generatedSourcesBefore = generatedSourceSnapshot();
      const generation = spawnSync(
        'bun',
        [
          nodePath.join(packageRoot, 'scripts', `generate-${host}-plugin.ts`),
          ...(host === 'codex' ? ['--version', VERSION, '--output', generated] : []),
        ],
        {
          cwd: packageRoot,
          encoding: 'utf8',
          timeout: 30_000,
          env: {
            ...process.env,
            ...(host === 'claude' && { SAFEWORD_CLAUDE_GENERATED_PLUGIN_ROOT: generated }),
          },
        },
      );
      expect(generation.status, inspect(generation, { depth: 2, maxStringLength: Infinity })).toBe(
        0,
      );
      expect(
        generatedSourceSnapshot(),
        'native generation must not rewrite source contracts',
      ).toEqual(generatedSourcesBefore);
      // Copy only the native distribution; source templates cannot satisfy its lookup.
      const distribution = nodePath.join(root, 'installed-package');
      mkdirSync(distribution);
      for (const part of ['runtime', 'skills', 'package.json']) {
        cpSync(nodePath.join(generated, part), nodePath.join(distribution, part), {
          recursive: true,
        });
      }
      const author = nativeAssetAuthor(host, phase);
      const reviewerAgent = author === 'claude' ? 'codex' : 'claude';
      const reviewer = approvingReviewer(reviewerAgent);
      const bun = realBunExecutable();
      expect(bun, 'the isolated reviewer PATH needs an absolute Bun launcher').not.toBe('');
      const run = () =>
        spawnSync(
          bun,
          [
            nodePath.join(distribution, 'runtime/cli.js'),
            'review',
            'run',
            kind,
            `.project/tickets/NAT123-native-copy/${target}`,
            ...contexts.flatMap(path => [
              '--context',
              `.project/tickets/NAT123-native-copy/${path}`,
            ]),
            '--json',
            '--no-input',
            '--cwd',
            project,
          ],
          {
            cwd: project,
            encoding: 'utf8',
            timeout: 20_000,
            env: {
              HOME: nodePath.join(root, 'home'),
              CODEX_HOME: nodePath.join(root, 'codex-home'),
              PATH: `${reviewer.bin}:/usr/bin:/bin`,
              SAFEWORD_AGENT_RUNTIME: author,
              SAFEWORD_NO_UPDATE_CHECK: '1',
              SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, 'review-keys'),
              NODE_ENV: 'test',
            },
          },
        );
      const canonical = run();
      expect(canonical.status, inspect(canonical, { depth: 2, maxStringLength: Infinity })).toBe(0);
      expect(JSON.parse(canonical.stdout)).toMatchObject({
        data: {
          status: 'approved',
          review_kind: kind,
          author_agent: author,
          actual_reviewer: reviewerAgent,
          // These reviewer fakes provide no confirmed model provenance.
          independence: 'reduced',
        },
      });
      expect(readFileSync(reviewer.calls, 'utf8')).toBe('review\n');
      const template = {
        'product-plan': 'skills/bdd/DISCOVERY.md',
        'plan-implementation': 'skills/bdd/PLAN_IMPLEMENTATION.md',
        'plan-execution': 'skills/bdd/PLAN_EXECUTION.md',
      }[phase];
      const contractPath =
        host === 'claude'
          ? template
          : nodePath.join(nodePath.dirname(template), 'references', nodePath.basename(template));
      const asset = nodePath.join(distribution, contractPath);
      const original = readFileSync(asset);
      writeFileSync(
        asset,
        `<!-- Native copy drift outside the rubric -->\n${original.toString('utf8')}`,
      );
      const edited = run();
      expect(edited.status, inspect(edited, { depth: 2, maxStringLength: Infinity })).not.toBe(0);
      expect(JSON.parse(edited.stdout)).toMatchObject({
        data: { status: 'blocked' },
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: 'canonical_contract_copy_mismatch',
            metadata: { planning_phase: phase, contract_path: contractPath },
          }),
        ]),
      });
      expect(
        readFileSync(reviewer.calls, 'utf8'),
        'copy refusal must not launch the reviewer',
      ).toBe('review\n');
      rmSync(asset);
      const missing = run();
      expect(missing.status, inspect(missing, { depth: 2, maxStringLength: Infinity })).not.toBe(0);
      expect(JSON.parse(missing.stdout).data.status).toBe('blocked');
      expect(JSON.parse(missing.stdout).findings).toContainEqual(
        expect.objectContaining({
          code: 'missing_generated_contract_copy',
          metadata: { planning_phase: phase, contract_path: contractPath },
        }),
      );
      expect(readFileSync(reviewer.calls, 'utf8')).toBe('review\n');
      writeFileSync(asset, original);
      const restored = run();
      expect(restored.status, inspect(restored, { depth: 2, maxStringLength: Infinity })).toBe(0);
      expect(JSON.parse(restored.stdout).data.status).toBe('approved');
      expect(readFileSync(reviewer.calls, 'utf8')).toBe('review\nreview\n');
    },
  );
});
