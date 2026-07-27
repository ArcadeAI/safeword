/**
 * Integration tests for cleanup-zombies.sh script
 *
 * Tests the detection logic by running the script with --dry-run
 * in temp directories with mock config files.
 */

import { type ChildProcess, execSync, spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = nodePath.join(__dirname, '../../templates/scripts/cleanup-zombies.sh');
const MOCK_PORT = 5173;
const MOCK_PID = 4242;
const MOCK_SECOND_PID = 4343;

describe('cleanup-zombies.sh', () => {
  let isolatedPath: string;
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'cleanup-zombies-test-'));
    const isolatedBinaryDirectory = nodePath.join(temporaryDirectory, 'isolated-bin');
    mkdirSync(isolatedBinaryDirectory);
    for (const command of ['lsof', 'pgrep']) {
      const commandPath = nodePath.join(isolatedBinaryDirectory, command);
      writeExecutable(commandPath, '#!/usr/bin/env bash\nexit 1\n');
    }
    isolatedPath = `${isolatedBinaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`;
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  /** Run the real script with the args exactly as given. */
  function runScriptRaw(args: string[] = [], environmentOverrides: NodeJS.ProcessEnv = {}): string {
    const command = `bash "${SCRIPT_PATH}" ${args.join(' ')}`;
    return execSync(command, {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: { ...process.env, PATH: isolatedPath, ...environmentOverrides },
    });
  }

  /** Detection-suite default: always preview explicitly. */
  function runScript(args: string[] = []): string {
    return runScriptRaw(['--dry-run', ...args]);
  }

  function createFile(relativePath: string, content = ''): void {
    const fullPath = nodePath.join(temporaryDirectory, relativePath);
    const dir = fullPath.slice(0, Math.max(0, fullPath.lastIndexOf('/')));
    if (dir && dir !== temporaryDirectory) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
  }

  function writeExecutable(filePath: string, content: string): void {
    writeFileSync(filePath, content);
    chmodSync(filePath, 0o755);
  }

  function mockLiveProcessOwnership(
    pid: number,
    pattern: string,
    mockDiscovery = true,
  ): NodeJS.ProcessEnv {
    const binaryDirectory = nodePath.join(temporaryDirectory, 'live-bin');
    const lsofPath = nodePath.join(binaryDirectory, 'lsof');
    const pgrepPath = nodePath.join(binaryDirectory, 'pgrep');
    mkdirSync(binaryDirectory);
    writeExecutable(
      lsofPath,
      String.raw`#!/usr/bin/env bash
if [[ "$1" == "-a" ]] && [[ "$2" == "-p" ]] &&
  [[ ",$3," == *",$MOCK_LIVE_PID,"* ]] &&
  [[ "$4" == "-d" ]] && [[ "$5" == "cwd" ]] && [[ "$6" == "-Fpn0" ]]; then
  printf 'p%s\0\nfcwd\0n%s\0\n' "$MOCK_LIVE_PID" "$MOCK_LIVE_CWD"
fi
`,
    );
    if (mockDiscovery) {
      writeExecutable(
        pgrepPath,
        String.raw`#!/usr/bin/env bash
if [[ "$*" == "-f $MOCK_LIVE_PATTERN" ]]; then
  printf '%s\n' "$MOCK_LIVE_PID"
fi
`,
      );
    }
    return {
      MOCK_LIVE_CWD: realpathSync(temporaryDirectory),
      MOCK_LIVE_PATTERN: pattern,
      MOCK_LIVE_PID: String(pid),
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
    };
  }

  function mockAllLiveProcessOwnership(): NodeJS.ProcessEnv {
    const binaryDirectory = nodePath.join(temporaryDirectory, 'all-live-bin');
    const lsofPath = nodePath.join(binaryDirectory, 'lsof');
    mkdirSync(binaryDirectory);
    writeExecutable(
      lsofPath,
      String.raw`#!/usr/bin/env bash
if [[ "$1" == "-a" ]] && [[ "$2" == "-p" ]] && [[ "$4" == "-d" ]] &&
  [[ "$5" == "cwd" ]] && [[ "$6" == "-Fpn0" ]]; then
  for pid in \${3//,/ }; do
    if kill -0 "$pid" 2> /dev/null; then
      printf 'p%s\0\nfcwd\0n%s\0\n' "$pid" "$MOCK_LIVE_CWD"
    fi
  done
fi
`,
    );
    return {
      MOCK_LIVE_CWD: realpathSync(temporaryDirectory),
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
    };
  }

  function mockCleanupEnvironment({
    processDirectory,
    processCommand,
    subsequentProcessDirectory,
  }: {
    processDirectory?: string;
    processCommand?: string;
    subsequentProcessDirectory?: string;
  } = {}): NodeJS.ProcessEnv {
    const binaryDirectory = nodePath.join(temporaryDirectory, 'bin');
    const killPath = nodePath.join(binaryDirectory, 'kill');
    const lsofPath = nodePath.join(binaryDirectory, 'lsof');
    const pgrepPath = nodePath.join(binaryDirectory, 'pgrep');
    const psPath = nodePath.join(binaryDirectory, 'ps');
    mkdirSync(binaryDirectory);
    writeExecutable(
      lsofPath,
      String.raw`#!/usr/bin/env bash
if [[ -n "$MOCK_LSOF_LOG" ]]; then
  printf '%s\n' "$*" >> "$MOCK_LSOF_LOG"
fi
if [[ "$*" == "-ti:${MOCK_PORT}" ]]; then
  if [[ -n "$MOCK_PORT_PIDS" ]]; then
    printf '%s\n' "$MOCK_PORT_PIDS"
  else
    echo ${MOCK_PID}
  fi
elif { [[ "$*" == "-a -p ${MOCK_PID} -d cwd -Fn0" ]] ||
  [[ "$*" == "-a -p ${MOCK_PID} -d cwd -Fpn0" ]]; } &&
  [[ -n "$MOCK_PROCESS_CWD" ]]; then
  process_cwd="$MOCK_PROCESS_CWD"
  if [[ -n "$MOCK_PROCESS_CWD_AFTER_FIRST" ]]; then
    read_count=0
    [[ -f "$MOCK_LSOF_CWD_COUNT" ]] && read_count=$(<"$MOCK_LSOF_CWD_COUNT")
    if [[ "$read_count" -gt 0 ]]; then
      process_cwd="$MOCK_PROCESS_CWD_AFTER_FIRST"
    fi
    printf '%s\n' "$((read_count + 1))" > "$MOCK_LSOF_CWD_COUNT"
  fi
  printf 'p${MOCK_PID}\0\nfcwd\0n%s\0\n' "$process_cwd"
elif { [[ "$*" == "-a -p ${MOCK_SECOND_PID} -d cwd -Fn0" ]] ||
  [[ "$*" == "-a -p ${MOCK_SECOND_PID} -d cwd -Fpn0" ]]; } &&
  [[ -n "$MOCK_SECOND_PROCESS_CWD" ]]; then
  printf 'p${MOCK_SECOND_PID}\0\nfcwd\0n%s\0\n' "$MOCK_SECOND_PROCESS_CWD"
elif [[ "$*" == "-a -p ${MOCK_PID},${MOCK_SECOND_PID} -d cwd -Fpn0" ]]; then
  [[ -n "$MOCK_PROCESS_CWD" ]] &&
    printf 'p${MOCK_PID}\0\nfcwd\0n%s\0\n' "$MOCK_PROCESS_CWD"
  [[ -n "$MOCK_SECOND_PROCESS_CWD" ]] &&
    printf 'p${MOCK_SECOND_PID}\0\nfcwd\0n%s\0\n' "$MOCK_SECOND_PROCESS_CWD"
fi
`,
    );
    writeExecutable(
      pgrepPath,
      String.raw`#!/usr/bin/env bash
if [[ -n "$MOCK_PGREP_LOG" ]]; then
  printf '%s\n' "$*" >> "$MOCK_PGREP_LOG"
fi
if [[ -n "$MOCK_PGREP_EXIT_CODE" ]] && [[ "$*" == *"$MOCK_PGREP_ERROR_PATTERN"* ]]; then
  exit "$MOCK_PGREP_EXIT_CODE"
fi
if [[ -n "$MOCK_PATTERN" ]] && [[ "$*" == *"$MOCK_PATTERN"* ]]; then
  printf '%s\n' "$MOCK_PATTERN_PIDS"
fi
`,
    );
    writeExecutable(
      psPath,
      String.raw`#!/usr/bin/env bash
if [[ -n "$MOCK_PROCESS_COMMAND" ]]; then
  printf '%s\n' "$MOCK_PROCESS_COMMAND"
fi
`,
    );
    writeExecutable(
      killPath,
      String.raw`#!/usr/bin/env bash
printf '%s\n' "$*" >> "$MOCK_KILL_LOG"
if [[ "$MOCK_KILL_EXIT_CODE" == "1" ]]; then
  exit 1
fi
`,
    );
    return {
      MOCK_LSOF_CWD_COUNT: nodePath.join(temporaryDirectory, 'lsof-cwd-count'),
      MOCK_PROCESS_COMMAND: processCommand,
      MOCK_PROCESS_CWD: processDirectory,
      MOCK_PROCESS_CWD_AFTER_FIRST: subsequentProcessDirectory,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
    };
  }

  describe('framework detection (root)', () => {
    it('detects Vite project → port 5173, pattern vite', () => {
      createFile('vite.config.ts');

      const output = runScript();

      expect(output).toContain('Port: 5173');
      expect(output).toContain('Pattern: vite');
    });

    it('detects Next.js project → port 3000, pattern next', () => {
      createFile('next.config.js');

      const output = runScript();

      expect(output).toContain('Port: 3000');
      expect(output).toContain('Pattern: next');
    });

    it('detects Nuxt project → port 3000, pattern nuxt', () => {
      createFile('nuxt.config.ts');

      const output = runScript();

      expect(output).toContain('Port: 3000');
      expect(output).toContain('Pattern: nuxt');
    });

    it('detects Astro project → port 4321', () => {
      createFile('astro.config.mjs');

      const output = runScript();

      expect(output).toContain('Port: 4321');
    });

    it('detects Angular project → port 4200', () => {
      createFile('angular.json');

      const output = runScript();

      expect(output).toContain('Port: 4200');
    });

    it('detects SvelteKit project → port 5173', () => {
      createFile('svelte.config.js');

      const output = runScript();

      expect(output).toContain('Port: 5173');
    });
  });

  describe('monorepo detection (packages/*/, apps/*/)', () => {
    it('detects Vite in packages/app/', () => {
      createFile('packages/app/vite.config.ts');

      const output = runScript();

      expect(output).toContain('Port: 5173');
      expect(output).toContain('Pattern: vite');
    });

    it('detects Next.js in apps/web/', () => {
      createFile('apps/web/next.config.mjs');

      const output = runScript();

      expect(output).toContain('Port: 3000');
      expect(output).toContain('Pattern: next');
    });

    it('detects Nuxt in packages/frontend/', () => {
      createFile('packages/frontend/nuxt.config.ts');

      const output = runScript();

      expect(output).toContain('Port: 3000');
      expect(output).toContain('Pattern: nuxt');
    });
  });

  describe('no framework detected', () => {
    it('shows no port/pattern when no config files exist', () => {
      // Empty directory
      const output = runScript();

      expect(output).not.toContain('Port:');
      expect(output).not.toContain('Pattern:');
    });
  });

  describe('required ownership tooling', () => {
    for (const missingTool of ['lsof', 'pgrep', 'ps']) {
      it(`refuses loudly instead of reporting success when ${missingTool} is unavailable`, () => {
        const requiredToolBin = nodePath.join(temporaryDirectory, `missing-${missingTool}-bin`);
        mkdirSync(requiredToolBin);

        for (const tool of ['basename', 'lsof', 'pgrep', 'ps']) {
          if (tool === missingTool) continue;
          const toolPath = nodePath.join(requiredToolBin, tool);
          const content =
            tool === 'basename'
              ? String.raw`#!/bin/sh
value=\${1%/}
printf '%s\n' "\${value##*/}"
`
              : '#!/bin/sh\nexit 1\n';
          writeExecutable(toolPath, content);
        }

        const result = spawnSync('/bin/bash', [SCRIPT_PATH], {
          cwd: temporaryDirectory,
          encoding: 'utf8',
          env: { ...process.env, PATH: requiredToolBin },
        });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(
          `${missingTool} is required for safe project-scoped cleanup`,
        );
        expect(result.stdout).not.toContain('already clean');
      });
    }

    it('reports pgrep errors instead of treating them as no matches', () => {
      const result = spawnSync('/bin/bash', [SCRIPT_PATH, '['], {
        cwd: temporaryDirectory,
        encoding: 'utf8',
        env: {
          ...process.env,
          ...mockCleanupEnvironment(),
          MOCK_PGREP_ERROR_PATTERN: '[',
          MOCK_PGREP_EXIT_CODE: '2',
        },
      });

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("pgrep failed for pattern '['");
      expect(result.stdout).not.toContain('already clean');
    });
  });

  describe('explicit port override', () => {
    it('uses provided port instead of auto-detection', () => {
      createFile('vite.config.ts'); // Would normally detect 5173

      const output = runScript(['8080']);

      expect(output).toContain('Port: 8080');
      // Pattern still auto-detected
      expect(output).toContain('Pattern: vite');
    });

    it('uses provided port and pattern', () => {
      const output = runScript(['9000', 'custom']);

      expect(output).toContain('Port: 9000');
      expect(output).toContain('Pattern: custom');
    });
  });

  describe('--dry-run behavior', () => {
    it('shows DRY RUN message', () => {
      const output = runScript();

      expect(output).toContain('DRY RUN');
    });

    it('does not actually kill processes', () => {
      // This test verifies --dry-run is safe by checking output message
      const output = runScript();

      expect(output).toContain('no processes will be killed');
    });
  });

  // 2KG1JW (#773 rung 4): the skill's "run --dry-run first, then re-run" ritual
  // is script-enforced — bare invocation previews, killing needs explicit consent.
  describe('Rule: killing requires an explicit --yes (deny-by-default)', () => {
    it('Scenario: a bare invocation is a preview that names the consent flag', () => {
      const output = runScriptRaw();

      expect(output).toContain('no processes will be killed');
      expect(output).toContain('--yes');
    });

    it('Scenario: --yes enters kill mode (no preview banner)', () => {
      // Empty temp dir: no detected port, no project-scoped matches — kill mode
      // runs safely and reports clean. The mode flip is what's under test.
      const output = runScriptRaw(['--yes']);

      expect(output).not.toContain('no processes will be killed');
      expect(output).toContain('already clean');
    });

    it('Scenario: -y is the short form of consent', () => {
      const output = runScriptRaw(['-y']);

      expect(output).not.toContain('no processes will be killed');
    });

    it('Scenario: --dry-run stays an explicit preview (back-compat)', () => {
      const output = runScriptRaw(['--dry-run']);

      expect(output).toContain('no processes will be killed');
    });

    it('Scenario: a preview with findings tells the reader how to proceed', () => {
      createFile('vite.config.ts');

      const output = runScriptRaw();

      // Bare preview still runs the full detection pass (port + pattern shown).
      expect(output).toContain('Port: 5173');
      expect(output).toContain('--yes');
    });

    it('Scenario: preview wins a contradictory flag mix, regardless of order', () => {
      for (const args of [
        ['--yes', '--dry-run'],
        ['--dry-run', '--yes'],
      ]) {
        expect(runScriptRaw(args)).toContain('no processes will be killed');
      }
    });
  });

  // The behavioral pin for kill mode: a real project-scoped process survives the
  // bare preview and dies under --yes. Everything above proves messaging; this
  // proves the mode flip reaches kill(1).
  describe('Rule: --yes kills what the preview showed (behavioral pin)', () => {
    let victims: ChildProcess[] = [];

    afterEach(() => {
      for (const victim of victims) {
        if (victim.pid && victim.exitCode === null) {
          try {
            process.kill(victim.pid, 'SIGKILL');
          } catch {
            // already dead — the desired end state
          }
        }
      }
      victims = [];
    });

    function spawnVictims(): { marker: string; ownedPid: number; unownedPid: number } {
      // Keep a unique marker in the argv of a real long-lived process so the
      // script's real pgrep discovery and batched ownership paths are exercised
      // on every platform.
      const marker = `swzombie-${process.pid}-${Date.now()}`;
      const victimScript = nodePath.join(realpathSync(temporaryDirectory), `${marker}.mjs`);
      writeFileSync(victimScript, 'setInterval(() => {}, 60_000);\n');
      const ownedVictim = spawn(process.execPath, [victimScript], {
        cwd: temporaryDirectory,
        detached: true,
        stdio: 'ignore',
      });
      const unownedVictim = spawn(process.execPath, [victimScript], {
        cwd: tmpdir(),
        detached: true,
        stdio: 'ignore',
      });
      victims = [ownedVictim, unownedVictim];
      if (ownedVictim.pid === undefined || unownedVictim.pid === undefined) {
        throw new Error('failed to spawn victims');
      }
      return { marker, ownedPid: ownedVictim.pid, unownedPid: unownedVictim.pid };
    }

    function isAlive(pid: number): boolean {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    }

    it('Scenario: the victim survives a bare preview and dies under --yes', async () => {
      const { marker, ownedPid, unownedPid } = spawnVictims();
      await expect.poll(() => isAlive(ownedPid) && isAlive(unownedPid)).toBe(true);
      await expect
        .poll(() => {
          const result = spawnSync('pgrep', ['-f', marker], { encoding: 'utf8' });
          const discoveredPids = new Set(result.stdout.split(/\s+/).filter(Boolean).map(Number));
          return discoveredPids.has(ownedPid) && discoveredPids.has(unownedPid);
        })
        .toBe(true);

      const liveProcessEnvironment = mockLiveProcessOwnership(ownedPid, marker, false);
      const preview = runScriptRaw([marker], liveProcessEnvironment);
      expect(preview).toContain(marker);
      expect(preview).toContain(`PID ${ownedPid}`);
      expect(preview).not.toContain(`PID ${unownedPid}`);
      expect(preview).toContain('Re-run with --yes to kill them');
      expect(isAlive(ownedPid)).toBe(true); // preview never kills
      expect(isAlive(unownedPid)).toBe(true);

      runScriptRaw(['--yes', marker], liveProcessEnvironment);
      await expect.poll(() => isAlive(ownedPid)).toBe(false); // consent kills
      expect(isAlive(unownedPid)).toBe(true); // unknown ownership fails closed
    });
  });

  describe('test port convention', () => {
    it('shows test port = dev port + 1000', () => {
      createFile('vite.config.ts');

      const output = runScript();

      // Output format: "Port: 5173 (+ test port 6173)"
      expect(output).toContain('Port: 5173');
      expect(output).toContain('test port 6173');
    });
  });

  describe('Rule: pattern cleanup stays scoped to the current project', () => {
    it('Scenario: an unrelated pattern match whose argv references this project is excluded', () => {
      const projectDirectory = realpathSync(temporaryDirectory);
      const environment = {
        ...mockCleanupEnvironment({
          processDirectory: '/tmp/unrelated-project',
          processCommand: `/usr/bin/playwright ${projectDirectory}/report`,
        }),
        MOCK_PATTERN: 'playwright',
        MOCK_PATTERN_PIDS: String(MOCK_PID),
      };

      const output = runScriptRaw([], environment);

      expect(output).not.toContain("Pattern 'playwright' (project-scoped):");
      expect(output).not.toContain(`PID ${MOCK_PID}`);
      expect(output).toContain('already clean');
    });

    it("Scenario: the current project's pattern match remains eligible", () => {
      const environment = {
        ...mockCleanupEnvironment({
          processDirectory: realpathSync(temporaryDirectory),
          processCommand: '/usr/bin/playwright test',
        }),
        MOCK_PATTERN: 'playwright',
        MOCK_PATTERN_PIDS: String(MOCK_PID),
      };

      const output = runScriptRaw([], environment);

      expect(output).toContain("Pattern 'playwright' (project-scoped): 1 process(es)");
      expect(output).toContain(`PID ${MOCK_PID}`);
    });

    it('Scenario: project paths are not interpolated into pgrep regular expressions', () => {
      const pgrepLog = nodePath.join(temporaryDirectory, 'pgrep.log');
      const environment = {
        ...mockCleanupEnvironment(),
        MOCK_PGREP_LOG: pgrepLog,
      };

      runScriptRaw([], environment);

      expect(readFileSync(pgrepLog, 'utf8').split('\n')).toContain('-f playwright');
    });

    it('Scenario: pattern ownership is read in one lsof call per candidate set', () => {
      const lsofLog = nodePath.join(temporaryDirectory, 'lsof.log');
      const projectDirectory = realpathSync(temporaryDirectory);
      const environment = {
        ...mockCleanupEnvironment({ processDirectory: projectDirectory }),
        MOCK_LSOF_LOG: lsofLog,
        MOCK_PATTERN: 'playwright',
        MOCK_PATTERN_PIDS: `${MOCK_PID}\n${MOCK_SECOND_PID}`,
        MOCK_SECOND_PROCESS_CWD: projectDirectory,
      };

      const output = runScriptRaw([], environment);

      expect(output).toContain("Pattern 'playwright' (project-scoped): 2 process(es)");
      expect(readFileSync(lsofLog, 'utf8').trim()).toBe(
        `-a -p ${MOCK_PID},${MOCK_SECOND_PID} -d cwd -Fpn0`,
      );
    });

    it('Scenario: a matching grandparent process is excluded from cleanup candidates', () => {
      const marker = `swzombie-ancestor-${process.pid}`;
      const outerWrapper = nodePath.join(temporaryDirectory, `${marker}.sh`);
      const innerWrapper = nodePath.join(temporaryDirectory, 'inner-wrapper.sh');
      writeExecutable(outerWrapper, `#!/usr/bin/env bash\nbash "${innerWrapper}"\n`);
      writeExecutable(innerWrapper, `#!/usr/bin/env bash\nbash "${SCRIPT_PATH}" "${marker}"\n`);

      const result = spawnSync('bash', [outerWrapper], {
        cwd: temporaryDirectory,
        encoding: 'utf8',
        env: { ...process.env, ...mockAllLiveProcessOwnership() },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain(`Pattern '${marker}' (project-scoped):`);
      expect(result.stdout).toContain('already clean');
    });
  });

  describe('Rule: port cleanup stays scoped to the current project', () => {
    beforeEach(() => {
      createFile('vite.config.ts');
    });

    it("Scenario: an unrelated project's process is excluded from the preview", () => {
      const output = runScriptRaw(
        [],
        mockCleanupEnvironment({ processDirectory: '/tmp/unrelated-project' }),
      );

      expect(output).not.toContain(`Port ${MOCK_PORT}:`);
      expect(output).not.toContain(`PID ${MOCK_PID}`);
      expect(output).toContain('No project-owned zombie processes found');
      expect(output).toContain(
        'Skipped 1 process(es) on detected ports; ownership was not verified for this project',
      );
    });

    it("Scenario: the current project's process remains in the preview", () => {
      const output = runScriptRaw(
        [],
        mockCleanupEnvironment({ processDirectory: realpathSync(temporaryDirectory) }),
      );

      expect(output).toContain(`Port ${MOCK_PORT}: 1 process(es)`);
      expect(output).toContain(`PID ${MOCK_PID}`);
      expect(output).toContain('Found 1 process(es) that would be killed');
    });

    it("Scenario: a process beneath the current project's root remains in the preview", () => {
      const projectChild = nodePath.join(realpathSync(temporaryDirectory), 'packages', 'app');
      const output = runScriptRaw([], mockCleanupEnvironment({ processDirectory: projectChild }));

      expect(output).toContain(`Port ${MOCK_PORT}: 1 process(es)`);
      expect(output).toContain(`PID ${MOCK_PID}`);
    });

    it('Scenario: a process with unknown ownership is excluded from the preview', () => {
      const output = runScriptRaw([], mockCleanupEnvironment());

      expect(output).not.toContain(`Port ${MOCK_PORT}:`);
      expect(output).not.toContain(`PID ${MOCK_PID}`);
      expect(output).toContain('No project-owned zombie processes found');
    });

    it("Scenario: a similarly prefixed project's command is excluded", () => {
      const projectDirectory = realpathSync(temporaryDirectory);
      const output = runScriptRaw(
        [],
        mockCleanupEnvironment({
          processDirectory: '/tmp/unrelated-project',
          processCommand: `${projectDirectory}-other/node_modules/.bin/vite`,
        }),
      );

      expect(output).not.toContain(`Port ${MOCK_PORT}:`);
      expect(output).not.toContain(`PID ${MOCK_PID}`);
      expect(output).toContain('No project-owned zombie processes found');
    });

    it('Scenario: an unrelated command argument referencing this project is excluded', () => {
      const projectDirectory = realpathSync(temporaryDirectory);
      const output = runScriptRaw(
        [],
        mockCleanupEnvironment({
          processDirectory: '/tmp/unrelated-project',
          processCommand: `/usr/bin/vite --log-file ${projectDirectory}/server.log`,
        }),
      );

      expect(output).not.toContain(`Port ${MOCK_PORT}:`);
      expect(output).not.toContain(`PID ${MOCK_PID}`);
      expect(output).toContain('No project-owned zombie processes found');
    });

    it('Scenario: an unrelated cwd containing a newline is excluded', () => {
      const projectDirectory = realpathSync(temporaryDirectory);
      const output = runScriptRaw(
        [],
        mockCleanupEnvironment({
          processDirectory: `${projectDirectory}\nn${projectDirectory}`,
        }),
      );

      expect(output).not.toContain(`Port ${MOCK_PORT}:`);
      expect(output).not.toContain(`PID ${MOCK_PID}`);
      expect(output).toContain('No project-owned zombie processes found');
    });

    it('Scenario: --yes never passes an unrelated port owner to kill', () => {
      const killLog = nodePath.join(temporaryDirectory, 'kill.log');
      const environment = {
        ...mockCleanupEnvironment({ processDirectory: '/tmp/unrelated-project' }),
        MOCK_KILL_LOG: killLog,
      };

      const output = runScriptRaw(['--yes'], environment);

      expect(output).toContain('No project-owned zombie processes found');
      expect(existsSync(killLog)).toBe(false);
    });

    it('Scenario: --yes passes a current-project port owner to kill', () => {
      const killLog = nodePath.join(temporaryDirectory, 'kill.log');
      const environment = {
        ...mockCleanupEnvironment({
          processDirectory: realpathSync(temporaryDirectory),
        }),
        MOCK_KILL_LOG: killLog,
      };

      const output = runScriptRaw(['--yes'], environment);

      expect(output).toContain('Killed 1 process(es)');
      expect(readFileSync(killLog, 'utf8')).toContain(`-9 ${MOCK_PID}`);
    });

    it('Scenario: --yes revalidates each PID immediately before signaling it', () => {
      const killLog = nodePath.join(temporaryDirectory, 'kill.log');
      const projectDirectory = realpathSync(temporaryDirectory);
      const environment = {
        ...mockCleanupEnvironment({
          processDirectory: projectDirectory,
          subsequentProcessDirectory: '/tmp/unrelated-project',
        }),
        MOCK_KILL_LOG: killLog,
        MOCK_PORT_PIDS: `${MOCK_PID}\n${MOCK_SECOND_PID}`,
        MOCK_SECOND_PROCESS_CWD: projectDirectory,
      };

      const output = runScriptRaw(['--yes'], environment);

      expect(output).toContain('Killed 1 process(es)');
      expect(readFileSync(killLog, 'utf8')).toBe(`-9 ${MOCK_SECOND_PID}\n`);
    });

    it('Scenario: --yes signals verified PIDs individually', () => {
      const killLog = nodePath.join(temporaryDirectory, 'kill.log');
      const projectDirectory = realpathSync(temporaryDirectory);
      const environment = {
        ...mockCleanupEnvironment({ processDirectory: projectDirectory }),
        MOCK_KILL_LOG: killLog,
        MOCK_PORT_PIDS: `${MOCK_PID}\n${MOCK_SECOND_PID}`,
        MOCK_SECOND_PROCESS_CWD: projectDirectory,
      };

      const output = runScriptRaw(['--yes'], environment);

      expect(output).toContain('Killed 2 process(es)');
      expect(readFileSync(killLog, 'utf8')).toBe(`-9 ${MOCK_PID}\n-9 ${MOCK_SECOND_PID}\n`);
    });

    it('Scenario: a failed signal is not reported as a successful kill', () => {
      const killLog = nodePath.join(temporaryDirectory, 'kill.log');
      const environment = {
        ...mockCleanupEnvironment({
          processDirectory: realpathSync(temporaryDirectory),
        }),
        MOCK_KILL_EXIT_CODE: '1',
        MOCK_KILL_LOG: killLog,
      };

      const output = runScriptRaw(['--yes'], environment);

      expect(output).toContain('Killed 0 process(es)');
      expect(output).toContain('Failed to kill 1 process(es)');
      expect(readFileSync(killLog, 'utf8')).toBe(`-9 ${MOCK_PID}\n`);
    });
  });
});
