import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writeCodexRestartMarker } from '../../src/codex-plugin/profile-proof.js';
import {
  normalizeNamespaceRootLabel,
  packagedNamespaceRootLabel,
} from '../../src/commands/codex-hook.js';

describe('packagedNamespaceRootLabel', () => {
  const directories: string[] = [];
  const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

  function runCodexHook(
    projectDirectory: string,
    event: string,
    input: object | string,
    env?: NodeJS.ProcessEnv,
    pluginHook = false,
  ) {
    return spawnSync(
      process.execPath,
      [CLI_PATH, 'hook', 'codex', event, ...(pluginHook ? ['--plugin-hook'] : [])],
      {
        cwd: projectDirectory,
        input: typeof input === 'string' ? input : JSON.stringify(input),
        encoding: 'utf8',
        ...(env !== undefined && { env: { ...process.env, ...env } }),
      },
    );
  }

  function createLocalBiomeFixture(projectDirectory: string, relativeFile = 'source.ts') {
    markSafewordProject(projectDirectory);
    const sourceFile = nodePath.join(projectDirectory, relativeFile);
    const executable = nodePath.join(projectDirectory, 'node_modules', '.bin', 'biome');
    const log = nodePath.join(projectDirectory, 'biome.log');
    mkdirSync(nodePath.dirname(executable), { recursive: true });
    mkdirSync(nodePath.dirname(sourceFile), { recursive: true });
    writeFileSync(nodePath.join(projectDirectory, 'biome.json'), '{}\n');
    writeFileSync(sourceFile, 'export const source = 1;\n');
    writeFileSync(executable, `#!/bin/sh\necho "$*" >> ${JSON.stringify(log)}\n`);
    chmodSync(executable, 0o755);
    return { sourceFile, log };
  }

  function initializeCommittedProject(projectDirectory: string) {
    const run = (command: string, args: string[]) =>
      spawnSync(command, args, { cwd: projectDirectory, encoding: 'utf8' });
    expect(run('git', ['init', '-q']).status).toBe(0);
    expect(run('git', ['config', 'user.email', 'test@example.com']).status).toBe(0);
    expect(run('git', ['config', 'user.name', 'Test User']).status).toBe(0);
    writeFileSync(nodePath.join(projectDirectory, 'README.md'), '# fixture\n');
    expect(run('git', ['add', 'README.md']).status).toBe(0);
    expect(run('git', ['commit', '-qm', 'initial']).status).toBe(0);
  }

  function markSafewordProject(projectDirectory: string, config?: object) {
    const safewordDirectory = nodePath.join(projectDirectory, '.safeword');
    mkdirSync(safewordDirectory, { recursive: true });
    writeFileSync(nodePath.join(safewordDirectory, 'SAFEWORD.md'), '# enrolled\n');
    if (config !== undefined) {
      writeFileSync(nodePath.join(safewordDirectory, 'config.json'), JSON.stringify(config));
    }
  }

  function rootEntries(projectDirectory: string): string[] {
    return readdirSync(projectDirectory).toSorted((left, right) => left.localeCompare(right));
  }

  function expectBiomeChecked(log: string, operand: string) {
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      `check --write -- ${operand}`,
      `check -- ${operand}`,
    ]);
  }

  afterEach(() => {
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true });
    }
    directories.length = 0;
  });

  it('includes a custom project root in the generated ownership module', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'knowledge' } }),
    );

    expect(packagedNamespaceRootLabel(projectDirectory)).toBe('knowledge');
  });

  it('replaces the matching restart marker with current proof on plugin SessionStart', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const codexHome = nodePath.join(projectDirectory, 'profile');
    const environment = { CODEX_HOME: codexHome };
    writeCodexRestartMarker(environment);

    const result = runCodexHook(
      projectDirectory,
      'session-start',
      { hook_event_name: 'SessionStart', cwd: projectDirectory },
      environment,
      true,
    );

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(nodePath.join(codexHome, 'safeword/restart-pending-v1.json'))).toBe(false);
    const proof = JSON.parse(
      readFileSync(nodePath.join(codexHome, 'safeword/hook-proof-v1.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(proof.schema_version).toBe(1);
    expect(proof.manifest_sha256).toMatch(/^[\da-f]{64}$/u);
  });

  it('normalizes Windows custom roots for Git-owned path matching', () => {
    expect(normalizeNamespaceRootLabel(String.raw`knowledge\docs`)).toBe('knowledge/docs');
  });

  it('stages an auto-upgrade change under a custom namespace through SessionStart', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const run = (command: string, args: string[]) =>
      spawnSync(command, args, { cwd: projectDirectory, encoding: 'utf8' });
    expect(run('git', ['init', '-q']).status).toBe(0);
    expect(run('git', ['config', 'user.email', 'test@example.com']).status).toBe(0);
    expect(run('git', ['config', 'user.name', 'Test User']).status).toBe(0);
    writeFileSync(nodePath.join(projectDirectory, 'README.md'), '# fixture\n');
    expect(run('git', ['add', 'README.md']).status).toBe(0);
    expect(run('git', ['commit', '-qm', 'initial']).status).toBe(0);

    const safewordDirectory = nodePath.join(projectDirectory, '.safeword');
    mkdirSync(safewordDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(safewordDirectory, 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'knowledge' } }),
    );
    writeFileSync(nodePath.join(safewordDirectory, 'version'), '1.0.0\n');
    writeFileSync(
      nodePath.join(safewordDirectory, '.update-cache.json'),
      JSON.stringify({
        latestVersion: '1.0.1',
        publishedAt: Date.now() - 24 * 60 * 60 * 1000,
        checkedAt: Date.now(),
      }),
    );
    writeFileSync(nodePath.join(safewordDirectory, 'SAFEWORD.md'), '# context\n');
    expect(run('git', ['add', '.safeword']).status).toBe(0);
    expect(run('git', ['commit', '-qm', 'configure safeword']).status).toBe(0);

    const binDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-bin-'));
    directories.push(binDirectory);
    const bunxPath = nodePath.join(binDirectory, 'bunx');
    writeFileSync(
      bunxPath,
      '#!/bin/sh\nmkdir -p knowledge\nprintf "upgraded\\n" > knowledge/UPGRADE.md\n',
    );
    chmodSync(bunxPath, 0o755);

    const result = runCodexHook(
      projectDirectory,
      'session-start',
      { hook_event_name: 'SessionStart', cwd: projectDirectory },
      {
        CI: '',
        SAFEWORD_NO_AUTO_UPGRADE: '',
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(run('git', ['show', '--format=', '--name-only', 'HEAD']).stdout).toContain(
      'knowledge/UPGRADE.md',
    );
  });

  it('injects package-owned SessionStart instructions instead of project-local text', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'SAFEWORD.md'),
      'PROJECT-LOCAL INSTRUCTIONS MUST NOT APPEAR',
    );

    const result = runCodexHook(
      projectDirectory,
      'session-start',
      { hook_event_name: 'SessionStart', cwd: projectDirectory },
      { SAFEWORD_NO_AUTO_UPGRADE: '1' },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('SAFEWORD Agent Instructions');
    expect(result.stdout).not.toContain('PROJECT-LOCAL INSTRUCTIONS MUST NOT APPEAR');
  });

  it('keeps an unconfigured repository unchanged through SessionStart', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-unconfigured-'));
    directories.push(projectDirectory);
    initializeCommittedProject(projectDirectory);
    const before = rootEntries(projectDirectory);

    const result = runCodexHook(
      projectDirectory,
      'session-start',
      { hook_event_name: 'SessionStart', cwd: projectDirectory },
      { SAFEWORD_NO_AUTO_UPGRADE: '1' },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('SAFEWORD Agent Instructions');
    expect(rootEntries(projectDirectory)).toEqual(before);
  });

  it('does not create project state after tool use in an unconfigured repository', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-unconfigured-'));
    directories.push(projectDirectory);
    initializeCommittedProject(projectDirectory);
    const before = rootEntries(projectDirectory);

    const result = runCodexHook(projectDirectory, 'post-tool-use', {
      hook_event_name: 'PostToolUse',
      session_id: 'unconfigured-session',
      tool_name: 'Bash',
      tool_input: { command: 'pwd' },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(rootEntries(projectDirectory)).toEqual(before);
  });

  it('fails open without project state before an unconfigured tool use', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-unconfigured-'));
    directories.push(projectDirectory);
    initializeCommittedProject(projectDirectory);
    const before = rootEntries(projectDirectory);

    const result = runCodexHook(
      projectDirectory,
      'pre-tool-use',
      {
        session_id: 'unconfigured-session',
        tool_name: 'Bash',
        tool_input: { command: 'pkill node' },
      },
      { SAFEWORD_CODEX_DENY_MODE: 'exit-code' },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(rootEntries(projectDirectory)).toEqual(before);
  });

  it.each([
    {
      label: 'default',
      namespace: '.project',
      configure: (projectDirectory: string) => {
        markSafewordProject(projectDirectory);
        mkdirSync(nodePath.join(projectDirectory, '.project'));
      },
    },
    {
      label: 'legacy',
      namespace: '.safeword-project',
      configure: (projectDirectory: string) => {
        markSafewordProject(projectDirectory);
        mkdirSync(nodePath.join(projectDirectory, '.safeword-project'));
      },
    },
    {
      label: 'custom',
      namespace: 'knowledge',
      configure: (projectDirectory: string) => {
        markSafewordProject(projectDirectory, { paths: { projectRoot: 'knowledge' } });
        mkdirSync(nodePath.join(projectDirectory, 'knowledge'));
      },
    },
  ])('writes quality state for an enrolled $label namespace', ({ configure, label, namespace }) => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-enrolled-'));
    directories.push(projectDirectory);
    initializeCommittedProject(projectDirectory);
    configure(projectDirectory);

    const result = runCodexHook(projectDirectory, 'post-tool-use', {
      hook_event_name: 'PostToolUse',
      session_id: `${label}-session`,
      tool_name: 'Bash',
      tool_input: { command: 'pwd' },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(
      existsSync(
        nodePath.join(projectDirectory, namespace, `quality-state-codex-${label}-session.json`),
      ),
    ).toBe(true);
    if (namespace !== '.project') {
      expect(existsSync(nodePath.join(projectDirectory, '.project'))).toBe(false);
    }
  });

  it('routes a Codex file edit through the packaged local Biome hook', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-host-toolchain-'));
    directories.push(projectDirectory);
    const { sourceFile, log } = createLocalBiomeFixture(projectDirectory);

    const result = runCodexHook(projectDirectory, 'post-tool-use', {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: sourceFile },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(log)).toBe(true);
    expectBiomeChecked(log, 'source.ts');
  });

  it('warns through the packaged Codex hook when an edited-file symlink escapes the project', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-host-escape-'));
    const outside = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-host-escape-outside-'));
    const binDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-host-escape-bin-'));
    directories.push(projectDirectory, outside, binDirectory);
    const outsideSource = nodePath.join(outside, 'source.ts');
    const linkedSource = nodePath.join(projectDirectory, 'linked.ts');
    const executable = nodePath.join(projectDirectory, 'node_modules', '.bin', 'biome');
    const hostLog = nodePath.join(projectDirectory, 'biome.log');
    const genericLog = nodePath.join(projectDirectory, 'generic.log');
    markSafewordProject(projectDirectory);
    mkdirSync(nodePath.dirname(executable), { recursive: true });
    writeFileSync(nodePath.join(projectDirectory, 'biome.json'), '{}\n');
    writeFileSync(outsideSource, 'export const source = 1;\n');
    symlinkSync(outsideSource, linkedSource);
    writeFileSync(executable, `#!/bin/sh\necho host >> ${JSON.stringify(hostLog)}\n`);
    writeFileSync(
      nodePath.join(binDirectory, 'bunx'),
      `#!/bin/sh\necho generic >> ${JSON.stringify(genericLog)}\n`,
    );
    chmodSync(executable, 0o755);
    chmodSync(nodePath.join(binDirectory, 'bunx'), 0o755);

    const result = runCodexHook(
      projectDirectory,
      'post-tool-use',
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: linkedSource },
      },
      { PATH: `${binDirectory}:${process.env.PATH ?? ''}` },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(
      JSON.parse(result.stdout) as { hookSpecificOutput: { additionalContext: string } },
    ).toMatchObject({
      hookSpecificOutput: {
        additionalContext: expect.stringMatching(/outside.*Safeword project root/i),
      },
    });
    expect(existsSync(hostLog)).toBe(false);
    expect(existsSync(genericLog)).toBe(false);
  });

  it('routes Codex apply_patch targets through the packaged local Biome hook', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-host-patch-'));
    directories.push(projectDirectory);
    const { log } = createLocalBiomeFixture(projectDirectory);

    const result = runCodexHook(projectDirectory, 'post-tool-use', {
      hook_event_name: 'PostToolUse',
      tool_name: 'apply_patch',
      tool_input: { command: '*** Begin Patch\n*** Update File: source.ts\n*** End Patch' },
    });

    expect(result.status, result.stderr).toBe(0);
    expectBiomeChecked(log, 'source.ts');
  });

  it('continues linting later apply_patch targets after an earlier host warning', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-host-multi-'));
    directories.push(projectDirectory);
    const first = nodePath.join(projectDirectory, 'first.ts');
    const nested = nodePath.join(projectDirectory, 'apps', 'web');
    const second = nodePath.join(nested, 'second.ts');
    const executable = nodePath.join(nested, 'node_modules', '.bin', 'biome');
    const log = nodePath.join(projectDirectory, 'biome.log');
    markSafewordProject(projectDirectory);
    mkdirSync(nodePath.dirname(executable), { recursive: true });
    writeFileSync(nodePath.join(projectDirectory, 'biome.json'), '{}\n');
    writeFileSync(nodePath.join(nested, 'biome.json'), '{}\n');
    writeFileSync(first, 'export const first = 1;\n');
    writeFileSync(second, 'export const second = 1;\n');
    writeFileSync(executable, `#!/bin/sh\necho "$*" >> ${JSON.stringify(log)}\n`);
    chmodSync(executable, 0o755);

    const result = runCodexHook(projectDirectory, 'post-tool-use', {
      hook_event_name: 'PostToolUse',
      tool_name: 'apply_patch',
      tool_input: {
        command:
          '*** Begin Patch\n*** Update File: first.ts\n*** Update File: apps/web/second.ts\n*** End Patch',
      },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(
      JSON.parse(result.stdout) as { hookSpecificOutput: { additionalContext: string } },
    ).toMatchObject({
      hookSpecificOutput: {
        additionalContext: expect.stringMatching(/no project-local executable/i),
      },
    });
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      'check --write -- second.ts',
      'check -- second.ts',
    ]);
  });

  it('preserves legacy timestamp and retro-nudge prompt context through the plugin dispatcher', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const sessionId = 'prompt-parity-session';
    const spoolDirectory = nodePath.join(projectDirectory, '.safeword', 'retro-drafts');
    markSafewordProject(projectDirectory);
    mkdirSync(spoolDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(spoolDirectory, `${sessionId}.jsonl`),
      `${JSON.stringify({
        signature: 'retro:prompt-parity',
        title: 'Prompt parity',
        body: 'Sanitized finding.',
        labels: ['bug'],
      })}\n`,
    );

    const runPromptHook = () =>
      runCodexHook(projectDirectory, 'user-prompt-submit', {
        hook_event_name: 'UserPromptSubmit',
        session_id: sessionId,
      });

    const first = runPromptHook();
    expect(first.status, first.stderr).toBe(0);
    const firstOutput = JSON.parse(first.stdout) as {
      hookSpecificOutput?: { additionalContext?: unknown; hookEventName?: unknown };
    };
    expect(firstOutput.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    expect(String(firstOutput.hookSpecificOutput?.additionalContext)).toContain('Current time:');
    expect(String(firstOutput.hookSpecificOutput?.additionalContext)).toContain(
      "Safeword's retro spooled 1 unfiled finding",
    );

    const second = runPromptHook();
    expect(second.status, second.stderr).toBe(0);
    const secondOutput = JSON.parse(second.stdout) as {
      hookSpecificOutput?: { additionalContext?: unknown };
    };
    expect(String(secondOutput.hookSpecificOutput?.additionalContext)).toContain('Current time:');
    expect(String(secondOutput.hookSpecificOutput?.additionalContext)).not.toContain(
      "Safeword's retro spooled",
    );
  });

  it('propagates an exit-code denial from the packaged PreToolUse adapter', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    markSafewordProject(projectDirectory);

    const result = runCodexHook(
      projectDirectory,
      'pre-tool-use',
      {
        session_id: 'deny-session',
        tool_name: 'Bash',
        tool_input: { command: 'pkill node' },
      },
      { SAFEWORD_CODEX_DENY_MODE: 'exit-code' },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Broad process kill blocked');
  });

  it('fails PreToolUse visibly when Bun is unavailable', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    markSafewordProject(projectDirectory);

    const result = runCodexHook(
      projectDirectory,
      'pre-tool-use',
      { tool_name: 'Bash', tool_input: { command: 'echo allowed' } },
      { PATH: '' },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('bun');
  });

  it('reports an unknown event without blocking the Codex hook process', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);

    const result = runCodexHook(projectDirectory, 'before-tool-use', '{}');

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('unknown Codex hook event: before-tool-use');
  });
});
