import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { commandCatalog } from '../../src/cli-protocol/catalog.js';
import { createTemporaryDirectory, runCli } from '../helpers.js';

function visibleCommands(help: string): string[] {
  const section = help.split('\nCommands:\n', 2)[1]?.split('\n\n', 1)[0] ?? '';
  return section
    .split('\n')
    .map(line => /^ {2}(\S+)/u.exec(line)?.[1])
    .filter((name): name is string => name !== undefined && name !== 'help');
}

describe('canonical help and compatibility aliases', () => {
  it('keeps public help and the declarative catalog complete in both directions', async () => {
    const canonical = commandCatalog.filter(
      definition => definition.public && definition.aliasFor === undefined,
    );
    const families = [
      ...new Set(
        canonical.flatMap(definition => {
          const [family, child] = definition.name.split(' ', 2);
          return family === undefined || child === undefined ? [] : [family];
        }),
      ),
    ];
    const root = await runCli(['--help']);
    const expectedRoot = [
      ...families,
      ...canonical
        .filter(definition => !definition.name.includes(' '))
        .map(definition => definition.name),
    ].toSorted((left, right) => left.localeCompare(right));
    expect(
      visibleCommands(root.stdout).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(expectedRoot);

    for (const family of families) {
      const expected = canonical
        .filter(definition => definition.name.startsWith(`${family} `))
        .map(definition => definition.name.slice(family.length + 1));
      const retainedBareAlias = commandCatalog.some(
        definition => definition.name === family && definition.aliasFor !== undefined,
      );
      if (retainedBareAlias) {
        for (const child of expected) {
          const childHelp = await runCli([family, child, '--help']);
          expect(childHelp.exitCode, `${family} ${child}`).toBe(0);
          expect(childHelp.stdout, `${family} ${child}`).toContain(
            `Usage: safeword ${family} ${child}`,
          );
        }
        continue;
      }
      const help = await runCli([family, '--help']);
      expect(
        visibleCommands(help.stdout).toSorted((left, right) => left.localeCompare(right)),
        family,
      ).toEqual(expected.toSorted((left, right) => left.localeCompare(right)));
    }
  });

  it('shows the simplified hierarchy and hides legacy and hook helpers', async () => {
    const result = await runCli(['--help']);

    for (const canonical of [
      'status',
      'install',
      'plan',
      'doctor',
      'uninstall',
      'project',
      'tracker',
      'codex',
      'ticket',
      'retro',
      'retro-relay-retry',
      'retro-relay-discard',
      'capabilities',
    ]) {
      expect(result.stdout).toContain(canonical);
    }
    const helpLines = result.stdout.split('\n').map(line => line.trimStart());
    for (const hidden of ['setup', 'check', 'diff', 'reset', 'boundary', 'codex-hook']) {
      expect(
        helpLines.some(
          line => (line === hidden || line.startsWith(`${hidden} `)) && !line.includes(' -> '),
        ),
      ).toBe(false);
    }
    expect(result.stdout).toContain('Compatibility routes (retained indefinitely):');
    expect(result.stdout).toContain('claude install -> install --agents=claude');
    expect(result.stdout).toContain(
      'project architecture --stage -> project architecture --from-index --stage-output',
    );
  });

  it.each([
    ['claude', 'install', '--no-modify'],
    ['codex', 'install', '--agents=cursor'],
    ['codex', 'install', '--scope=user'],
  ])('rejects irrelevant profile-only alias option: %s %s %s', async (...arguments_) => {
    const result = await runCli([...arguments_, '--json', '--offline']);

    expect(result.exitCode).toBe(1);
    const envelope = JSON.parse(result.stdout) as { errors: { code: string; message: string }[] };
    expect(envelope.errors).toContainEqual(
      expect.objectContaining({
        code: 'CLI_ARGUMENT_INVALID',
        message: expect.stringContaining('unknown option'),
      }),
    );
  });

  it('exposes only meaningful options on retained profile-install aliases', async () => {
    const claude = await runCli(['claude', 'install', '--help']);
    const codex = await runCli(['codex', 'install', '--help']);

    expect(claude.stdout).toContain('--scope <scope>');
    expect(claude.stdout).not.toContain('--agents <agents>');
    expect(claude.stdout).not.toContain('--no-modify');
    expect(codex.stdout).not.toContain('--scope <scope>');
    expect(codex.stdout).not.toContain('--agents <agents>');
    expect(codex.stdout).not.toContain('--no-modify');
  });

  it.each([
    ['check', 'status'],
    ['diff', 'plan'],
    ['reset', 'uninstall --agents=none'],
    ['retro', 'retro run'],
  ])('runs %s as a JSON-compatible alias for %s', async (legacy, replacement) => {
    const directory = createTemporaryDirectory();
    const result = await runCli([legacy, '--json', '--no-input', '--offline', '--cwd', directory], {
      cwd: directory,
    });

    const envelope = JSON.parse(result.stdout) as {
      findings: { code: string; metadata: { replacement: string } }[];
    };
    expect(envelope.findings).toContainEqual(
      expect.objectContaining({
        code: 'CLI_ALIAS_DEPRECATED',
        metadata: expect.objectContaining({ replacement }),
      }),
    );
  });

  it('retains the diff -v argument spelling', async () => {
    const directory = createTemporaryDirectory();
    const result = await runCli(['diff', '-v', '--json', '--no-input', '--offline'], {
      cwd: directory,
    });

    expect(result.stderr).toBe('');
    const envelope = JSON.parse(result.stdout) as {
      state: string;
      findings: { code: string }[];
    };
    expect(envelope.state).toBe('action_required');
    expect(envelope.findings.map(finding => finding.code)).toContain('LIFECYCLE_EFFECTS_PLANNED');
  });

  it('accepts reset -y safely without applying an unbound destructive plan', async () => {
    const directory = createTemporaryDirectory();
    const safewordDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(safewordDirectory);
    writeFileSync(nodePath.join(safewordDirectory, 'version'), '0.69.0\n');

    const result = await runCli(['reset', '-y', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
    });

    expect(result.exitCode).toBe(2);
    expect(existsSync(safewordDirectory)).toBe(true);
    const envelope = JSON.parse(result.stdout) as {
      state: string;
      changed: boolean;
      findings: { code: string }[];
      data: { plan: { id: string; requires_confirmation: boolean } };
    };
    expect(envelope).toMatchObject({
      state: 'action_required',
      changed: false,
      data: {
        plan: {
          id: expect.stringMatching(/^[a-f\d]{64}$/),
          requires_confirmation: true,
        },
      },
    });
    expect(envelope.findings.map(finding => finding.code)).toEqual(
      expect.arrayContaining(['CONFIRMATION_REQUIRED', 'CLI_ALIAS_DEPRECATED']),
    );
  });
});
