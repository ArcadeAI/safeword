/**
 * Live-fire proof for the real headless retro extractors used by closeout.
 *
 * This file is excluded from the default suite because it makes one authenticated
 * Claude call and one authenticated Codex call; provider usage charges may apply.
 * Both CLIs may retain their normal local session metadata. Test fixtures and
 * extractor scratch files are isolated under a dedicated temporary directory and
 * removed after each example. No tracker, branch, worktree, or customer project
 * is touched.
 *
 * Run with:
 *
 *   SAFEWORD_RUN_CLOSEOUT_HEADLESS_LIVE=1 \
 *     bun run --cwd packages/cli test:smoke:live -- \
 *     tests/smoke/closeout-headless.live.test.ts
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

import { buildAutoExtractor } from '../../src/commands/retro.js';

const RUN_LIVE = process.env.SAFEWORD_RUN_CLOSEOUT_HEADLESS_LIVE === '1';
const SKIP_ACKNOWLEDGED = process.env.SAFEWORD_LIVE_ALLOW_SKIP === '1';
const EXPECTED_FINDING_KEYS = [
  'category',
  'repro',
  'safeword_surface',
  'title',
  'what_happened',
  'why_friction',
] as const;

type Runtime = 'claude' | 'codex';

function transcriptFor(runtime: Runtime, projectDirectory: string): string {
  const friction =
    'SAFEWORD friction observed: running `safeword project verify` failed with ' +
    '`unknown config key` even though `.safeword/config.json` was valid. The affected ' +
    'SafeWord surface is packages/cli/src/commands/verify.ts. Repro: run ' +
    '`safeword project verify` with a valid config; expected verification to start, ' +
    'actual result was an unknown-key error.';

  if (runtime === 'codex') {
    return [
      JSON.stringify({
        type: 'session_meta',
        payload: {
          id: 'live-codex-extraction',
          session_id: 'live-codex-extraction',
          cwd: projectDirectory,
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: friction }],
        },
      }),
    ].join('\n');
  }

  return [
    JSON.stringify({
      type: 'session_meta',
      sessionId: 'live-claude-extraction',
      cwd: projectDirectory,
    }),
    JSON.stringify({
      message: { role: 'user', content: [{ type: 'text', text: friction }] },
    }),
  ].join('\n');
}

function requireAuthenticatedCli(runtime: Runtime): string {
  const result = spawnSync(runtime, ['--version'], { encoding: 'utf8' });
  expect(
    result.status,
    `${runtime} is required and must be authenticated before running this live-fire test.\n` +
      `stdout: ${result.stdout ?? ''}\nstderr: ${result.stderr ?? ''}`,
  ).toBe(0);
  return (result.stdout ?? '').trim();
}

describe('live smoke: closeout headless extraction', () => {
  it('gate: both real headless extractors run, or the omission is explicit', () => {
    expect(
      RUN_LIVE || SKIP_ACKNOWLEDGED,
      'Real closeout extraction was NOT verified. Install and sign in to Claude and Codex, ' +
        'then set SAFEWORD_RUN_CLOSEOUT_HEADLESS_LIVE=1, or explicitly acknowledge the ' +
        'gap with SAFEWORD_LIVE_ALLOW_SKIP=1.',
    ).toBe(true);
  });

  describe.skipIf(!RUN_LIVE)('real production adapters', () => {
    it.each(['claude', 'codex'] as const)(
      'returns a schema-valid SafeWord finding from real headless %s',
      async runtime => {
        const version = requireAuthenticatedCli(runtime);
        const outerTemporaryDirectory = tmpdir();
        const sandbox = mkdtempSync(
          nodePath.join(outerTemporaryDirectory, `safeword-live-${runtime}-`),
        );
        const projectDirectory = nodePath.join(sandbox, 'project');
        mkdirSync(projectDirectory);
        const previousTemporaryDirectory = process.env.TMPDIR;
        process.env.TMPDIR = sandbox;
        let checked: { ok: boolean; findings: unknown[] } | undefined;
        const started = Date.now();

        try {
          const extract = await buildAutoExtractor(projectDirectory, {
            agent: runtime,
            onExtractionResult: result => {
              checked = result;
            },
          });
          const findings = await extract(transcriptFor(runtime, projectDirectory));
          const expectedCategory = expect.stringMatching(/^(?:bug|gap|rough-edge)$/u);

          expect(checked).toMatchObject({ ok: true });
          expect(findings).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                category: expectedCategory,
                safeword_surface: 'packages/cli/src/commands/verify.ts',
              }),
            ]),
          );
          for (const finding of findings as Record<string, unknown>[]) {
            expect(
              Object.keys(finding).toSorted((left, right) => left.localeCompare(right)),
            ).toEqual([...EXPECTED_FINDING_KEYS]);
            for (const key of EXPECTED_FINDING_KEYS) {
              expect(typeof finding[key], `${runtime} ${key}`).toBe('string');
              expect((finding[key] as string).trim().length, `${runtime} ${key}`).toBeGreaterThan(
                0,
              );
            }
          }

          console.info(
            `[closeout-headless.live] ${runtime} ${version}: ${findings.length} valid finding(s) in ${Date.now() - started}ms`,
          );
        } finally {
          if (previousTemporaryDirectory === undefined) delete process.env.TMPDIR;
          else process.env.TMPDIR = previousTemporaryDirectory;
          rmSync(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
        }
      },
      660_000,
    );
  });
});
