/* eslint-disable unicorn/name-replacements -- Accepted execution-plan proof filename. */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createContractRepoFixture as createContractRepoFixture,
  fixtureSource,
  runContractRepoCheck as runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const fixtures: string[] = [];
const intendedSources = JSON.parse(
  readFileSync(
    nodePath.resolve(import.meta.dirname, '../fixtures/host-contract/intended-sources.json'),
    'utf8',
  ),
) as { baseline: string; paths: string[]; additions: string[] };
afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});

describe('required repository boundary for shared policy ownership', () => {
  it('names unclassified session-end, asynchronous and shell handlers from actual configuration', () => {
    const directory = createContractRepoFixture();
    fixtures.push(directory);
    const handlers = [
      'hooks/session-cleanup-quality.ts',
      'hooks/session-auto-upgrade.ts',
      'hooks/stop-retro.ts',
      'hooks/pre-tool-git-bare-fix.sh',
    ];
    const bindingsPath = 'packages/cli/templates/hooks/lib/behavior-contract.ts';
    const originalBindings = existsSync(nodePath.join(directory, bindingsPath))
      ? fixtureSource(directory, bindingsPath)
      : undefined;
    const baseline = JSON.parse(runContractRepoCheck(directory).output.trim()) as {
      findings: { code: string; metadata?: { handler_path?: string } }[];
    };
    expect(
      baseline.findings.filter(
        finding =>
          finding.code === 'UNCLASSIFIED_HOST_CONTRACT_HANDLER' &&
          handlers.includes(finding.metadata?.handler_path ?? ''),
      ),
    ).toEqual([]);
    if (originalBindings !== undefined) {
      writeFileSync(
        nodePath.join(directory, bindingsPath),
        `${originalBindings}\nfor (let index = SHARED_BEHAVIOR_BINDINGS.length - 1; index >= 0; index -= 1) {\n  if (${JSON.stringify(handlers)}.includes(SHARED_BEHAVIOR_BINDINGS[index].owner)) SHARED_BEHAVIOR_BINDINGS.splice(index, 1);\n}\n`,
      );
    }
    const configured = fixtureSource(directory, 'packages/cli/src/templates/config.ts');
    expect(configured).toContain('SessionEnd:');
    expect(configured).toContain('asyncRewakeHook(');
    expect(configured).toContain('asyncHook(');
    for (const handler of handlers) expect(configured).toContain(handler.slice('hooks/'.length));
    const result = runContractRepoCheck(directory);
    expect(result.status).toBe(2);
    const report = JSON.parse(result.output.trim()) as {
      findings: { code: string; severity: string; metadata?: { handler_path?: string } }[];
      data: { handler_inventory: Record<string, unknown>[] };
    };
    for (const handler of handlers) {
      expect(
        report.findings,
        `UNCLASSIFIED_HOST_CONTRACT_HANDLER: ${handler} was configured but not classified`,
      ).toContainEqual(
        expect.objectContaining({
          code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
          severity: 'error',
          metadata: expect.objectContaining({ handler_path: handler }),
        }),
      );
    }
    for (const [handler, event, execution, interpreter] of [
      [handlers[0], 'SessionEnd', 'synchronous', 'bun'],
      [handlers[1], 'SessionStart', 'async-rewake', 'bun'],
      [handlers[2], 'Stop', 'background', 'bun'],
      [handlers[3], 'PreToolUse', 'synchronous', 'bash'],
    ]) {
      expect(report.data.handler_inventory).toContainEqual(
        expect.objectContaining({
          host: 'claude',
          handler_path: handler,
          event,
          execution,
          interpreter,
        }),
      );
    }
    if (originalBindings === undefined) throw new Error('Canonical handler bindings are missing');
    writeFileSync(nodePath.join(directory, bindingsPath), originalBindings);
    const repaired = JSON.parse(runContractRepoCheck(directory).output.trim()) as typeof baseline;
    expect(
      repaired.findings.filter(
        finding =>
          finding.code === 'UNCLASSIFIED_HOST_CONTRACT_HANDLER' &&
          handlers.includes(finding.metadata?.handler_path ?? ''),
      ),
    ).toEqual([]);
  }, 60_000);

  it('reports every intended shipped source from the independently frozen baseline', () => {
    const directory = createContractRepoFixture();
    fixtures.push(directory);
    const result = runContractRepoCheck(directory);
    const report = JSON.parse(result.output.trim()) as {
      data: { source_inventory?: { path: string }[] };
      findings: { code: string }[];
    };
    expect(report.findings.map(finding => finding.code)).not.toContain(
      'UNACCOUNTED_HOST_CONTRACT_SOURCE',
    );
    expect(
      report.data.source_inventory,
      'HOST_CONTRACT_SOURCE_INVENTORY_MISSING: the real check must expose every shipped source',
    ).toBeDefined();
    expect(
      report.data.source_inventory
        ?.map(entry => entry.path)
        .toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(intendedSources.paths.toSorted((left, right) => left.localeCompare(right)));
  }, 60_000);

  it.each([
    ['skill', 'skills/unaccounted-contract/SKILL.md'],
    ['guide', 'guides/unaccounted-contract.md'],
    ['native command wrapper', 'commands/unaccounted-contract.md'],
    ['helper-agent entrypoint', 'agents/unaccounted-contract.md'],
  ])(
    'names an unaccounted %s through the real check',
    (_kind, sourcePath) => {
      const directory = createContractRepoFixture();
      fixtures.push(directory);
      const relativePath = `packages/cli/templates/${sourcePath}`;
      const target = nodePath.join(directory, relativePath);
      mkdirSync(nodePath.dirname(target), { recursive: true });
      writeFileSync(
        target,
        '---\nname: unaccounted-contract\ndescription: An unaccounted canonical component.\n---\n\nFollow this canonical workflow.\n',
      );
      const result = runContractRepoCheck(directory);
      expect(result.status).toBe(2);
      const report = JSON.parse(result.output.trim()) as {
        findings: { code: string; severity: string; metadata?: { path?: string } }[];
      };
      expect(
        report.findings,
        `UNACCOUNTED_HOST_CONTRACT_SOURCE: ${relativePath} must be named independently of other failures`,
      ).toContainEqual(
        expect.objectContaining({
          code: 'UNACCOUNTED_HOST_CONTRACT_SOURCE',
          severity: 'error',
          metadata: expect.objectContaining({ path: relativePath }),
        }),
      );
      // Register through the actual authority, then require the same check to clear it.
      const schemaPath = 'packages/cli/src/schema.ts';
      writeFileSync(
        nodePath.join(directory, schemaPath),
        `${fixtureSource(directory, schemaPath)}\nSAFEWORD_SCHEMA.ownedFiles['.safeword/contract-test/${sourcePath}'] = { template: ${JSON.stringify(sourcePath)} };\n`,
      );
      const repaired = runContractRepoCheck(directory);
      const repairedReport = JSON.parse(repaired.output.trim()) as {
        data: { source_inventory: { path: string }[] };
        findings: { code: string }[];
      };
      expect(repairedReport.findings.map(finding => finding.code)).not.toContain(
        'UNACCOUNTED_HOST_CONTRACT_SOURCE',
      );
      expect(repairedReport.data.source_inventory).toContainEqual(
        expect.objectContaining({ path: relativePath }),
      );
    },
    60_000,
  );

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
