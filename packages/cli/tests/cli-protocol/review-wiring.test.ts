import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

type ReviewAgent = 'claude' | 'codex';

function installFakeReviewer(directory: string, agent: ReviewAgent, log: string): string {
  const bin = nodePath.join(directory, 'bin');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, agent);
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if [ "$#" -gt 0 ] && [ "$1" = "--version" ]; then
  printf '${agent} 1.0.0\n'
  exit 0
fi
payload=$(cat)
printf '%s\n' '${agent}' >> "$SAFEWORD_REVIEW_LOG"
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

describe('cross-agent review public-command wiring', () => {
  it.each([
    { author: 'claude', reviewer: 'codex', model: 'codex-default' },
    { author: 'codex', reviewer: 'claude', model: 'claude-default' },
  ] as const)(
    'routes $author-authored work to headless $reviewer',
    async ({ author, reviewer, model }) => {
      const directory = createTemporaryDirectory();
      const target = nodePath.join(directory, 'review-input.md');
      const log = nodePath.join(directory, 'review.log');
      writeFileSync(target, 'bounded review input\n');
      const bin = installFakeReviewer(directory, reviewer, log);

      const result = await runCli(
        [
          'review',
          'run',
          'quality-review',
          'review-input.md',
          '--json',
          '--no-input',
          '--cwd',
          directory,
        ],
        {
          cwd: directory,
          env: {
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            SAFEWORD_AGENT_RUNTIME: author,
            SAFEWORD_REVIEW_LOG: log,
            SAFEWORD_NO_UPDATE_CHECK: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'healthy',
        data: {
          command: 'review run',
          status: 'approved',
          author_agent: author,
          assigned_reviewer: reviewer,
          actual_reviewer: reviewer,
          assigned_model: model,
          independence: 'cross-agent',
          reviewer_output: {
            dispatch_id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
          },
        },
      });
      expect(readFileSync(log, 'utf8')).toBe(`${reviewer}\n`);
    },
  );

  it('does not launch a same-agent candidate when the opposite reviewer is available', async () => {
    const directory = createTemporaryDirectory();
    const target = nodePath.join(directory, 'review-input.md');
    const log = nodePath.join(directory, 'review.log');
    writeFileSync(target, 'bounded review input\n');
    const bin = installFakeReviewer(directory, 'claude', log);
    installFakeReviewer(directory, 'codex', log);

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_REVIEW_LOG: log,
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout).data).toMatchObject({
      assigned_reviewer: 'claude',
      actual_reviewer: 'claude',
    });
    expect(readFileSync(log, 'utf8')).toBe('claude\n');
  });

  it('retains the existing route for an author outside the Claude and Codex pairing', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: process.env.PATH ?? '',
          SAFEWORD_AGENT_RUNTIME: 'cursor',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      effects: { network: [] },
      data: {
        status: 'existing_route',
        author_agent: 'cursor',
        independence: 'none',
      },
    });
  });
});
