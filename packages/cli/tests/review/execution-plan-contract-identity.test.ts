import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ReviewPacket, UnverifiedReviewerOutput } from '../../src/review/contract.js';
import {
  EXECUTION_PLAN_CONFORMANCE_CASES,
  executionPlanConformanceDigests,
} from '../../src/review/execution-plan-conformance.js';
import { EXECUTION_PLAN_REVIEW_RUBRIC } from '../../src/review/execution-plan-rubric.generated.js';
import { extractExecutionPlanReviewRubric } from '../../src/review/execution-plan-rubric.js';
import { assemblePlanContract } from '../../src/review/packet.js';
import { reviewPromptContract } from '../../src/review/review-rubric.js';
import { reconcilePlanContract } from '../../src/review/runtime.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const canonicalReference = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/bdd/PLAN_EXECUTION.md'),
  'utf8',
);
const canonicalRubric = extractExecutionPlanReviewRubric(canonicalReference);
const temporaryDirectories: string[] = [];
const approved: UnverifiedReviewerOutput = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  reviewer_agent: 'claude',
  verdict: 'approve',
  planning_destination: 'plan-execution',
  summary: 'approved',
  findings: [],
  execution_plan_record: {
    slicing_decision: 'one_pull_request',
    rationale: 'One coherent change.',
    slices: [],
    obligation_owners: [],
    decision_statuses: [],
  },
};

afterEach(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true });
  temporaryDirectories.length = 0;
  cleanupTrustedReviewerDirectories();
});

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function withoutStartability(rubric: string): string {
  const startability = rubric.indexOf('- **Startable steps:**');
  const followingObligation = rubric.indexOf('- **Dependency safety:**');
  return rubric.slice(0, startability) + rubric.slice(followingObligation);
}

function packet(authorRubric: string, reviewerRubric: string): ReviewPacket {
  return {
    schema_version: 1,
    dispatch_id: 'dispatch-1',
    kind: 'plan-execution',
    logical_files: [],
    plan_contract: assemblePlanContract(authorRubric, reviewerRubric),
  };
}

function patchInstalledReviewerRubric(distribution: string, rubric: string): void {
  const distribution_ = nodePath.join(distribution, 'dist');
  const declaration = /var EXECUTION_PLAN_REVIEW_RUBRIC = "(?:[^"\\]|\\.)*";/u;
  const module = readdirSync(distribution_)
    .filter(path => path.endsWith('.js'))
    .map(path => nodePath.join(distribution_, path))
    .find(path => declaration.test(readFileSync(path, 'utf8')));
  if (module === undefined) throw new Error('Installed reviewer rubric declaration was not found');
  const source = readFileSync(module, 'utf8');
  writeFileSync(
    module,
    source.replace(
      declaration,
      () => `var EXECUTION_PLAN_REVIEW_RUBRIC = ${JSON.stringify(rubric)};`,
    ),
  );
}

function patchInstalledDeliveryTaxonomy(distribution: string): void {
  const distribution_ = nodePath.join(distribution, 'dist');
  const declaration =
    /var EVIDENCE_CLASSES = \/\* @__PURE__ \*\/ new Set\(\[\s*"current_revision_real_boundary",\s*"reusable_earlier_revision",\s*"partial_or_structural",\s*"missing"\s*\]\);/u;
  const module = readdirSync(distribution_)
    .filter(path => path.endsWith('.js'))
    .map(path => nodePath.join(distribution_, path))
    .find(path => declaration.test(readFileSync(path, 'utf8')));
  if (module === undefined)
    throw new Error('Installed delivery taxonomy declaration was not found');
  const source = readFileSync(module, 'utf8');
  const patched = source.replace(declaration, matched =>
    matched.replace(
      '"current_revision_real_boundary",\n  "reusable_earlier_revision"',
      '"reusable_earlier_revision",\n  "current_revision_real_boundary"',
    ),
  );
  if (patched === source) throw new Error('Installed delivery taxonomy was not changed');
  writeFileSync(module, patched);
}

function retainInstalledRouteAdmission(distribution: string, rubric: string): void {
  const currentDigest = executionPlanConformanceDigests().contract_sha256;
  const contract = reviewPromptContract('plan-execution').replace(
    EXECUTION_PLAN_REVIEW_RUBRIC,
    () => rubric,
  );
  const fixtureDigest = createHash('sha256').update(contract).digest('hex');
  let replacements = 0;
  const entries = readdirSync(nodePath.join(distribution, 'dist'));
  for (const entry of entries) {
    if (!entry.endsWith('.js')) continue;
    const path = nodePath.join(distribution, 'dist', entry);
    const source = readFileSync(path, 'utf8');
    if (!source.includes(currentDigest)) continue;
    writeFileSync(
      path,
      source.replaceAll(currentDigest, () => fixtureDigest),
    );
    replacements += 1;
  }
  if (replacements !== 1) throw new Error('Installed reviewer admission identity was not unique');
}

function installApprovingReviewer(): string {
  const root = createTrustedReviewerDirectory('safeword-contract-identity-');
  const executable = nodePath.join(root, 'claude');
  writeFileSync(
    executable,
    String.raw`#!${process.execPath}
const capabilities = ${JSON.stringify(REVIEWER_CAPABILITIES.claude)};
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(capabilities); process.exit(0); }
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const start = input.lastIndexOf('\n{"schema_version":1');
  const packet = JSON.parse(input.slice(start + 1));
  const output = {
    schema_version: 1,
    dispatch_id: packet.dispatch_id,
    reviewer_agent: 'claude',
    verdict: 'approve',
    planning_destination: 'plan-execution',
    summary: 'approved',
    findings: [],
    execution_plan_record: {
      slicing_decision: 'one_pull_request',
      rationale: 'One coherent change.',
      slices: [{
        name: 'Complete delivery',
        purpose: 'Deliver the reviewed plan.',
        boundary: 'The accepted CLI boundary.',
        prerequisites: [],
        proof: 'The installed CLI review passes.',
        completion_signal: 'The review is approved.',
        relies_on_unmerged_successor: false
      }],
      obligation_owners: [{ obligation: 'Accepted behavior', slices: ['Complete delivery'] }],
      decision_statuses: [{ decision: 'Keep the accepted approach.', status: 'unchanged' }],
      accepted_scenarios_covered: true,
      accepted_approach_preserved: true,
      normalized_plan_digest: packet.execution_plan_normalized_digest,
      delivery_definition: packet.execution_plan_delivery_definition
    }
  };
  process.stdout.write(JSON.stringify({ structured_output: output }));
});
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return root;
}

type InstalledContractState =
  | 'canonical'
  | 'missing-author'
  | 'missing-reviewer'
  | 'stale-reviewer'
  | 'incomplete-pair'
  | 'stale-delivery-taxonomy';

function runInstalledReview(state: InstalledContractState) {
  const distribution = temporaryDirectory('safeword-contract-distribution-');
  cpSync(nodePath.join(packageRoot, 'dist'), nodePath.join(distribution, 'dist'), {
    recursive: true,
  });
  cpSync(nodePath.join(packageRoot, 'templates'), nodePath.join(distribution, 'templates'), {
    recursive: true,
  });
  cpSync(nodePath.join(packageRoot, 'package.json'), nodePath.join(distribution, 'package.json'));
  symlinkSync(
    nodePath.join(packageRoot, 'node_modules'),
    nodePath.join(distribution, 'node_modules'),
  );

  const installedAuthor = nodePath.join(distribution, 'templates/skills/bdd/PLAN_EXECUTION.md');
  switch (state) {
    case 'canonical': {
      break;
    }
    case 'missing-author': {
      rmSync(installedAuthor);
      break;
    }
    case 'missing-reviewer': {
      patchInstalledReviewerRubric(distribution, '');
      retainInstalledRouteAdmission(distribution, '');
      break;
    }
    case 'stale-reviewer': {
      const stale = `${canonicalRubric}\nStale reviewer-only text.`;
      patchInstalledReviewerRubric(distribution, stale);
      retainInstalledRouteAdmission(distribution, stale);

      break;
    }
    case 'incomplete-pair': {
      const incomplete = withoutStartability(canonicalRubric);
      writeFileSync(
        installedAuthor,
        canonicalReference.replace(canonicalRubric, () => incomplete),
      );
      patchInstalledReviewerRubric(distribution, incomplete);
      retainInstalledRouteAdmission(distribution, incomplete);

      break;
    }
    case 'stale-delivery-taxonomy': {
      patchInstalledDeliveryTaxonomy(distribution);
      break;
    }
  }

  const project = temporaryDirectory('safeword-contract-project-');
  const ticket = nodePath.join(project, '.project/tickets/T1-feature');
  mkdirSync(ticket, { recursive: true });
  const testCase = EXECUTION_PLAN_CONFORMANCE_CASES.find(
    candidate => candidate.id === 'one-coherent-change',
  );
  if (testCase === undefined) throw new Error('Missing canonical Execution Plan fixture');
  writeFileSync(nodePath.join(ticket, 'ticket.md'), '---\nid: T1\ntype: feature\n---\n');
  writeFileSync(nodePath.join(ticket, 'execution-plan.md'), testCase.execution_plan);
  writeFileSync(nodePath.join(ticket, 'impl-plan.md'), testCase.implementation_plan);
  writeFileSync(nodePath.join(ticket, 'behavior.feature'), testCase.scenario);
  const reviewer = installApprovingReviewer();

  return spawnSync(
    process.execPath,
    [
      nodePath.join(distribution, 'dist/cli.js'),
      'review',
      'run',
      'plan-execution',
      '.project/tickets/T1-feature/execution-plan.md',
      '--context',
      '.project/tickets/T1-feature/impl-plan.md',
      '--context',
      '.project/tickets/T1-feature/behavior.feature',
      '--json',
      '--no-input',
      '--cwd',
      project,
    ],
    {
      cwd: project,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PATH: `${reviewer}:/usr/bin:/bin`,
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_NO_UPDATE_CHECK: '1',
      },
    },
  );
}

describe('Execution Plan review-contract identity', () => {
  it.each([
    ['authoring', undefined, EXECUTION_PLAN_REVIEW_RUBRIC, 'authoring contract copy'],
    ['reviewer', canonicalRubric, undefined, 'generated reviewer contract copy'],
  ])('names a missing %s copy before review', (_copy, author, reviewer, expected) => {
    expect(() => assemblePlanContract(author, reviewer)).toThrow(expected);
  });

  it('names a stale generated reviewer copy even when the authoring copy is canonical', () => {
    const result = reconcilePlanContract(
      packet(canonicalRubric, `${EXECUTION_PLAN_REVIEW_RUBRIC}\nStale reviewer-only text.`),
      approved,
    );

    expect(result.verdict).toBe('request_changes');
    expect(result.execution_plan_record).toBeNull();
    expect(result.findings).toEqual([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('generated reviewer contract'),
      }),
    ]);
  });

  it('rejects matching version labels when both copies omit a canonical startability check', () => {
    const incomplete = withoutStartability(canonicalRubric);
    const result = reconcilePlanContract(packet(incomplete, incomplete), approved);

    expect(incomplete).not.toBe(canonicalRubric);
    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('canonical contract'),
      }),
    ]);
  });

  it('does not block review when both copies equal the packaged canonical bytes', () => {
    expect(EXECUTION_PLAN_REVIEW_RUBRIC).toBe(canonicalRubric);
    expect(reconcilePlanContract(packet(canonicalRubric, canonicalRubric), approved)).toBe(
      approved,
    );
  });

  it.each([
    ['missing-author', 'authoring contract copy'],
    ['missing-reviewer', 'generated reviewer contract copy'],
    ['stale-reviewer', 'stale generated reviewer contract'],
    ['incomplete-pair', 'canonical contract-byte identity'],
    ['stale-delivery-taxonomy', 'canonical delivery-contract identity'],
  ] as const)(
    'blocks %s through the installed CLI with the failed copy named',
    (state, expected) => {
      const result = runInstalledReview(state);
      const output = JSON.parse(result.stdout) as {
        errors?: { code: string; message: string }[];
        findings?: { code: string; message: string }[];
      };
      const messages = [...(output.errors ?? []), ...(output.findings ?? [])];

      expect(result.status).not.toBe(0);
      expect(
        messages.some(
          candidate => candidate.code.startsWith('REVIEW') && candidate.message.includes(expected),
        ),
      ).toBe(true);
    },
  );

  it('allows the packaged canonical pair through the installed CLI', () => {
    const result = runInstalledReview('canonical');

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      data: { status: 'approved', review_kind: 'plan-execution' },
    });
  });
});
