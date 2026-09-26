import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
  temporaryDirectories.length = 0;
});

function generatedRubric(phase: 'implementation' | 'execution'): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-planning-generation-'));
  temporaryDirectories.push(directory);
  const output = nodePath.join(directory, 'rubric.ts');
  const script =
    phase === 'implementation' ? 'generate-plan-rubric.ts' : 'generate-execution-plan-rubric.ts';
  const result = spawnSync(
    'bun',
    [nodePath.join(packageRoot, 'scripts', script), '--output', output],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: process.env,
    },
  );
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  const declaration = /export const [A-Z_]+ =\s*("(?:[^"\\]|\\.)*");/u.exec(
    readFileSync(output, 'utf8'),
  );
  if (declaration?.[1] === undefined)
    throw new Error('The real generator must emit its rubric export.');
  return JSON.parse(declaration[1]) as string;
}

describe('Planning contract shared-clause generation', () => {
  it('emits the canonical shared authority block in both real phase-rubric outputs', () => {
    const rubrics = (['implementation', 'execution'] as const).map(generatedRubric);
    for (const rubric of rubrics) {
      expect(
        rubric,
        'canonical shared authority clauses must be generated for both planning phases',
      ).toContain('<!-- SAFEWORD:PLANNING_SHARED_START -->');
      expect(rubric).toContain('<!-- SAFEWORD:PLANNING_SHARED_END -->');
    }
  });

  it('preserves the existing distinct phase-only judgment in generated outputs', () => {
    const implementation = generatedRubric('implementation');
    const execution = generatedRubric('execution');
    expect(implementation).toContain('Direction and completeness');
    expect(implementation).not.toContain('Startable steps:');
    expect(execution).toContain('Startable steps:');
    expect(execution).not.toContain('Direction and completeness');
  });
});
