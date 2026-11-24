import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { runCliWithLiteralArguments } from '../helpers.js';
import {
  electronRequest,
  electronRunnerFixture,
} from '../review/legacy-electron-runner.fixture.js';

it.each(['README.md', 'packages/website/src/content/docs/reference/cli.mdx'])(
  'documents the public observation and its limits in %s',
  relative => {
    const root = path.resolve(import.meta.dirname, '../../../..');
    const source = readFileSync(path.join(root, relative), 'utf8');
    expect(source).toContain('review observe retrospective --request');
    expect(source).toMatch(/separate\s+`VERIFIED`/u);
    expect(source).toMatch(/missing\s+original\s+RED/u);
    expect(source).toMatch(/Setup\s+failures/u);
    expect(source).toContain('SGWMBS');
  },
);

it.runIf(process.platform !== 'win32')(
  'observes through the real public parser and fixed runner without creating verification credit',
  async () => {
    const fixture = electronRunnerFixture();
    try {
      fixture.git('remote', 'add', 'origin', 'https://github.com/ArcadeAI/soulless-monorepo.git');
      const git = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
      const cutoff = '4990ae4158d3e2744a8c5934089a8e1d5d2b19b1';
      const commitSuffix = '^{commit}';
      // Only external Git prerequisites are simulated; archive/status/blob work
      // delegates to real Git. This is CLI wiring, not real migration ancestry.
      writeFileSync(
        path.join(fixture.bin, 'git'),
        `#!${process.execPath}
const {spawnSync} = require('node:child_process');
const args = process.argv.slice(2);
const cutoff = ${JSON.stringify(cutoff)};
if (args.includes('rev-parse') && args.at(-1) === cutoff+${JSON.stringify(commitSuffix)}) { console.log(cutoff); process.exit(0); }
if (args.includes('merge-base') && args.includes(cutoff)) process.exit(0);
const result = spawnSync(${JSON.stringify(git)}, args, {stdio:'inherit'});
process.exit(result.status ?? 1);
`,
        { mode: 0o755 },
      );
      const result = await runCliWithLiteralArguments(
        [
          'review',
          'observe',
          'retrospective',
          '--request',
          fixture.requestPath,
          '--cwd',
          fixture.root,
          '--json',
          '--no-input',
        ],
        { cwd: fixture.root, env: fixture.environment, timeout: 30_000 },
      );
      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        data?: { observation?: { commit: string; request: unknown } };
      };
      expect(payload).toMatchObject({
        ok: true,
        data: {
          command: 'review observe retrospective',
          status: 'observed',
          observation: {
            commit: fixture.git('rev-parse', 'HEAD'),
            request: electronRequest,
            passing: { exitCode: 0, passedTests: 1, failedTests: 0 },
            mutated: { exitCode: 1, passedTests: 0, failedTests: 1 },
          },
        },
      });
      expect(existsSync(path.join(fixture.root, '.safeword/state/reviews'))).toBe(false);
      expect(fixture.events().filter(event => event.event === 'test')).toHaveLength(2);
    } finally {
      fixture.cleanup();
    }
  },
);
