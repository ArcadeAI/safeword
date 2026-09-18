import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { assertTestCliFresh, runCli } from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

function installReviewer(): string {
  const directory = createTrustedReviewerDirectory('safeword-coding-authorization-');
  const bin = nodePath.join(directory, 'bin');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'claude');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if [ "${'$'}{1:-}" = "--version" ]; then printf 'claude 1.0.0\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES.claude}'
  exit 0
fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved fixture","findings":[]}\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

async function admitReview(
  root: string,
  kind: 'scenario-gate' | 'plan-implementation',
  target: string,
  context: readonly string[],
  bin: string,
): Promise<string> {
  const reviewed = await runCli(
    [
      'review',
      'run',
      kind,
      target,
      ...context.flatMap(path => ['--context', path]),
      '--json',
      '--no-input',
      '--cwd',
      root,
    ],
    {
      cwd: root,
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        NODE_ENV: 'test',
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_NO_UPDATE_CHECK: '1',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
      },
    },
  );
  expect(reviewed.exitCode, reviewed.stdout).toBe(0);
  const result = JSON.parse(reviewed.stdout) as { data?: { review_id?: string } };
  if (result.data?.review_id === undefined) throw new Error(`${kind} review id missing`);
  return result.data.review_id;
}

async function featureFixture(): Promise<string> {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-coding-authorization-'));
  const ticketFolder = 'ABC123-feature';
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', ticketFolder);
  const featureTarget = 'features/feature.feature';
  const implementationTarget = `.project/tickets/${ticketFolder}/impl-plan.md`;
  mkdirSync(ticketDirectory, { recursive: true });
  mkdirSync(nodePath.join(root, 'features'), { recursive: true });
  mkdirSync(nodePath.join(root, '.claude', 'plans'), { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    '---\ntype: feature\nphase: implement\n---\n',
  );
  writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Product Plan\n');
  writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), '# Implementation Plan\n');
  writeFileSync(nodePath.join(root, featureTarget), 'Feature: Accepted behavior\n');
  writeFileSync(
    nodePath.join(root, '.claude', 'plans', 'execution.md'),
    '# Host-local execution notes\n',
  );
  writeFileSync(
    nodePath.join(root, '.safeword', 'config.json'),
    '{"crossAgentReviewRoutes":{"codex":[{"reviewer":"claude","model":"opus"}]}}\n',
  );
  writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), '');

  const bin = installReviewer();
  const scenarioReviewId = await admitReview(
    root,
    'scenario-gate',
    featureTarget,
    [`.project/tickets/${ticketFolder}/spec.md`],
    bin,
  );
  const implementationReviewId = await admitReview(
    root,
    'plan-implementation',
    implementationTarget,
    [featureTarget, `.project/tickets/${ticketFolder}/spec.md`],
    bin,
  );
  writeFileSync(
    nodePath.join(root, '.project', 'skill-invocations.log'),
    [
      `2026-09-18T00:00:02.000Z fixture review:${ticketFolder}:phase@scenario-gate author:codex reviewer:claude independence:cross-agent review-id:${scenarioReviewId}`,
      `2026-09-18T00:00:03.000Z fixture review:${ticketFolder}:phase@plan-implementation author:codex reviewer:claude independence:cross-agent review-id:${implementationReviewId}`,
      '',
    ].join('\n'),
  );
  return root;
}

describe('coding authorization', () => {
  beforeAll(assertTestCliFresh);

  afterEach(() => {
    cleanupTrustedReviewerDirectories();
  });

  it('rejects host-local notes when the project-local Execution Plan is missing', async () => {
    const root = await featureFixture();

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(
      invoked.exitCode,
      'coding authorization should return the typed missing project-local Execution Plan denial',
    ).toBe(2);
    expect(() => JSON.parse(invoked.stdout)).not.toThrow();
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string }[];
      next_actions: { command: string }[];
      data: { command: string; coding_authorization: string; grants_authority: boolean };
    };
    expect(result).toMatchObject({
      state: 'action_required',
      data: {
        command: 'ticket coding-authorization',
        coding_authorization: 'denied',
        grants_authority: false,
      },
    });
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword review run plan-execution --context .project/tickets/ABC123-feature/impl-plan.md --context features/feature.feature -- .project/tickets/ABC123-feature/execution-plan.md',
    ]);
    expect(readFileSync(nodePath.join(root, '.claude', 'plans', 'execution.md'), 'utf8')).toBe(
      '# Host-local execution notes\n',
    );
  });
});
