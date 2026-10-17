import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { findCommandDefinition } from '../../src/cli-protocol/catalog.js';
import {
  admitThroughInstalledCli,
  featureFixture,
  legacyFeatureFixture,
  rejectAdmittedScenarioReview,
} from '../fixtures/delivery-cli.js';
import { assertTestCliFresh, runCli } from '../helpers.js';
import { cleanupTrustedReviewerDirectories } from '../review-fixtures.js';

describe('delivery execution prerequisite', () => {
  beforeAll(assertTestCliFresh);

  afterEach(() => {
    cleanupTrustedReviewerDirectories();
  });

  it('is registered as a public observe-only CLI command', () => {
    expect(findCommandDefinition('ticket execution-prerequisite')).toMatchObject({
      name: 'ticket execution-prerequisite',
      effectClass: 'observe',
      networkPolicy: 'never',
      registration: expect.objectContaining({ syntax: 'execution-prerequisite <ticketId>' }),
    });
  });

  it('runs through the installed CLI with integrity-checked admitted reviews', async () => {
    const root = featureFixture();
    await admitThroughInstalledCli(root);

    const result = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(output.data).toEqual({
      command: 'ticket execution-prerequisite',
      prerequisite_status: 'satisfied',
      grants_authority: false,
      execution_plan_artifact: {
        presence: 'present',
        readability: 'readable',
        status: 'planned',
        receipt: 'valid',
      },
    });
    expect(output).toMatchObject({ state: 'healthy', next_actions: [] });
    expect(output.effects).toEqual({
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    });
  });

  it.each([
    {
      label: 'present artifact with planned status and a valid receipt',
      arrange: (_executionPath: string) => {},
      expectedExitCode: 0,
      expectedFacts: {
        presence: 'present',
        readability: 'readable',
        status: 'planned',
        receipt: 'valid',
      },
    },
    {
      label: 'absent artifact',
      arrange: (executionPath: string) => {
        rmSync(executionPath);
      },
      expectedExitCode: 2,
      expectedFacts: {
        presence: 'absent',
        readability: 'not_applicable',
        status: 'unknown',
        receipt: 'missing',
      },
    },
    {
      label: 'readable artifact with a non-planned status and no current receipt',
      arrange: (executionPath: string) => {
        writeFileSync(
          executionPath,
          readFileSync(executionPath, 'utf8').replace('**Status:** planned', '**Status:** draft'),
        );
      },
      expectedExitCode: 2,
      expectedFacts: {
        presence: 'present',
        readability: 'readable',
        status: 'unknown',
        receipt: 'missing',
      },
    },
    {
      label: 'present but unreadable artifact',
      arrange: (executionPath: string) => {
        rmSync(executionPath);
        mkdirSync(executionPath);
      },
      expectedExitCode: 2,
      expectedFacts: {
        presence: 'present',
        readability: 'unreadable',
        status: 'unknown',
        receipt: 'not_checked',
      },
    },
    {
      label: 'admitted artifact whose testing category was removed',
      arrange: (executionPath: string) => {
        writeFileSync(
          executionPath,
          readFileSync(executionPath, 'utf8')
            .split('\n')
            .filter(line => !line.startsWith('| item-4 | testing |'))
            .join('\n'),
        );
      },
      expectedExitCode: 2,
      expectedFacts: {
        presence: 'present',
        readability: 'readable',
        status: 'planned',
        receipt: 'missing',
      },
    },
  ])('reports structural facts for a $label without a semantic verdict', async testCase => {
    const root = featureFixture();
    await admitThroughInstalledCli(root);
    const executionPath = nodePath.join(
      root,
      '.project',
      'tickets',
      'ABC123-feature',
      'execution-plan.md',
    );
    testCase.arrange(executionPath);

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(invoked.exitCode, invoked.stdout).toBe(testCase.expectedExitCode);
    const result = JSON.parse(invoked.stdout) as {
      data?: Record<string, unknown>;
      errors?: readonly unknown[];
    };
    expect(result.errors ?? []).toEqual([]);
    expect(result.data).toEqual({
      command: 'ticket execution-prerequisite',
      grants_authority: false,
      ...(testCase.expectedExitCode === 0 && { prerequisite_status: 'satisfied' }),
      execution_plan_artifact: testCase.expectedFacts,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /\b(?:not )?implementable\b|\bapproved\b|\bready for coding\b/iu,
    );
  });

  it('reports every missing prerequisite once in deterministic planning order', async () => {
    const root = featureFixture();

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string; message: string }[];
      next_actions: { command: string }[];
      data?: { prerequisite_status?: string };
    };

    expect(invoked.exitCode).toBe(2);
    expect(result).toMatchObject({ state: 'action_required' });
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_accepted_scenarios',
      'missing_accepted_approach',
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.findings.map(finding => finding.message)).toEqual([
      'Accepted scenarios are required before execution.',
      'An accepted implementation approach is required before execution.',
      'An admitted Delivery Checklist is required before execution.',
    ]);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword review run scenario-gate --context .project/tickets/ABC123-feature/spec.md -- features/feature.feature',
      'safeword review run plan-implementation --context features/feature.feature --context .project/tickets/ABC123-feature/spec.md -- .project/tickets/ABC123-feature/impl-plan.md',
      'safeword review run plan-execution --context .project/tickets/ABC123-feature/impl-plan.md --context features/feature.feature -- .project/tickets/ABC123-feature/execution-plan.md',
    ]);
    expect(result.data?.prerequisite_status).toBeUndefined();
  });

  it('denies an authenticated scenario review that requested changes', async () => {
    const root = featureFixture();
    await admitThroughInstalledCli(root);
    rejectAdmittedScenarioReview(root);

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string }[];
      next_actions: { command: string }[];
      data?: { prerequisite_status?: string };
    };

    expect(invoked.exitCode).toBe(2);
    expect(result.state).toBe('action_required');
    expect(result.findings.map(finding => finding.code)).toEqual(['missing_accepted_scenarios']);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword review run scenario-gate --context .project/tickets/ABC123-feature/spec.md -- features/feature.feature',
    ]);
    expect(result.data?.prerequisite_status).toBeUndefined();
  });

  it('denies an earlier-phase feature that has not completed planning', async () => {
    const root = featureFixture(false, 'define-behavior');

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      { cwd: root, env: { NODE_ENV: 'test' } },
    );
    const result = JSON.parse(invoked.stdout) as { findings: { code: string }[] };

    expect(invoked.exitCode).toBe(2);
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_accepted_scenarios',
      'missing_accepted_approach',
      'missing_admitted_delivery_checklist',
    ]);
  });

  it.each([
    [
      'accepted scenarios',
      ['plan-implementation', 'plan-execution'],
      'missing_accepted_scenarios',
      'Accepted scenarios are required before execution.',
      'safeword review run scenario-gate --context .project/tickets/ABC123-feature/spec.md -- features/feature.feature',
    ],
    [
      'accepted implementation approach',
      ['scenario-gate', 'plan-execution'],
      'missing_accepted_approach',
      'An accepted implementation approach is required before execution.',
      'safeword review run plan-implementation --context features/feature.feature --context .project/tickets/ABC123-feature/spec.md -- .project/tickets/ABC123-feature/impl-plan.md',
    ],
    [
      'admitted Delivery Checklist',
      ['scenario-gate', 'plan-implementation'],
      'missing_admitted_delivery_checklist',
      'An admitted Delivery Checklist is required before execution.',
      'safeword review run plan-execution --context .project/tickets/ABC123-feature/impl-plan.md --context features/feature.feature -- .project/tickets/ABC123-feature/execution-plan.md',
    ],
  ] as const)(
    'denies only the missing %s prerequisite with one repair',
    async (_label, admitted, expectedCode, expectedMessage, expectedCommand) => {
      const root = featureFixture();
      await admitThroughInstalledCli(root, admitted);

      const invoked = await runCli(
        ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
        {
          cwd: root,
          env: {
            NODE_ENV: 'test',
            SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
          },
        },
      );
      const result = JSON.parse(invoked.stdout) as {
        state: string;
        findings: { code: string; message: string }[];
        next_actions: { command: string }[];
        data?: { prerequisite_status?: string };
      };

      expect(invoked.exitCode).toBe(2);
      expect(result.state).toBe('action_required');
      expect(result.findings.map(finding => finding.code)).toEqual([expectedCode]);
      expect(result.findings[0]?.message).toBe(expectedMessage);
      expect(result.next_actions.map(action => action.command)).toEqual([expectedCommand]);
      expect(result.data?.prerequisite_status).toBeUndefined();
    },
  );

  it('requires configured human design approval as part of the accepted approach', async () => {
    const root = featureFixture(true);
    await admitThroughInstalledCli(
      root,
      ['scenario-gate', 'plan-implementation', 'plan-execution'],
      true,
    );

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );
    const result = JSON.parse(invoked.stdout) as {
      findings: { code: string }[];
      next_actions: { command: string }[];
    };

    expect(invoked.exitCode).toBe(2);
    expect(result.findings.map(finding => finding.code)).toEqual(['missing_accepted_approach']);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword ticket approve-plan ABC123',
    ]);
  });

  it.each([
    [
      'one_pull_request',
      'One coherent contribution.',
      [{ name: 'Contribution', prerequisites: [] }],
    ],
    [
      'multiple_pull_requests',
      'Two independently provable dependency-ordered changes.',
      [
        { name: 'Foundation', prerequisites: [] },
        { name: 'Contribution', prerequisites: ['Foundation'] },
      ],
    ],
  ] as const)(
    'returns the reviewed %s slicing outcome when its checklist item is completed',
    async (decision, rationale, expectedSlices) => {
      const root = featureFixture();
      await admitThroughInstalledCli(root, undefined, false, decision);
      const reviewEnvironment = {
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
      };
      const prerequisite = await runCli(
        ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
        { cwd: root, env: reviewEnvironment },
      );
      expect(prerequisite.exitCode, prerequisite.stdout).toBe(0);
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 'proof@example.com'], { cwd: root });
      execFileSync('git', ['config', 'user.name', 'Proof Test'], { cwd: root });
      execFileSync('git', ['add', '.'], { cwd: root });
      execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: root });

      const invoked = await runCli(
        ['ticket', 'record-delivery-proof', 'ABC123', 'item-3', 'proof', '--json', '--cwd', root],
        { cwd: root, env: reviewEnvironment },
      );
      const result = JSON.parse(invoked.stdout) as { data?: Record<string, unknown> };

      expect(invoked.exitCode, invoked.stdout).toBe(0);
      expect(
        readFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), 'utf8'),
      ).toContain('delivery-proof:v1:');
      expect(
        readFileSync(
          nodePath.join(root, '.project', 'tickets', 'ABC123-feature', 'execution-plan.md'),
          'utf8',
        ),
      ).toMatch(/^\| item-3 \|.*\| complete \| current_revision_real_boundary \|/mu);
      expect(
        result.data?.pull_request_slicing,
        'completed checklist response must include pull_request_slicing',
      ).toEqual({
        decision,
        rationale,
        slices: expectedSlices,
      });
    },
  );

  it.each(['task', 'patch'] as const)('keeps %s work outside the feature contract', async type => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-small-'));
    const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-small');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), `---\ntype: ${type}\n---\n`);

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      { cwd: root, env: { NODE_ENV: 'test' } },
    );
    const result = JSON.parse(invoked.stdout) as Record<string, unknown>;

    expect(invoked.exitCode).toBe(0);
    expect(result).toMatchObject({
      state: 'healthy',
      data: { prerequisite_status: 'not_applicable', grants_authority: false },
    });
    expect(result.effects).toEqual({
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    });
    expect(result.next_actions).toEqual([]);
    expect(result.recovery).toEqual([]);
    expect(existsSync(nodePath.join(ticketDirectory, 'impl-plan.md'))).toBe(false);
    expect(existsSync(nodePath.join(ticketDirectory, 'execution-plan.md'))).toBe(false);
  });

  it.each(['implement', 'verify'] as const)(
    'keeps a legacy feature already in %s outside the new prerequisite',
    async phase => {
      const root = legacyFeatureFixture(phase);

      const invoked = await runCli(
        ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
        { cwd: root, env: { NODE_ENV: 'test' } },
      );
      const result = JSON.parse(invoked.stdout) as Record<string, unknown>;

      expect(invoked.exitCode).toBe(0);
      expect(result).toMatchObject({
        state: 'healthy',
        data: { prerequisite_status: 'not_applicable', grants_authority: false },
      });
    },
  );
});
