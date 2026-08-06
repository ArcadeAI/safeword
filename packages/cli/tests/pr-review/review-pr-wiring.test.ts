import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type InspectionHandoff, inspectPullRequestCommand } from '../../src/commands/review-pr.js';
import type { ModelFinding } from '../../src/pr-review/providers/openai.js';
import type { PublishedReceipt } from '../../src/pr-review/review.js';
import { runCli } from '../helpers.js';

function receiptOf(handoff: InspectionHandoff): PublishedReceipt {
  if (handoff.kind !== 'receipt') throw new Error('expected a receipt handoff');
  return handoff.receipt;
}

describe('review-pr inspect command wiring', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { force: true, recursive: true });
  });

  it('loads real config and evidence, derives the route, and writes a validated handoff', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-'));
    directories.push(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'));
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        prReview: {
          enabled: true,
          maxTotalBytes: 1024,
          model: 'gpt-test',
          provider: 'openai',
          requiredChecks: [],
        },
      }),
    );
    const inputPath = nodePath.join(cwd, 'inspection-input.json');
    const outputPath = nodePath.join(cwd, 'inspection-result.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [{ content: 'allow *', kind: 'text', path: 'policies/access.flux' }],
        checks: [],
        headSha: 'a'.repeat(40),
        markerReceiptExists: false,
        pullState: 'ready',
        schemaVersion: 1,
        statuses: [],
      }),
    );
    const finding: ModelFinding = {
      consequential: true,
      consequence: 'The policy grants access to every caller.',
      evidence: 'The changed policy says `allow *`.',
      line: 1,
      nextAction: 'Restrict access to the intended role.',
      path: 'policies/access.flux',
    };
    const provider = vi.fn().mockResolvedValue([finding]);

    const result = await inspectPullRequestCommand({ cwd, inputPath, outputPath, provider });

    expect(provider).toHaveBeenCalledWith({
      apiKey: undefined,
      evidence: [{ content: 'allow *', path: 'policies/access.flux' }],
      model: 'gpt-test',
    });
    expect(receiptOf(result)).toMatchObject({ reviewedSha: 'a'.repeat(40), route: 'needs_human' });
    expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual(result);
  });

  it('uses the same cumulative byte budget for provider evidence and receipt coverage', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-budget-'));
    directories.push(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'));
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        prReview: {
          enabled: true,
          maxTotalBytes: 100,
          model: 'gpt-test',
          provider: 'openai',
          requiredChecks: [],
        },
      }),
    );
    const inputPath = nodePath.join(cwd, 'inspection-input.json');
    const outputPath = nodePath.join(cwd, 'inspection-result.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [
          { content: 'a'.repeat(60), kind: 'text', path: 'src/first.ts' },
          { content: 'b'.repeat(50), kind: 'text', path: 'src/over-budget.ts' },
        ],
        checks: [],
        headSha: 'f'.repeat(40),
        markerReceiptExists: false,
        pullState: 'ready',
        schemaVersion: 1,
        statuses: [],
      }),
    );
    const provider = vi.fn().mockResolvedValue([]);

    const result = await inspectPullRequestCommand({ cwd, inputPath, outputPath, provider });

    expect(provider).toHaveBeenCalledWith({
      apiKey: undefined,
      evidence: [{ content: 'a'.repeat(60), path: 'src/first.ts' }],
      model: 'gpt-test',
    });
    expect(receiptOf(result)).toMatchObject({
      coverage: [{ path: 'src/first.ts', status: 'integrity_reviewed' }],
      missingEvidence: ['src/over-budget.ts'],
      route: 'needs_human',
      runState: 'incomplete',
    });
  });

  it('redacts an echoed credential and forces the handoff to incomplete', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-secret-'));
    directories.push(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'));
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        prReview: {
          enabled: true,
          maxTotalBytes: 1024,
          model: 'gpt-test',
          provider: 'openai',
          requiredChecks: [],
        },
      }),
    );
    const inputPath = nodePath.join(cwd, 'inspection-input.json');
    const outputPath = nodePath.join(cwd, 'inspection-result.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [{ content: 'changed', kind: 'text', path: 'src/change.ts' }],
        checks: [],
        headSha: 'b'.repeat(40),
        markerReceiptExists: false,
        pullState: 'ready',
        schemaVersion: 1,
        statuses: [],
      }),
    );
    const credential = `sk-${'sentinel'.repeat(5)}`;
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = credential;

    try {
      const result = await inspectPullRequestCommand({
        cwd,
        inputPath,
        outputPath,
        provider: () =>
          Promise.resolve([
            {
              consequential: false,
              consequence: `Model echoed ${credential}`,
              evidence: 'The changed line is present.',
              nextAction: 'Review the changed line.',
              path: 'src/change.ts',
            },
          ]),
      });

      const serialized = readFileSync(outputPath, 'utf8');
      expect(serialized).not.toContain(credential);
      expect(receiptOf(result)).toMatchObject({ route: 'needs_human', runState: 'incomplete' });
      expect(receiptOf(result)).toMatchObject({ unknowns: ['credential-like value redacted'] });
    } finally {
      if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it('returns a typed CLI failure through the public command boundary', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-cli-'));
    directories.push(cwd);

    const result = await runCli(
      ['review-pr', 'inspect', 'missing.json', '--output', 'result.json', '--json', '--no-input'],
      { cwd, env: { SAFEWORD_NO_UPDATE_CHECK: '1' } },
    );
    const output = JSON.parse(result.stdout) as {
      errors: { code: string }[];
      ok: boolean;
      state: string;
    };

    expect(output).toMatchObject({ ok: false, state: 'failed' });
    expect(output.errors).toContainEqual(
      expect.objectContaining({ code: 'PR_REVIEW_INSPECT_FAILED' }),
    );
  });

  it('publishes pending without calling the provider before a required check settles', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-pending-'));
    directories.push(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'));
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        prReview: {
          enabled: true,
          maxTotalBytes: 1024,
          model: 'gpt-test',
          provider: 'openai',
          requiredChecks: [{ context: 'build' }],
        },
      }),
    );
    const inputPath = nodePath.join(cwd, 'input.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [{ content: 'changed', kind: 'text', path: 'src/change.ts' }],
        // eslint-disable-next-line unicorn/no-null -- GitHub uses JSON null until completion.
        checks: [{ conclusion: null, name: 'build', status: 'in_progress' }],
        headSha: 'c'.repeat(40),
        markerReceiptExists: false,
        pullState: 'ready',
        schemaVersion: 1,
        statuses: [],
      }),
    );
    const provider = vi.fn();

    const result = await inspectPullRequestCommand({
      cwd,
      inputPath,
      outputPath: nodePath.join(cwd, 'result.json'),
      provider,
    });

    expect(provider).not.toHaveBeenCalled();
    expect(receiptOf(result)).toMatchObject({ status: 'prerequisites_pending' });
  });

  it('turns a provider failure into a publishable failed human route', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-failed-'));
    directories.push(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'));
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        prReview: {
          enabled: true,
          maxTotalBytes: 1024,
          model: 'gpt-test',
          provider: 'openai',
          requiredChecks: [],
        },
      }),
    );
    const inputPath = nodePath.join(cwd, 'input.json');
    const outputPath = nodePath.join(cwd, 'result.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [{ content: 'changed', kind: 'text', path: 'src/change.ts' }],
        checks: [],
        headSha: 'd'.repeat(40),
        markerReceiptExists: false,
        pullState: 'ready',
        schemaVersion: 1,
        statuses: [],
      }),
    );

    const result = await inspectPullRequestCommand({
      cwd,
      inputPath,
      outputPath,
      provider: () => Promise.reject(new Error('provider unavailable')),
    });

    expect(receiptOf(result)).toMatchObject({ route: 'needs_human', runState: 'failed' });
    expect(readFileSync(outputPath, 'utf8')).toContain('review provider failed');
  });

  it('emits a benign no-op handoff for an already-reviewed current head', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-noop-'));
    directories.push(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'));
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        prReview: {
          enabled: true,
          maxTotalBytes: 1024,
          model: 'gpt-test',
          provider: 'openai',
          requiredChecks: [],
        },
      }),
    );
    const headSha = 'e'.repeat(40);
    const inputPath = nodePath.join(cwd, 'input.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [{ content: 'changed', kind: 'text', path: 'src/change.ts' }],
        checks: [],
        headSha,
        markerReceiptExists: true,
        pullState: 'ready',
        reviewedReceiptSha: headSha,
        schemaVersion: 1,
        statuses: [],
      }),
    );
    const provider = vi.fn();

    const result = await inspectPullRequestCommand({
      cwd,
      inputPath,
      outputPath: nodePath.join(cwd, 'result.json'),
      provider,
    });

    expect(result).toMatchObject({ kind: 'noop' });
    expect(provider).not.toHaveBeenCalled();
  });
});
