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

function textArtifact(context: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    content: 'allow *',
    ...context,
    kind: 'text',
    path: 'policies/access.flux',
  };
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
          requiredChecks: [{ context: 'build' }],
        },
      }),
    );
    const inputPath = nodePath.join(cwd, 'inspection-input.json');
    const outputPath = nodePath.join(cwd, 'inspection-result.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [
          {
            content: 'allow *',
            fullContentBase64: Buffer.from('policy {\n  allow *\n}\n').toString('base64'),
            kind: 'text',
            path: 'policies/access.flux',
          },
          {
            content: '- deprecated = true',
            contextNotApplicable: true,
            kind: 'text',
            path: 'policies/deprecated.flux',
          },
        ],
        checks: [{ conclusion: 'success', name: 'build', status: 'completed' }],
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
    const provider = vi
      .fn()
      .mockResolvedValue({ findings: [finding], tokenUsage: { input: 123, output: 45 } });

    const result = await inspectPullRequestCommand({ cwd, inputPath, outputPath, provider });

    expect(provider).toHaveBeenCalledWith(
      expect.objectContaining({
        context: [{ content: 'policy {\n  allow *\n}\n', path: 'policies/access.flux' }],
        evidence: [
          { content: 'allow *', path: 'policies/access.flux' },
          { content: '- deprecated = true', path: 'policies/deprecated.flux' },
        ],
        model: 'gpt-test',
      }),
    );
    expect(receiptOf(result)).toMatchObject({
      checks: [{ name: 'build', status: 'success' }],
      reviewedSha: 'a'.repeat(40),
      route: 'needs_human',
      tokenUsage: { input: 123, output: 45 },
    });
    expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual(result);
  });

  it.each([
    ['missing context', [textArtifact()], ['policies/access.flux']],
    [
      'explicitly unavailable context',
      [textArtifact({ contextUnavailable: true })],
      ['policies/access.flux'],
    ],
    [
      'malformed context',
      [textArtifact({ fullContentBase64: 'not-base64' })],
      ['policies/access.flux'],
    ],
    ['an empty artifact set', [], []],
    ['only non-text artifacts', [{ kind: 'non_text', path: 'logo.png' }], []],
  ] as const)(
    'routes %s to a human without treating the review as complete',
    async (_case, artifacts, missingEvidence) => {
      const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-context-missing-'));
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
          artifacts,
          checks: [],
          headSha: 'e'.repeat(40),
          markerReceiptExists: false,
          pullState: 'ready',
          schemaVersion: 1,
          statuses: [],
        }),
      );
      const provider = vi.fn();

      const result = await inspectPullRequestCommand({ cwd, inputPath, outputPath, provider });

      expect(provider).not.toHaveBeenCalled();
      expect(receiptOf(result)).toMatchObject({
        missingEvidence,
        route: 'needs_human',
        runState: 'incomplete',
        unknowns: ['no reviewable evidence'],
      });
    },
  );

  it('reviews a patch whose exact-head file content is empty', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-empty-context-'));
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
        artifacts: [textArtifact({ fullContentBase64: '' })],
        checks: [],
        headSha: '0'.repeat(40),
        markerReceiptExists: false,
        pullState: 'ready',
        schemaVersion: 1,
        statuses: [],
      }),
    );
    const provider = vi.fn().mockResolvedValue({ findings: [], tokenUsage: {} });

    const result = await inspectPullRequestCommand({ cwd, inputPath, outputPath, provider });

    expect(provider).toHaveBeenCalledWith(
      expect.objectContaining({
        context: [{ content: '', path: 'policies/access.flux' }],
        evidence: [{ content: 'allow *', path: 'policies/access.flux' }],
      }),
    );
    expect(receiptOf(result)).toMatchObject({ route: 'looks_ready', runState: 'complete' });
  });

  it('counts full-file context against the existing evidence budget', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-pr-context-budget-'));
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
    const fullContentBase64 = Buffer.from('c'.repeat(90)).toString('base64');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [
          {
            content: 'p'.repeat(20),
            fullContentBase64,
            kind: 'text',
            path: 'src/large.ts',
          },
        ],
        checks: [],
        headSha: '9'.repeat(40),
        markerReceiptExists: false,
        pullState: 'ready',
        schemaVersion: 1,
        statuses: [],
      }),
    );
    const provider = vi.fn();

    const result = await inspectPullRequestCommand({ cwd, inputPath, outputPath, provider });

    expect(provider).not.toHaveBeenCalled();
    expect(receiptOf(result)).toMatchObject({
      missingEvidence: ['src/large.ts'],
      route: 'needs_human',
      runState: 'incomplete',
    });
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
    const firstContent = 'a'.repeat(30);
    const overBudgetContent = 'b'.repeat(30);
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [
          {
            content: firstContent,
            fullContentBase64: Buffer.from(firstContent).toString('base64'),
            kind: 'text',
            path: 'src/first.ts',
          },
          {
            content: overBudgetContent,
            fullContentBase64: Buffer.from(overBudgetContent).toString('base64'),
            kind: 'text',
            path: 'src/over-budget.ts',
          },
        ],
        checks: [],
        headSha: 'f'.repeat(40),
        markerReceiptExists: false,
        pullState: 'ready',
        schemaVersion: 1,
        statuses: [],
      }),
    );
    const provider = vi.fn().mockResolvedValue({ findings: [], tokenUsage: {} });

    const result = await inspectPullRequestCommand({ cwd, inputPath, outputPath, provider });

    expect(provider).toHaveBeenCalledWith(
      expect.objectContaining({
        context: [{ content: firstContent, path: 'src/first.ts' }],
        evidence: [{ content: firstContent, path: 'src/first.ts' }],
        model: 'gpt-test',
      }),
    );
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
        artifacts: [
          {
            content: 'changed',
            fullContentBase64: Buffer.from('changed').toString('base64'),
            kind: 'text',
            path: 'src/change.ts',
          },
        ],
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
          Promise.resolve({
            findings: [
              {
                consequential: false,
                consequence: `Model echoed ${credential}`,
                evidence: 'The changed line is present.',
                nextAction: 'Review the changed line.',
                path: 'src/change.ts',
              },
            ],
            tokenUsage: {},
          }),
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
      recovery: { command: string; description: string }[];
      state: string;
    };

    expect(output).toMatchObject({ ok: false, state: 'failed' });
    expect(output.errors).toContainEqual(
      expect.objectContaining({ code: 'PR_REVIEW_INSPECT_FAILED' }),
    );
    expect(output.recovery).toContainEqual({
      command: "safeword review-pr inspect 'missing.json' --output 'result.json'",
      description:
        'Check .safeword/config.json, the input artifact, and OPENAI_API_KEY, then retry.',
      requires_human: true,
    });
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
        artifacts: [
          {
            content: 'changed',
            fullContentBase64: Buffer.from('changed').toString('base64'),
            kind: 'text',
            path: 'src/change.ts',
          },
        ],
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
        artifacts: [
          {
            content: 'changed',
            fullContentBase64: Buffer.from('changed').toString('base64'),
            kind: 'text',
            path: 'src/change.ts',
          },
        ],
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
