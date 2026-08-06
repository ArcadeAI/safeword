import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { inspectPullRequestCommand } from '../../src/commands/review-pr.js';
import type { ModelFinding } from '../../src/pr-review/providers/openai.js';
import { runCli } from '../helpers.js';

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
        },
      }),
    );
    const inputPath = nodePath.join(cwd, 'inspection-input.json');
    const outputPath = nodePath.join(cwd, 'inspection-result.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [{ content: 'allow *', path: 'policies/access.flux' }],
        headSha: 'a'.repeat(40),
        schemaVersion: 1,
      }),
    );
    const finding: ModelFinding = {
      consequential: true,
      consequence: 'The policy grants access to every caller.',
      path: 'policies/access.flux',
    };
    const provider = vi.fn().mockResolvedValue([finding]);

    const result = await inspectPullRequestCommand({ cwd, inputPath, outputPath, provider });

    expect(provider).toHaveBeenCalledWith({
      apiKey: undefined,
      evidence: [{ content: 'allow *', path: 'policies/access.flux' }],
      model: 'gpt-test',
    });
    expect(result.receipt).toMatchObject({ reviewedSha: 'a'.repeat(40), route: 'needs_human' });
    expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual(result);
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
        },
      }),
    );
    const inputPath = nodePath.join(cwd, 'inspection-input.json');
    const outputPath = nodePath.join(cwd, 'inspection-result.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        artifacts: [{ content: 'changed', path: 'src/change.ts' }],
        headSha: 'b'.repeat(40),
        schemaVersion: 1,
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
              path: 'src/change.ts',
            },
          ]),
      });

      const serialized = readFileSync(outputPath, 'utf8');
      expect(serialized).not.toContain(credential);
      expect(result.receipt).toMatchObject({ route: 'needs_human', runState: 'incomplete' });
      expect(result.receipt).toMatchObject({ unknowns: ['credential-like value redacted'] });
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
});
