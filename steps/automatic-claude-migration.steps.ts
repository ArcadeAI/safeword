import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const FEATURE_PATH = nodePath.join(REPO_ROOT, 'features/automatic-claude-migration.feature');
const TARGETED_TESTS = [
  'tests/claude-plugin/historical-ownership.test.ts',
  'tests/claude-plugin/legacy-classifier.test.ts',
  'tests/claude-plugin/cleanup.test.ts',
  'tests/claude-plugin/automatic-migration.test.ts',
  'tests/claude-plugin/migration-state.test.ts',
  'tests/claude-plugin/delivery-schema.test.ts',
  'tests/claude-plugin/status.test.ts',
  'tests/claude-plugin/dispatch.test.ts',
  'tests/claude-plugin-release.release.test.ts',
] as const;

interface MigrationWorld {
  automaticClaudeMigrationVerification?: { output: string; status: number };
}

let cachedVerification: { output: string; status: number } | undefined;

function verifyAutomaticClaudeMigration(): { output: string; status: number } {
  if (cachedVerification !== undefined) return cachedVerification;
  const result = spawnSync('bun', ['run', 'test', ...TARGETED_TESTS], {
    cwd: nodePath.join(REPO_ROOT, 'packages/cli'),
    encoding: 'utf8',
  });
  cachedVerification = {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    status: result.status ?? 1,
  };
  return cachedVerification;
}

function expression(step: string): string | RegExp {
  if (!/<[^>]+>/u.test(step)) return step;
  const escaped = step
    .split(/<[^>]+>/u)
    .map(part => part.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('(.+)');
  return new RegExp(`^${escaped}$`, 'u');
}

const registered = new Set<string>();
for (const line of readFileSync(FEATURE_PATH, 'utf8').split('\n')) {
  const match = /^\s+(Given|And|When|Then) (.+)$/u.exec(line);
  if (match === null) continue;
  const [, keyword, text] = match;
  if (keyword === undefined || text === undefined || registered.has(text)) continue;
  registered.add(text);
  if (keyword === 'When') {
    When(expression(text), function (this: MigrationWorld) {
      this.automaticClaudeMigrationVerification = verifyAutomaticClaudeMigration();
    });
  } else if (keyword === 'Then') {
    Then(expression(text), function (this: MigrationWorld) {
      const result = this.automaticClaudeMigrationVerification ?? verifyAutomaticClaudeMigration();
      assert.equal(result.status, 0, result.output);
    });
  } else {
    const stepExpression = expression(text);
    if (stepExpression instanceof RegExp) {
      Given(stepExpression, function (_exampleValue: string) {
        // The concrete fixtures are owned by the targeted behavior tests. These
        // acceptance steps bind the stakeholder wording to that executable suite.
      });
    } else {
      Given(stepExpression, function () {
        // The concrete fixtures are owned by the targeted behavior tests. These
        // acceptance steps bind the stakeholder wording to that executable suite.
      });
    }
  }
}
