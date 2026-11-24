import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { appendDesignDecision, readDeliveryProof } from '../../src/review/approval-ledger.js';
import {
  admitThroughInstalledCli,
  executionPlan,
  featureFixture,
  installReviewer,
} from '../fixtures/delivery-cli.js';
import { assertTestCliFresh, runCli } from '../helpers.js';
import { cleanupTrustedReviewerDirectories } from '../review-fixtures.js';

const roots = new Set<string>();
const categories = [
  'outcome and scope',
  'resolved decisions',
  'dependency and pull-request decomposition',
  'testing',
  'data and compatibility',
  'monitoring and failure signals',
  'security and privacy',
  'rollout and rollback',
  'documentation',
  'ownership and human dependencies',
  'completion evidence',
];

function git(root: string, ...argv: string[]): string {
  return execFileSync('git', argv, { cwd: root, encoding: 'utf8' }).trim();
}

function planWithOnlyTestingApplicable(): string {
  return executionPlan()
    .split('\n')
    .map(line => {
      if (!/^\| item-\d+ \|/u.test(line) || line.startsWith('| item-4 |')) return line;
      return line.replace(
        '| contributor | proof | open | missing |  |  |',
        '| contributor |  | not_applicable | missing |  | No applicable work in this fixture. |',
      );
    })
    .join('\n');
}

async function fixture(plan = executionPlan(), designApprovalGate = false) {
  const root = featureFixture(designApprovalGate, 'implement', plan);
  roots.add(root);
  const planPath = nodePath.join(root, '.project/tickets/ABC123-feature/execution-plan.md');
  await admitThroughInstalledCli(root, undefined, designApprovalGate);
  writeFileSync(nodePath.join(root, '.gitignore'), '.safeword/state/\n.review-keys/\n');
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.name', 'Delivery Proof Test');
  git(root, 'config', 'user.email', 'proof@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'accepted fixture');
  const reviewer = installReviewer();
  async function invokeWithEnvironment(environment: Record<string, string>, ...argv: string[]) {
    const result = await runCli([...argv, '--json', '--no-input', '--cwd', root], {
      cwd: root,
      env: {
        NODE_ENV: 'test',
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_NO_UPDATE_CHECK: '1',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        PATH: `${reviewer}:/usr/bin:/bin`,
        ...environment,
      },
    });
    const output = JSON.parse(result.stdout);
    expect(output.errors, result.stdout).toEqual([]);
    return { exitCode: result.exitCode, output };
  }
  const invoke = (...argv: string[]) => invokeWithEnvironment({}, ...argv);
  return { root, planPath, invoke, invokeWithEnvironment };
}

type CliFixture = Awaited<ReturnType<typeof fixture>>;
type CompatibilityReview = 'approved' | 'denied' | 'not_requested';
type EvidenceKind =
  | 'current'
  | 'missing'
  | 'partial'
  | 'compatible earlier'
  | 'incompatible earlier'
  | 'partial earlier';

function withHumanDependency(plan: string, dependency = 'security-approval'): string {
  return plan.replace(
    /^\| item-11 .*$/mu,
    () =>
      `| item-11 | completion evidence | Deliver completion evidence. | human | | pending_human | missing | | ${dependency} |`,
  );
}

async function recordRemainingProofs(created: CliFixture, humanPending: boolean): Promise<void> {
  for (let index = 1; index <= categories.length; index += 1) {
    if (index === 4 || (index === 11 && humanPending)) continue;
    const result = await created.invoke(
      'ticket',
      'record-delivery-proof',
      'ABC123',
      `item-${index}`,
      'proof',
    );
    expect(result.exitCode, JSON.stringify(result.output)).toBe(0);
  }
}

async function makeEarlierProof(
  created: CliFixture,
  receipt: string,
  compatibility: CompatibilityReview,
): Promise<void> {
  git(created.root, 'add', '.project');
  git(created.root, 'commit', '--quiet', '-m', 'record proof');
  writeFileSync(nodePath.join(created.root, 'documentation.md'), '# Document unchanged behavior\n');
  git(created.root, 'add', 'documentation.md');
  git(created.root, 'commit', '--quiet', '-m', 'documentation delta');
  const stale = await created.invoke('ticket', 'delivery-checklist', 'ABC123');
  expect(stale.output.data.open_contributor_items).toContain('item-4');
  expect(
    stale.output.data.contributor_evidence.find(
      (item: { item_id: string }) => item.item_id === 'item-4',
    ),
  ).toMatchObject({ satisfied: false, limitations: expect.arrayContaining(['earlier_revision']) });
  if (compatibility === 'not_requested') return;
  if (compatibility === 'denied') {
    // The earlier passing run already marked this item complete; a denied reuse
    // must not let those old plan bytes satisfy the current boundary.
    expect(readFileSync(created.planPath, 'utf8')).toMatch(
      /^\| item-4 \| testing \|.*\| complete \|/mu,
    );
    const rejected = await created.invokeWithEnvironment(
      {
        SAFEWORD_REVIEW_FAKE_VERDICT: 'request_changes',
        SAFEWORD_REVIEW_FAKE_FINDING:
          'The earlier proof no longer establishes this boundary after the source delta.',
      },
      'ticket',
      'record-delivery-proof',
      'ABC123',
      'item-4',
      'proof',
      '--receipt',
      receipt,
      '--compatible-reason',
      'Request review of this earlier proof against the current source delta.',
      '--confirm-egress',
    );
    expect(rejected.exitCode, JSON.stringify(rejected.output)).toBe(2);
    expect(rejected.output.findings).toContainEqual(
      expect.objectContaining({ code: 'compatibility_review_denied' }),
    );
    expect(rejected.output.data).not.toHaveProperty('receipt_id');
    return;
  }
  const reused = await created.invoke(
    'ticket',
    'record-delivery-proof',
    'ABC123',
    'item-4',
    'proof',
    '--receipt',
    receipt,
    '--compatible-reason',
    'Documentation-only delta preserves the proof.',
    '--confirm-egress',
  );
  expect(reused.exitCode, JSON.stringify(reused.output)).toBe(0);
  expect(reused.output.data.evidence_class).toBe('reusable_earlier_revision');
}

const compatibilityByKind: Partial<Record<EvidenceKind, CompatibilityReview>> = {
  'compatible earlier': 'approved',
  'incompatible earlier': 'denied',
};

async function evidenceFixture(kind: EvidenceKind): Promise<CliFixture> {
  let plan = executionPlan();
  if (compatibilityByKind[kind] !== undefined)
    plan = plan.replace('current_required', 'compatible_earlier_allowed');
  else if (kind.startsWith('partial')) {
    const invocation = JSON.stringify({
      type: 'command',
      cwd: '.',
      argv: [process.execPath, '--version'],
    });
    plan = plan.replace(
      '\n\n## Delivery checklist',
      () =>
        `\n| supporting | command | unit | structural proof | partial_or_structural | current_required | ${invocation} |\n\n## Delivery checklist`,
    );
  }
  const humanPending = kind === 'current' || kind === 'compatible earlier';
  if (humanPending) plan = withHumanDependency(plan);
  const created = await fixture(plan);
  if (kind !== 'missing') {
    const recorded = await created.invoke(
      'ticket',
      'record-delivery-proof',
      'ABC123',
      'item-4',
      kind.startsWith('partial') ? 'supporting' : 'proof',
    );
    expect(recorded.exitCode, JSON.stringify(recorded.output)).toBe(0);
    expect(recorded.output.data.receipt_id).toEqual(expect.any(String));
    if (kind.startsWith('partial')) {
      // A hand-written complete claim must not upgrade the retained structural receipt.
      const original = readFileSync(created.planPath, 'utf8');
      const upgraded = original.replace(
        '| open | partial_or_structural |',
        '| complete | current_revision_real_boundary |',
      );
      expect(upgraded).not.toBe(original);
      writeFileSync(created.planPath, upgraded);
    }
    if (kind.includes('earlier')) {
      await makeEarlierProof(
        created,
        recorded.output.data.receipt_id,
        compatibilityByKind[kind] ?? 'not_requested',
      );
    }
  }
  await recordRemainingProofs(created, humanPending);
  return created;
}

const evidenceExpectations = {
  current: {
    evidence_class: 'current_revision_real_boundary',
    satisfied: true,
    limitations: [],
    readiness: 'ready_for_human_review',
  },
  missing: {
    evidence_class: 'missing',
    satisfied: false,
    limitations: ['missing'],
    readiness: 'contributor_work_incomplete',
  },
  partial: {
    evidence_class: 'partial_or_structural',
    satisfied: false,
    limitations: ['partial_or_structural'],
    readiness: 'contributor_work_incomplete',
  },
  'compatible earlier': {
    evidence_class: 'reusable_earlier_revision',
    satisfied: true,
    limitations: ['earlier_revision'],
    readiness: 'ready_for_human_review',
  },
  'partial earlier': {
    evidence_class: 'partial_or_structural',
    satisfied: false,
    limitations: ['partial_or_structural', 'earlier_revision'],
    readiness: 'contributor_work_incomplete',
  },
  'incompatible earlier': {
    evidence_class: 'partial_or_structural',
    satisfied: false,
    limitations: ['earlier_revision'],
    readiness: 'contributor_work_incomplete',
  },
} as const;

describe('Delivery Checklist installed command boundary', () => {
  beforeAll(assertTestCliFresh);
  afterEach(() => {
    cleanupTrustedReviewerDirectories();
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    roots.clear();
  });

  it('preserves command operands from Markdown through a recorded native proof', async () => {
    const operands = [
      '--test',
      'one',
      '--test',
      'two',
      '',
      ' ',
      String.raw`C:\tmp\report.json`,
      String.raw`\d+\|pipe`,
    ];
    const invocation = {
      type: 'command',
      cwd: '.',
      argv: [
        process.execPath,
        '-e',
        'process.stdout.write(JSON.stringify(process.argv.slice(1)))',
        '--',
        ...operands,
      ],
    };
    const original = JSON.stringify({
      type: 'command',
      cwd: '.',
      argv: [process.execPath, '--version'],
    });
    const encoded = JSON.stringify(invocation).replaceAll('|', String.raw`\|`);
    const plan = executionPlan()
      .replace(original, () => encoded)
      .replace('| public prerequisite |', '| native child argv transport |');
    const created = await fixture(plan);
    const recorded = await created.invoke(
      'ticket',
      'record-delivery-proof',
      'ABC123',
      'item-4',
      'proof',
    );
    expect(recorded.exitCode, JSON.stringify(recorded.output)).toBe(0);
    const expectedBytes = JSON.stringify(operands);
    const receipt = readDeliveryProof(
      nodePath.join(created.root, '.project/skill-invocations.log'),
      recorded.output.data.receipt_id,
    );
    expect(receipt).toMatchObject({
      method: 'command',
      outcome: 'passed',
      stdout: {
        bytes: Buffer.byteLength(expectedBytes),
        sha256: createHash('sha256').update(expectedBytes).digest('hex'),
      },
    });
    const state = await created.invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(state.output.data.contributor_evidence).toContainEqual(
      expect.objectContaining({
        item_id: 'item-4',
        evidence_class: 'current_revision_real_boundary',
        satisfied: true,
      }),
    );
    expect(state.output.data.merge_authorization).toBe('pending');
  });

  it('presents every default category through the installed CLI', async () => {
    const { invoke } = await fixture();
    const result = await invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(result.exitCode).toBe(2);
    expect(result.output.data).toHaveProperty('checklist_items');
    expect(
      result.output.data.checklist_items.map((item: { category: string }) => item.category),
    ).toEqual(categories);
    expect(result.output.data.open_contributor_items).toEqual(
      categories.map((_category, index) => `item-${index + 1}`),
    );
    expect(result.output.data.merge_authorization).toBe('pending');
  });

  it.each(['testing', 'completion evidence'])(
    'names missing %s with one repair through the installed CLI',
    async category => {
      const { planPath, invoke } = await fixture();
      const content = readFileSync(planPath, 'utf8')
        .split('\n')
        .filter(line => !line.includes(`| ${category} |`))
        .join('\n');
      writeFileSync(planPath, content);
      const result = await invoke('ticket', 'delivery-checklist', 'ABC123');
      expect(result.exitCode).toBe(2);
      expect(result.output.findings).toMatchObject([
        { code: 'missing_categories', message: expect.stringContaining(category) },
      ]);
      expect(result.output.recovery).toMatchObject([
        { command: expect.stringContaining('execution-plan.md') },
      ]);
      expect(result.output.recovery).toHaveLength(1);
      expect(readFileSync(planPath, 'utf8')).toBe(content);
      expect(result.output.data).not.toHaveProperty('readiness_state');
    },
  );

  it.each([
    ['not applicable', 'contributor', 'not_applicable', 'concrete reason'],
    ['pending human', 'human', 'pending_human', 'named human dependency'],
  ])(
    'rejects %s without its required detail through the installed CLI',
    async (_name, owner, disposition, detail) => {
      const created = await fixture();
      const invalidPlan = readFileSync(created.planPath, 'utf8').replace(
        '| item-4 | testing | Deliver testing. | contributor | proof | open | missing |  |  |',
        () => `| item-4 | testing | Deliver testing. | ${owner} | | ${disposition} | missing | | |`,
      );
      writeFileSync(created.planPath, invalidPlan);
      const ledgerPath = nodePath.join(created.root, '.project/skill-invocations.log');
      const ledger = readFileSync(ledgerPath, 'utf8');
      const denied = await created.invoke('ticket', 'delivery-checklist', 'ABC123');
      expect(denied.exitCode).toBe(2);
      expect(denied.output.findings).toMatchObject([
        { code: 'invalid_delivery_checklist', message: expect.stringContaining('item-4') },
      ]);
      expect(denied.output.findings[0].message).toContain(detail);
      expect(denied.output.recovery).toHaveLength(1);
      expect(denied.output.recovery[0]).toMatchObject({
        command: expect.stringContaining('execution-plan.md'),
        description: expect.stringContaining(detail),
      });
      expect(denied.output.data).not.toHaveProperty('readiness_state');
      expect(readFileSync(created.planPath, 'utf8')).toBe(invalidPlan);
      expect(readFileSync(ledgerPath, 'utf8')).toBe(ledger);
    },
  );

  it('rejects an applicability change after admission through the installed CLI', async () => {
    const created = await fixture();
    const before = await created.invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(before.output.data.open_contributor_items).toContain('item-9');
    const changed = readFileSync(created.planPath, 'utf8').replace(
      '| item-9 | documentation | Deliver documentation. | contributor | proof | open | missing |  |  |',
      '| item-9 | documentation | Deliver documentation. | contributor | | not_applicable | missing | | Existing coverage is sufficient. |',
    );
    writeFileSync(created.planPath, changed);
    const ledgerPath = nodePath.join(created.root, '.project/skill-invocations.log');
    const ledger = readFileSync(ledgerPath, 'utf8');
    const refused = await created.invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(refused.exitCode).toBe(2);
    expect(refused.output.findings).toMatchObject([{ code: 'review_required' }]);
    expect(refused.output.recovery).toHaveLength(1);
    expect(refused.output.recovery[0].command).toContain('review run plan-execution');
    expect(refused.output.data).not.toHaveProperty('readiness_state');
    expect(readFileSync(created.planPath, 'utf8')).toBe(changed);
    expect(readFileSync(ledgerPath, 'utf8')).toBe(ledger);
  });

  it('rejects a contributor human handoff through the installed CLI', async () => {
    const { root, planPath, invoke } = await fixture();
    const ledgerPath = nodePath.join(root, '.project/skill-invocations.log');
    const ledger = readFileSync(ledgerPath, 'utf8');
    const invalidPlan = readFileSync(planPath, 'utf8').replace(
      '| item-4 | testing | Deliver testing. | contributor | proof | open | missing |  |  |',
      '| item-4 | testing | Deliver testing. | contributor | proof | pending_human | missing |  | security-team |',
    );
    writeFileSync(planPath, invalidPlan);
    const result = await invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(result.exitCode).toBe(2);
    expect(result.output.findings).toMatchObject([
      {
        code: 'invalid_owner_disposition',
        message: expect.stringMatching(/contributor-owned.*complete.*proof/u),
      },
    ]);
    expect(result.output.recovery).toHaveLength(1);
    expect(result.output.data).not.toHaveProperty('readiness_state');
    expect(result.output.data).not.toHaveProperty('receipt_id');
    expect(readFileSync(planPath, 'utf8')).toBe(invalidPlan);
    const recording = await invoke('ticket', 'record-delivery-proof', 'ABC123', 'item-4', 'proof');
    expect(recording.exitCode).toBe(2);
    expect(recording.output.data).not.toHaveProperty('receipt_id');
    expect(recording.output.findings).toEqual(result.output.findings);
    expect(recording.output.recovery).toEqual(result.output.recovery);
    expect(readFileSync(planPath, 'utf8')).toBe(invalidPlan);
    expect(readFileSync(ledgerPath, 'utf8')).toBe(ledger);
  });

  it('names monitoring and documentation after recording testing through the installed CLI', async () => {
    const plan = planWithOnlyTestingApplicable()
      .split('\n')
      .map(line =>
        line.startsWith('| item-6 |') || line.startsWith('| item-9 |')
          ? line.replace(
              '| contributor |  | not_applicable | missing |  | No applicable work in this fixture. |',
              '| contributor | proof | open | missing |  |  |',
            )
          : line,
      )
      .join('\n');
    const { invoke } = await fixture(plan);
    const recorded = await invoke('ticket', 'record-delivery-proof', 'ABC123', 'item-4', 'proof');
    expect(recorded.exitCode).toBe(0);
    expect(recorded.output.data.next_open_obligation).toBe(
      'Deliver monitoring and failure signals.',
    );
    const readiness = await invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(readiness.exitCode).toBe(2);
    expect(readiness.output.data.readiness_state).toBe('contributor_work_incomplete');
    expect(readiness.output.data.open_contributor_items).toEqual(['item-6', 'item-9']);
    expect(readiness.output.data).toHaveProperty('checklist_items');
    expect(
      readiness.output.data.checklist_items
        .filter((item: { id: string }) => ['item-6', 'item-9'].includes(item.id))
        .map((item: { obligation: string }) => item.obligation),
    ).toEqual(['Deliver monitoring and failure signals.', 'Deliver documentation.']);
    expect(readiness.output.data.contributor_evidence).toContainEqual(
      expect.objectContaining({
        item_id: 'item-4',
        status: 'complete',
        evidence_class: 'current_revision_real_boundary',
      }),
    );
  });

  it.each([
    'current',
    'missing',
    'partial',
    'compatible earlier',
    'incompatible earlier',
    'partial earlier',
  ] as const)('records %s evidence through the installed CLI', async kind => {
    const { invoke } = await evidenceFixture(kind);
    const expected = evidenceExpectations[kind];
    const result = await invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(result.exitCode).toBe(2);
    expect(result.output.data.readiness_state).toBe(expected.readiness);
    expect(result.output.data.open_contributor_items).toEqual(expected.satisfied ? [] : ['item-4']);
    expect(
      result.output.data.contributor_evidence.find(
        (item: { item_id: string }) => item.item_id === 'item-4',
      ),
    ).toMatchObject({
      evidence_class: expected.evidence_class,
      satisfied: expected.satisfied,
      limitations: expected.limitations,
    });
    expect(result.output.data.pending_human_items).toEqual(expected.satisfied ? ['item-11'] : []);
    if (expected.satisfied)
      expect(result.output.data.human_dependencies).toContainEqual(
        expect.objectContaining({
          item_id: 'item-11',
          dependency: 'security-approval',
          status: 'pending',
        }),
      );
    expect(result.output.data.merge_authorization).toBe('pending');
  });

  it.each(['not applicable', 'human-owned'] as const)(
    'retains an honest %s disposition while updating proof through the installed CLI',
    async disposition => {
      const plan =
        disposition === 'human-owned'
          ? withHumanDependency(planWithOnlyTestingApplicable())
          : planWithOnlyTestingApplicable();
      const created = await fixture(plan);
      const expectedRow = plan
        .split('\n')
        .find(line =>
          line.startsWith(disposition === 'human-owned' ? '| item-11 |' : '| item-1 |'),
        );
      expect(expectedRow).toEqual(expect.any(String));
      const recorded = await created.invoke(
        'ticket',
        'record-delivery-proof',
        'ABC123',
        'item-4',
        'proof',
      );
      expect(recorded.exitCode).toBe(0);
      expect(readFileSync(created.planPath, 'utf8')).toContain(expectedRow);
      const state = await created.invoke('ticket', 'delivery-checklist', 'ABC123');
      expect(state.output.data.open_contributor_items).toEqual([]);
      if (disposition === 'human-owned') {
        expect(state.output.data.pending_human_items).toEqual(['item-11']);
        expect(state.output.data.human_dependencies).toContainEqual(
          expect.objectContaining({ dependency: 'security-approval', status: 'pending' }),
        );
      } else {
        expect(state.output.data.contributor_evidence).toContainEqual(
          expect.objectContaining({ item_id: 'item-1', status: 'not_applicable', satisfied: true }),
        );
        expect(expectedRow).toContain('No applicable work in this fixture.');
      }
    },
  );

  it('reports satisfied human approval without merge authority through the installed CLI', async () => {
    const digest = createHash('sha256').update('# Implementation Plan\n').digest('hex');
    const plan = withHumanDependency(
      planWithOnlyTestingApplicable(),
      `design-approval:ABC123:${digest}`,
    );
    const created = await fixture(plan, true);
    const recorded = await created.invoke(
      'ticket',
      'record-delivery-proof',
      'ABC123',
      'item-4',
      'proof',
    );
    expect(recorded.exitCode).toBe(0);
    expect(
      appendDesignDecision(nodePath.join(created.root, '.project/skill-invocations.log'), {
        ticket: 'ABC123',
        planDigest: digest,
        decision: 'approved',
        authorityRef: 'human:fixture',
      }),
    ).toEqual({ status: 'written' });
    const readiness = await created.invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(readiness.exitCode).toBe(2);
    expect(readiness.output.data).toMatchObject({
      readiness_state: 'human_approval_satisfied_merge_pending',
      pending_human_items: [],
      human_dependencies: [{ item_id: 'item-11', status: 'satisfied' }],
      merge_authorization: 'pending',
    });
  });

  it('keeps human approval pending when a contributor records proof through the installed CLI', async () => {
    const created = await fixture(withHumanDependency(planWithOnlyTestingApplicable()));
    const recorded = await created.invoke(
      'ticket',
      'record-delivery-proof',
      'ABC123',
      'item-4',
      'proof',
    );
    expect(recorded.exitCode).toBe(0);
    const before = readFileSync(created.planPath, 'utf8');
    const ledgerPath = nodePath.join(created.root, '.project/skill-invocations.log');
    const ledger = readFileSync(ledgerPath, 'utf8');
    const attempted = await created.invoke(
      'ticket',
      'record-delivery-proof',
      'ABC123',
      'item-11',
      'proof',
    );
    expect(attempted.exitCode).toBe(2);
    expect(attempted.output.findings).toMatchObject([{ code: 'human_owned_item' }]);
    expect(attempted.output.recovery).toMatchObject([{ requires_human: true }]);
    expect(readFileSync(created.planPath, 'utf8')).toBe(before);
    expect(readFileSync(ledgerPath, 'utf8')).toBe(ledger);
    const readiness = await created.invoke('ticket', 'delivery-checklist', 'ABC123');
    expect(readiness.output.data).toMatchObject({
      readiness_state: 'ready_for_human_review',
      pending_human_items: ['item-11'],
      merge_authorization: 'pending',
    });
  });
});
