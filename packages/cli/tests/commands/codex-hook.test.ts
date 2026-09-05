import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
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

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CODEX_PLUGIN_HOOK_EVENTS,
  codexProofPath,
  observeCodexHookProof,
  observeCodexSessionProof,
  writeCodexActivationMarker,
} from '../../src/codex-plugin/profile-proof.js';
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
    const isolatedCodexHome =
      env?.CODEX_HOME ?? mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-profile-'));
    if (env?.CODEX_HOME === undefined) directories.push(isolatedCodexHome);
    return spawnSync(
      process.execPath,
      [CLI_PATH, 'hook', 'codex', event, ...(pluginHook ? ['--plugin-hook'] : [])],
      {
        cwd: projectDirectory,
        input: typeof input === 'string' ? input : JSON.stringify(input),
        encoding: 'utf8',
        env: { ...process.env, CODEX_HOME: isolatedCodexHome, ...env },
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

  function createPackagedCliFixture() {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    const packageDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-stale-package-'));
    directories.push(projectDirectory, packageDirectory);
    markSafewordProject(projectDirectory);
    cpSync(
      nodePath.resolve(import.meta.dirname, '../../templates'),
      nodePath.join(packageDirectory, 'templates'),
      {
        recursive: true,
      },
    );
    cpSync(
      nodePath.resolve(import.meta.dirname, '../../dist'),
      nodePath.join(packageDirectory, 'dist'),
      { recursive: true },
    );
    cpSync(
      nodePath.resolve(import.meta.dirname, '../../package.json'),
      nodePath.join(packageDirectory, 'package.json'),
    );
    return { packageDirectory, projectDirectory };
  }

  async function waitForHookSnapshot(processId: number): Promise<void> {
    const snapshotPrefix = `safeword-codex-hook-snapshot-${processId}-`;
    await vi.waitFor(
      () => {
        expect(
          readdirSync(tmpdir()).some(
            entry =>
              entry.startsWith(snapshotPrefix) &&
              existsSync(nodePath.join(tmpdir(), entry, 'hooks')),
          ),
        ).toBe(true);
      },
      { interval: 10, timeout: 5000 },
    );
  }

  async function runHookWhilePackageIsReplaced(command: string) {
    const { packageDirectory, projectDirectory } = createPackagedCliFixture();
    const child = spawn(
      'bun',
      [nodePath.join(packageDirectory, 'dist/cli.js'), 'hook', 'codex', 'pre-tool-use'],
      { cwd: projectDirectory, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => (stdout += String(chunk)));
    child.stderr.on('data', chunk => (stderr += String(chunk)));

    if (child.pid === undefined) throw new Error('Packaged hook process did not start');
    await waitForHookSnapshot(child.pid);
    rmSync(nodePath.join(packageDirectory, 'templates'), { recursive: true, force: true });
    child.stdin.end(
      JSON.stringify({
        session_id: 'stale-package-session',
        tool_name: 'Bash',
        tool_input: { command },
      }),
    );
    const status = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    return { status, stderr, stdout };
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
    vi.unstubAllEnvs();
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true });
    }
    directories.length = 0;
  });

  it('does not let a packaged-hook test write proof into its runner profile', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    const runnerCodexHome = mkdtempSync(nodePath.join(tmpdir(), 'safeword-test-runner-profile-'));
    directories.push(projectDirectory, runnerCodexHome);
    markSafewordProject(projectDirectory);
    vi.stubEnv('CODEX_HOME', runnerCodexHome);

    const result = runCodexHook(
      projectDirectory,
      'pre-tool-use',
      {
        session_id: 'isolated-test-session',
        tool_name: 'Bash',
        tool_input: { command: 'echo safe' },
      },
      undefined,
      true,
    );

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(codexProofPath({ CODEX_HOME: runnerCodexHome }, 'pre-tool-use'))).toBe(false);
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

  it('keeps activation pending when plugin SessionStart runs under the installing app', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const codexHome = nodePath.join(projectDirectory, 'profile');
    const environment = { CODEX_HOME: codexHome };
    writeCodexActivationMarker(environment);

    const result = runCodexHook(
      projectDirectory,
      'session-start',
      { hook_event_name: 'SessionStart', cwd: projectDirectory },
      environment,
      true,
    );

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
    const proof = JSON.parse(
      readFileSync(nodePath.join(codexHome, 'safeword/hook-proof-v2/session-start.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(proof.schema_version).toBe(2);
    expect(proof.manifest_sha256).toMatch(/^[\da-f]{64}$/u);
  });

  it('records resumed-task proof under the git root when the hook starts nested', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-root-'));
    directories.push(projectDirectory);
    expect(spawnSync('git', ['init', projectDirectory]).status).toBe(0);
    const nested = nodePath.join(projectDirectory, 'packages', 'app');
    mkdirSync(nested, { recursive: true });
    const environment = { CODEX_HOME: nodePath.join(projectDirectory, 'profile') };

    const result = runCodexHook(
      nested,
      'session-start',
      { hook_event_name: 'SessionStart', session_id: 'task-a', source: 'resume' },
      environment,
      true,
    );

    expect(result.status, result.stderr).toBe(0);
    expect(observeCodexSessionProof(projectDirectory, 'task-a', environment).status).toBe(
      'current',
    );
  });

  it('degrades a non-string session id to unbound hook proof', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-input-'));
    directories.push(projectDirectory);
    const codexHome = nodePath.join(projectDirectory, 'profile');
    const environment = { CODEX_HOME: codexHome };

    const result = runCodexHook(
      projectDirectory,
      'session-start',
      { hook_event_name: 'SessionStart', session_id: 42 },
      environment,
      true,
    );

    expect(result.status, result.stderr).toBe(0);
    const proof = JSON.parse(
      readFileSync(nodePath.join(codexHome, 'safeword/hook-proof-v2/session-start.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(proof.schema_version).toBe(2);
    expect(existsSync(nodePath.join(codexHome, 'safeword/session-proof-v1'))).toBe(false);
  });

  it('does not retire a legacy restart marker from hook proof alone', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const codexHome = nodePath.join(projectDirectory, 'profile');
    const environment = { CODEX_HOME: codexHome };
    const legacyPath = nodePath.join(codexHome, 'safeword/restart-pending-v1.json');
    const marker = writeCodexActivationMarker(environment);
    writeFileSync(
      legacyPath,
      JSON.stringify({
        schema_version: 1,
        plugin_version: marker.plugin_version,
        manifest_sha256: marker.manifest_sha256,
      }),
    );
    rmSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'));

    const result = runCodexHook(
      projectDirectory,
      'session-start',
      { hook_event_name: 'SessionStart', cwd: projectDirectory },
      environment,
      true,
    );

    expect(result.status, result.stderr).toBe(0);
    expect(marker.plugin_version).toBeDefined();
    expect(existsSync(legacyPath)).toBe(true);
    expect(existsSync(nodePath.join(codexHome, 'safeword/hook-proof-v2/session-start.json'))).toBe(
      true,
    );
  });

  it('retires a superseded legacy marker after writing canonical activation state', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const codexHome = nodePath.join(projectDirectory, 'profile');
    const environment = { CODEX_HOME: codexHome };
    const activationPath = nodePath.join(codexHome, 'safeword/activation-pending-v2.json');
    const legacyPath = nodePath.join(codexHome, 'safeword/restart-pending-v1.json');
    mkdirSync(nodePath.dirname(legacyPath), { recursive: true });
    writeFileSync(
      legacyPath,
      JSON.stringify({
        schema_version: 1,
        plugin_version: '0.70.0',
        manifest_sha256: '0'.repeat(64),
      }),
    );

    writeCodexActivationMarker(environment);

    expect(existsSync(activationPath)).toBe(true);
    expect(existsSync(legacyPath)).toBe(false);
  });

  it('records only the event executed by each packaged plugin hook', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const codexHome = nodePath.join(projectDirectory, 'profile');
    const environment = { CODEX_HOME: codexHome };

    for (const [index, event] of CODEX_PLUGIN_HOOK_EVENTS.entries()) {
      const result = runCodexHook(
        projectDirectory,
        event,
        {
          hook_event_name: event,
          session_id: 'proof-wiring-session',
          tool_name: 'Bash',
          tool_input: { command: 'pwd' },
        },
        environment,
        true,
      );

      expect(result.status, result.stderr).toBe(0);
      expect(
        readdirSync(nodePath.join(codexHome, 'safeword/hook-proof-v2')).toSorted((left, right) =>
          left.localeCompare(right),
        ),
      ).toEqual(
        CODEX_PLUGIN_HOOK_EVENTS.slice(0, index + 1)
          .map(proofEvent => `${proofEvent}.json`)
          .toSorted((left, right) => left.localeCompare(right)),
      );
    }

    expect(observeCodexHookProof(environment)).toMatchObject({
      status: 'current',
      missing_events: [],
    });
  });

  it('keeps every packaged manifest hook wired to the proof event contract', () => {
    const manifestPath = nodePath.resolve(import.meta.dirname, '../../codex-plugin/hooks.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    const manifestEventNames: Record<string, string> = {
      PostToolUse: 'post-tool-use',
      PreToolUse: 'pre-tool-use',
      SessionStart: 'session-start',
      Stop: 'stop',
      UserPromptSubmit: 'user-prompt-submit',
    };

    expect(
      Object.values(manifestEventNames).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual([...CODEX_PLUGIN_HOOK_EVENTS].toSorted((left, right) => left.localeCompare(right)));
    expect(
      Object.keys(manifest.hooks).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(Object.keys(manifestEventNames).toSorted((left, right) => left.localeCompare(right)));
    for (const [manifestEvent, proofEvent] of Object.entries(manifestEventNames)) {
      const commands = manifest.hooks[manifestEvent]?.flatMap(group =>
        group.hooks.map(hook => hook.command),
      );
      expect(commands).toEqual([expect.stringContaining(`hook codex ${proofEvent} --plugin-hook`)]);
    }
  });

  it('does not create plugin proof from legacy SessionStart', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-'));
    directories.push(projectDirectory);
    const codexHome = nodePath.join(projectDirectory, 'profile');

    const result = runCodexHook(
      projectDirectory,
      'session-start',
      { hook_event_name: 'SessionStart', cwd: projectDirectory },
      { CODEX_HOME: codexHome, SAFEWORD_NO_AUTO_UPGRADE: '1' },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(nodePath.join(codexHome, 'safeword/hook-proof-v2/session-start.json'))).toBe(
      false,
    );
  });

  it('normalizes Windows custom roots for Git-owned path matching', () => {
    expect(normalizeNamespaceRootLabel(String.raw`knowledge\docs`)).toBe('knowledge/docs');
  });

  it('does not auto-upgrade a custom namespace through SessionStart', () => {
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
    const beforeHead = run('git', ['rev-parse', 'HEAD']).stdout.trim();

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
    expect(existsSync(nodePath.join(projectDirectory, 'knowledge/UPGRADE.md'))).toBe(false);
    expect(run('git', ['rev-parse', 'HEAD']).stdout.trim()).toBe(beforeHead);
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
    expect(result.stdout).toContain('Safeword session bootstrap');
    expect(result.stdout).toContain('the packaged Safeword handbook');
    expect(result.stdout).toContain('the packaged Safeword guides');
    expect(result.stdout).toContain('.project/');
    expect(result.stdout).toContain('supersede');
    expect(result.stdout).not.toContain('.safeword/guides/');
    expect(result.stdout).not.toContain('.safeword/SAFEWORD.md');
    expect(result.stdout.length).toBeLessThanOrEqual(1000);
    expect(result.stdout).not.toContain('PROJECT-LOCAL INSTRUCTIONS MUST NOT APPEAR');
  });

  it('keeps the packaged SessionStart fallback compact when its dispatcher is unavailable', () => {
    const { packageDirectory, projectDirectory } = createPackagedCliFixture();
    rmSync(nodePath.join(packageDirectory, 'templates', 'hooks', 'session-codex-start.ts'));

    const result = spawnSync(
      'bun',
      [nodePath.join(packageDirectory, 'dist', 'cli.js'), 'hook', 'codex', 'session-start'],
      {
        cwd: projectDirectory,
        input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: projectDirectory }),
        encoding: 'utf8',
        env: { ...process.env, SAFEWORD_NO_AUTO_UPGRADE: '1' },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Safeword session bootstrap');
    expect(result.stdout).toContain('the packaged Safeword handbook');
    expect(result.stdout).not.toContain('SAFEWORD Agent Instructions');
    expect(result.stdout.length).toBeLessThanOrEqual(1000);
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
    expect(result.stdout).toContain('Safeword session bootstrap');
    expect(result.stdout).toContain('the packaged Safeword handbook');
    expect(result.stdout.length).toBeLessThanOrEqual(1000);
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
    ['an absolute default-namespace path', '.project', undefined],
    ['an absolute custom-namespace path', 'knowledge', { paths: { projectRoot: 'knowledge' } }],
  ])('enforces ticket intake for %s', (_case, namespaceRoot, config) => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-enrolled-'));
    directories.push(projectDirectory);
    markSafewordProject(projectDirectory, config);
    const ticketDirectory = nodePath.join(projectDirectory, namespaceRoot, 'tickets/incomplete');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      '---\nid: incomplete\ntype: task\n---\n',
    );

    const result = runCodexHook(
      projectDirectory,
      'pre-tool-use',
      {
        session_id: 'intake-session',
        tool_name: 'Write',
        tool_input: { file_path: nodePath.join(ticketDirectory, 'test-definitions.md') },
      },
      {
        CLAUDE_PROJECT_DIR: projectDirectory,
        SAFEWORD_CODEX_DENY_MODE: 'exit-code',
      },
    );

    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(2);
    expect(result.stderr).toContain('scope, out_of_scope, done_when');
  });

  it('defers a plugin event to an exact runnable legacy handler', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-enrolled-'));
    const binDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-bin-'));
    directories.push(projectDirectory, binDirectory);
    markSafewordProject(projectDirectory);
    mkdirSync(nodePath.join(projectDirectory, '.codex'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.codex/config.toml'),
      `[[hooks.PreToolUse]]
[[hooks.PreToolUse.hooks]]
type = "command"
command = "npx --yes safeword hook codex pre-tool-use"
`,
    );
    const packageRunner = nodePath.join(binDirectory, 'npx');
    writeFileSync(packageRunner, '#!/bin/sh\nexit 0\n');
    chmodSync(packageRunner, 0o755);

    const result = runCodexHook(
      projectDirectory,
      'pre-tool-use',
      {
        session_id: 'compatibility-session',
        tool_name: 'Bash',
        tool_input: { command: 'pkill node' },
      },
      {
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_DENY_MODE: 'exit-code',
      },
      true,
    );

    expect(result.status, result.stderr).toBe(0);
  });

  it('runs the plugin for an event missing from a partial legacy installation', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-enrolled-'));
    directories.push(projectDirectory);
    markSafewordProject(projectDirectory);
    mkdirSync(nodePath.join(projectDirectory, '.codex'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.codex/config.toml'),
      `[[hooks.PostToolUse]]
[[hooks.PostToolUse.hooks]]
type = "command"
command = "npx --yes safeword hook codex post-tool-use"
`,
    );

    const result = runCodexHook(
      projectDirectory,
      'pre-tool-use',
      {
        session_id: 'compatibility-session',
        tool_name: 'Bash',
        tool_input: { command: 'pkill node' },
      },
      { SAFEWORD_CODEX_DENY_MODE: 'exit-code' },
      true,
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain('Broad process kill blocked');
  });

  it('treats an executable package runner as viable without spawning it', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-enrolled-'));
    const binDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-hook-bin-'));
    directories.push(projectDirectory, binDirectory);
    markSafewordProject(projectDirectory);
    mkdirSync(nodePath.join(projectDirectory, '.codex'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.codex/config.toml'),
      `[[hooks.PreToolUse]]
[[hooks.PreToolUse.hooks]]
type = "command"
command = "npx --yes safeword hook codex pre-tool-use"
`,
    );
    const brokenPackageRunner = nodePath.join(binDirectory, 'npx');
    writeFileSync(brokenPackageRunner, '#!/bin/sh\nexit 127\n');
    chmodSync(brokenPackageRunner, 0o755);

    const result = runCodexHook(
      projectDirectory,
      'pre-tool-use',
      {
        session_id: 'compatibility-session',
        tool_name: 'Bash',
        tool_input: { command: 'pkill node' },
      },
      {
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_DENY_MODE: 'exit-code',
      },
      true,
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
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

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain('Broad process kill blocked');
  });

  it('fails closed on structured hook output in OpenCode exit-code mode', () => {
    const { packageDirectory, projectDirectory } = createPackagedCliFixture();
    symlinkSync(
      nodePath.resolve(import.meta.dirname, '../../node_modules'),
      nodePath.join(packageDirectory, 'node_modules'),
      'dir',
    );
    writeFileSync(
      nodePath.join(packageDirectory, 'templates/hooks/codex/pre-tool-quality.ts'),
      `process.stdout.write(JSON.stringify({ hookSpecificOutput: { permissionDecision: 'deny' } }));\n`,
    );

    const result = spawnSync(
      process.execPath,
      [nodePath.join(packageDirectory, 'dist/cli.js'), 'hook', 'codex', 'pre-tool-use'],
      {
        cwd: projectDirectory,
        env: {
          ...process.env,
          SAFEWORD_AGENT_RUNTIME: 'opencode',
          SAFEWORD_CODEX_DENY_MODE: 'exit-code',
        },
        input: JSON.stringify({
          session_id: 'structured-deny-session',
          tool_name: 'Bash',
          tool_input: { command: 'echo safe' },
        }),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain('unsupported output in exit-code mode');
  });

  it('allows a safe command after bunx replaces the packaged PreToolUse hook tree', async () => {
    const allowed = await runHookWhilePackageIsReplaced("sed -n '1,20p' README.md");
    expect(allowed.status, allowed.stderr).toBe(0);
    expect(allowed.stdout).toBe('');
  });

  it('preserves a structured denial after bunx replaces the packaged PreToolUse hook tree', async () => {
    const denied = await runHookWhilePackageIsReplaced('pkill node');
    expect(denied.status, denied.stderr).toBe(0);
    const output = JSON.parse(denied.stdout) as {
      hookSpecificOutput?: { permissionDecision?: unknown; permissionDecisionReason?: unknown };
    };
    expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput?.permissionDecisionReason).toContain(
      'Broad process kill blocked',
    );
  });

  it('fails closed when the packaged PreToolUse hook tree is already unavailable', () => {
    const { packageDirectory, projectDirectory } = createPackagedCliFixture();
    rmSync(nodePath.join(packageDirectory, 'templates'), { recursive: true, force: true });

    const result = spawnSync(
      'bun',
      [nodePath.join(packageDirectory, 'dist/cli.js'), 'hook', 'codex', 'pre-tool-use'],
      {
        cwd: projectDirectory,
        input: JSON.stringify({
          session_id: 'missing-package-session',
          tool_name: 'Bash',
          tool_input: { command: "sed -n '1,20p' README.md" },
        }),
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Safeword packaged PreToolUse hook failed');
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
