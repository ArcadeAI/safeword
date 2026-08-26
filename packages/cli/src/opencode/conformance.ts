import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { CURSOR_COMMAND_WRAPPERS } from '../cursor-wrappers.js';
import { getTemplatesDirectory } from '../utils/fs.js';
import { renderOpenCodeAgent, renderOpenCodeCommand, SAFEWORD_SUBAGENTS } from './catalogue.js';
import {
  installOpenCodeProfile,
  openCodeProfilePaths,
  resolveOpenCodeConfigRoot,
} from './profile.js';

export const SUPPORTED_OPENCODE_VERSION = '1.18.23';

function resolveExecutable(environment: NodeJS.ProcessEnv): string | undefined {
  const extensions =
    process.platform === 'win32' ? (environment.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  const pathEntries = (environment.PATH ?? '').split(nodePath.delimiter).filter(Boolean);
  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = nodePath.resolve(directory, `opencode${extension.toLowerCase()}`);
      try {
        accessSync(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
        const resolved = realpathSync(candidate);
        if (statSync(resolved).isFile()) return resolved;
      } catch {
        // Keep searching PATH for a usable executable.
      }
    }
  }
  return undefined;
}

function executableRemediation(code: string, message: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'error' }],
    nextActions: [
      {
        kind: 'human',
        instruction:
          'Install OpenCode 1.18.23 and make `opencode` executable on PATH, then rerun conformance.',
        mutates: false,
        requiresHuman: true,
      },
    ],
    data: { command: 'conformance', agent: 'opencode' },
  });
}

const EXPECTED_DISCOVERY = {
  command: 'bdd',
  subagent: 'safeword-reviewer',
  skill: 'bdd',
} as const;

function profileRemediation(): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'OPENCODE_PROFILE_REQUIRED',
        message: 'The managed Safeword OpenCode profile must be installed before conformance.',
        severity: 'error',
      },
    ],
    nextActions: [
      {
        command: 'safeword install --agents=opencode',
        mutates: true,
        requiresHuman: true,
      },
    ],
    data: { command: 'conformance', agent: 'opencode' },
  });
}

function installedProfileRoot(environment: NodeJS.ProcessEnv): string | undefined {
  const root = resolveOpenCodeConfigRoot({
    platform: process.platform === 'win32' ? 'windows' : 'unix',
    env: environment,
  });
  if (root === undefined) return undefined;
  const paths = openCodeProfilePaths(root);
  try {
    return statSync(paths.plugin).isFile() && statSync(paths.identity).isFile() ? root : undefined;
  } catch {
    return undefined;
  }
}

function prepareCatalogueFixture(root: string): string {
  const project = nodePath.join(root, 'project');
  const config = nodePath.join(root, 'config');
  const command = CURSOR_COMMAND_WRAPPERS.find(candidate => candidate.name === 'bdd');
  const agent = SAFEWORD_SUBAGENTS.find(candidate => candidate.name === 'safeword-reviewer');
  if (command === undefined || agent === undefined) {
    throw new Error('Safeword OpenCode catalogue fixture is incomplete');
  }
  const skillPath = nodePath.join(getTemplatesDirectory(), 'skills', 'bdd', 'SKILL.md');

  mkdirSync(nodePath.join(project, '.opencode', 'commands'), { recursive: true });
  mkdirSync(nodePath.join(project, '.opencode', 'agents'), { recursive: true });
  mkdirSync(nodePath.join(project, '.claude', 'skills', 'bdd'), { recursive: true });
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.opencode', 'commands', 'bdd.md'),
    renderOpenCodeCommand(command),
  );
  writeFileSync(
    nodePath.join(project, '.opencode', 'agents', 'safeword-reviewer.md'),
    renderOpenCodeAgent(agent),
  );
  writeFileSync(
    nodePath.join(project, '.claude', 'skills', 'bdd', 'SKILL.md'),
    readFileSync(skillPath),
  );
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# Safeword\n');
  if (installOpenCodeProfile(config).state !== 'changed') {
    throw new Error('Safeword OpenCode profile fixture could not be installed');
  }
  return project;
}

function runHost(
  executable: string,
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
) {
  return spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30_000,
  });
}

function proveCatalogue(executable: string, environment: NodeJS.ProcessEnv): boolean {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-opencode-conformance-'));
  try {
    const project = prepareCatalogueFixture(root);
    const fixtureEnvironment = {
      ...environment,
      HOME: nodePath.join(root, 'home'),
      XDG_CONFIG_HOME: nodePath.join(root, 'xdg-config'),
      XDG_DATA_HOME: nodePath.join(root, 'xdg-data'),
      XDG_CACHE_HOME: nodePath.join(root, 'xdg-cache'),
      OPENCODE_CONFIG_DIR: nodePath.join(root, 'config'),
      OPENCODE_DISABLE_AUTOUPDATE: 'true',
    };
    const config = runHost(executable, ['debug', 'config'], project, fixtureEnvironment);
    const skills = runHost(executable, ['debug', 'skill'], project, fixtureEnvironment);
    if (config.status !== 0 || skills.status !== 0) return false;
    const resolved = JSON.parse(config.stdout) as {
      command?: Record<string, unknown>;
      agent?: Record<string, unknown>;
    };
    const discoveredSkills = JSON.parse(skills.stdout) as { name?: unknown }[];
    return (
      resolved.command?.[EXPECTED_DISCOVERY.command] !== undefined &&
      resolved.agent?.[EXPECTED_DISCOVERY.subagent] !== undefined &&
      discoveredSkills.some(skill => skill.name === EXPECTED_DISCOVERY.skill)
    );
  } catch {
    return false;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function runOpenCodeConformance(environment: NodeJS.ProcessEnv = process.env): CliResult {
  const executable = resolveExecutable(environment);
  if (executable === undefined) {
    return executableRemediation(
      'OPENCODE_EXECUTABLE_UNRESOLVED',
      'OpenCode is not executable from PATH.',
    );
  }

  const version = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    env: environment,
    timeout: 10_000,
  });
  if (version.status !== 0 || version.error !== undefined) {
    return executableRemediation(
      'OPENCODE_EXECUTABLE_FAILED',
      'OpenCode exited before conformance could begin.',
    );
  }
  if (version.stdout.trim() !== SUPPORTED_OPENCODE_VERSION) {
    return executableRemediation(
      'OPENCODE_VERSION_UNSUPPORTED',
      `OpenCode ${version.stdout.trim() || '<unknown>'} does not match the supported conformance fixture ${SUPPORTED_OPENCODE_VERSION}.`,
    );
  }

  if (installedProfileRoot(environment) === undefined) return profileRemediation();
  if (!proveCatalogue(executable, environment)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'OPENCODE_CATALOGUE_CONFORMANCE_FAILED',
          message: 'OpenCode did not discover the required Safeword catalogue.',
          retryable: true,
        },
      ],
      data: { command: 'conformance', agent: 'opencode' },
    });
  }

  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'OPENCODE_CONFORMANCE_INCOMPLETE',
        message: 'The OpenCode executable is valid, but real-process conformance has not run.',
        severity: 'error',
      },
    ],
    nextActions: [
      {
        command: 'safeword conformance --agents=opencode',
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: { command: 'conformance', agent: 'opencode', discovery: EXPECTED_DISCOVERY },
  });
}
