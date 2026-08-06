import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { createPrReviewSmokeFixture } from '../src/pr-review/smoke-fixture.js';
import type { ProjectContext } from '../src/schema.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';

const installedPaths = [
  '.github/workflows/safeword-pr-review.yml',
  '.github/workflows/safeword-pr-review-publisher.yml',
  '.github/workflows/safeword-pr-review-worker.yml',
] as const;

const invalidWorkflow = `name: Deliberately invalid workflow
on: push
jobs:
  invalid:
    runs-on: ubuntu-latest
    permissions:
      issues: explode
    steps:
      - run: echo unreachable
`;

function runActionlint(executable: string, cwd: string, paths: readonly string[]): number {
  const result = spawnSync(executable, [...paths], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

export function checkPrReviewWorkflows(
  executable = process.env.SAFEWORD_ACTIONLINT ?? 'actionlint',
): void {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-actionlint-'));
  try {
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword/config.json'),
      JSON.stringify({ prReview: { enabled: true } }),
    );

    const context = { cwd: projectDirectory } as ProjectContext;
    for (const installedPath of installedPaths) {
      const definition = SAFEWORD_SCHEMA.managedFiles[installedPath];
      const content = definition?.generator?.(context);
      if (content === undefined) throw new Error(`failed to generate ${installedPath}`);
      const destination = nodePath.join(projectDirectory, installedPath);
      mkdirSync(nodePath.dirname(destination), { recursive: true });
      writeFileSync(destination, content);
    }

    if (runActionlint(executable, projectDirectory, installedPaths) !== 0) {
      throw new Error('generated advisory PR review workflows failed actionlint');
    }

    const fixture = createPrReviewSmokeFixture('0.0.0-smoke');
    const sweepPath = '.github/workflows/safeword-pr-review-smoke-sweep.yml';
    writeFileSync(nodePath.join(projectDirectory, installedPaths[0]), fixture.router);
    writeFileSync(nodePath.join(projectDirectory, installedPaths[1]), fixture.publisher);
    writeFileSync(nodePath.join(projectDirectory, installedPaths[2]), fixture.worker);
    writeFileSync(nodePath.join(projectDirectory, sweepPath), fixture.sweep);
    if (runActionlint(executable, projectDirectory, [...installedPaths, sweepPath]) !== 0) {
      throw new Error('disposable advisory PR review fixture failed actionlint');
    }

    const invalidPath = '.github/workflows/deliberately-invalid.yml';
    writeFileSync(nodePath.join(projectDirectory, invalidPath), invalidWorkflow);
    if (runActionlint(executable, projectDirectory, [invalidPath]) === 0) {
      throw new Error('actionlint accepted the deliberately invalid control fixture');
    }
  } finally {
    rmSync(projectDirectory, { force: true, recursive: true });
  }

  console.log(
    'Generated workflows and disposable fixture passed actionlint; invalid control failed.',
  );
}

if (import.meta.main) checkPrReviewWorkflows();
