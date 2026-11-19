import { globSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { defaultVitestExclude, defaultVitestInclude } from '../../../vitest.default-projects.ts';
import doneConfig from '../vitest.done.config.ts';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '..');

function filesFor(include: readonly string[], exclude: readonly string[]): Set<string> {
  return new Set(
    globSync([...include], { cwd: CLI_ROOT, exclude: [...exclude] }).map(file =>
      file.split(nodePath.sep).join('/'),
    ),
  );
}

const doneLane = filesFor(doneConfig.test?.include ?? [], doneConfig.test?.exclude ?? []);
const defaultLane = filesFor(
  defaultVitestInclude('packages/cli'),
  defaultVitestExclude('packages/cli'),
);

// Measured at load ~6 (ticket 96WAFM): these five hook suites alone took ~115 s of the lane's
// ~190 s of work and pushed `test:done` past the Stop hook's 60 s cap.
const MEASURED_HEAVY_SUITES = [
  'tests/hooks/pre-tool-architecture-stage.test.ts',
  'tests/hooks/lint-go-context.test.ts',
  'tests/hooks/resolve-verify-ticket.test.ts',
  'tests/hooks/lint-config-fallback.test.ts',
  'tests/hooks/post-edit-other-languages.test.ts',
];

describe('turn-end fast test lane', () => {
  it('is what `test:done` runs', () => {
    const packageJson = JSON.parse(readFileSync(nodePath.join(CLI_ROOT, 'package.json'), 'utf8'));
    expect(packageJson.scripts['test:done']).toBe(
      'node scripts/run-vitest-with-build-lock.mjs --config vitest.done.config.ts',
    );
  });

  it('keeps the schema suite and the light hook suites', () => {
    expect(doneLane).toContain('tests/schema.test.ts');
    expect(doneLane).toContain('tests/hooks/done-gate.test.ts');
    expect(doneLane).toContain('tests/hooks/test-runner-timeout.test.ts');
  });

  it('leaves the measured heavy suites to the full lane', () => {
    for (const suite of MEASURED_HEAVY_SUITES) {
      expect(doneLane, suite).not.toContain(suite);
      expect(defaultLane, suite).toContain(suite);
    }
  });

  it('runs only files the full lane also runs', () => {
    for (const file of doneLane) expect(defaultLane, file).toContain(file);
  });
});
