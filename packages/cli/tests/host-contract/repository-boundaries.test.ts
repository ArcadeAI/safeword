/* eslint-disable unicorn/name-replacements -- Accepted execution-plan proof filename. */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createContractRepoFixture as createContractRepoFixture,
  fixtureSource,
  runContractRepoCheck as runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const fixtures: string[] = [];
afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});

describe('required repository boundary for shared policy ownership', () => {
  it('rejects an interface that leaves the independent Codex intake predicate in place', () => {
    const directory = createContractRepoFixture();
    fixtures.push(directory);
    const adapterPath = nodePath.join(directory, 'packages/cli/src/commands/codex-hook.ts');
    let adapter = fixtureSource(directory, 'packages/cli/src/commands/codex-hook.ts');
    if (!adapter.includes('function missingIntakeFields(')) {
      const retired = readFileSync(
        nodePath.resolve(
          import.meta.dirname,
          '../fixtures/host-contract/owners/codex-intake-predicate.txt',
        ),
        'utf8',
      );
      adapter += `\n${retired}`;
      const start = adapter.indexOf('function runEnrolledPreToolUse(');
      const anchor = '  if (!input) return;';
      const insertion = adapter.indexOf(anchor, start) + anchor.length;
      expect(start).toBeGreaterThan(-1);
      expect(insertion).toBeGreaterThan(start);
      adapter = `${adapter.slice(0, insertion)}\n  for (const targetPath of extractTargetPaths(input)) {\n    if (maybeDenyTestDefinitionsWrite(projectDirectory, targetPath)) return;\n  }${adapter.slice(insertion)}`;
      writeFileSync(adapterPath, adapter);
    }
    const shared = fixtureSource(directory, 'packages/cli/templates/hooks/pre-tool-quality.ts');
    // Both real implementations exist before the check. This is not a missing-import RED.
    expect(adapter).toContain('function missingIntakeFields(');
    expect(adapter).toContain('runEnrolledPreToolUse(');
    expect(adapter).toContain(
      'if (maybeDenyTestDefinitionsWrite(projectDirectory, targetPath)) return;',
    );
    expect(shared).toContain('test-definitions.md');
    const result = runContractRepoCheck(directory);
    expect(
      result.status,
      `COMPETING_HOST_CONTRACT_OWNER: ${result.entrypoint} accepted parallel codex.intake.required-fields\n${result.output}`,
    ).toBe(2);
    expect(result.output).toContain('codex.intake.required-fields');
    expect(result.output).toContain('packages/cli/src/commands/codex-hook.ts');
  }, 60_000);
});
