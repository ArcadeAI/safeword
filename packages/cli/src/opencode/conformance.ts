import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { VERSION } from '../version.js';
import {
  OPENCODE_EXPECTED_DISCOVERY,
  type OpenCodeConformanceFault,
  proveOpenCodeCatalogue,
  proveOpenCodeControl,
  proveOpenCodeDenial,
  proveOpenCodeSkillInvocation,
} from './conformance-fixture.js';
import { writePassingOpenCodeConformance } from './evidence.js';
import { type OpenCodeIdentityV1, parseOpenCodeIdentity } from './identity.js';
import { openCodeProfilePaths, resolveOpenCodeConfigRoot } from './profile.js';

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
          'Install a stable OpenCode 1.x release and make `opencode` executable on PATH, then rerun conformance.',
        mutates: false,
        requiresHuman: true,
      },
    ],
    data: { command: 'conformance', agent: 'opencode' },
  });
}

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

interface InstalledProfile {
  readonly identity: OpenCodeIdentityV1;
  readonly root: string;
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function installedProfile(environment: NodeJS.ProcessEnv): InstalledProfile | undefined {
  const root = resolveOpenCodeConfigRoot({
    platform: process.platform === 'win32' ? 'windows' : 'unix',
    env: environment,
  });
  if (root === undefined) return undefined;
  const paths = openCodeProfilePaths(root);
  try {
    if (!lstatSync(paths.plugin).isFile() || !lstatSync(paths.identity).isFile()) return undefined;
    const identity = parseOpenCodeIdentity(JSON.parse(readFileSync(paths.identity, 'utf8')));
    if (identity?.safeword_version !== VERSION) return undefined;
    if (
      sha256(readFileSync(paths.plugin)) !== identity.plugin_sha256 ||
      sha256(readFileSync(identity.dispatcher_path)) !== identity.dispatcher_sha256
    ) {
      return undefined;
    }
    return { identity, root };
  } catch {
    return undefined;
  }
}

type ExecutableBoundary =
  { readonly executable: string; readonly version: string } | { readonly result: CliResult };

export function observeOpenCodeVersion(environment: NodeJS.ProcessEnv): string | undefined {
  const executable = resolveExecutable(environment);
  if (executable === undefined) return undefined;
  const version = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    env: environment,
    timeout: 10_000,
  });
  return version.status === 0 && version.error === undefined ? version.stdout.trim() : undefined;
}

function executableBoundary(environment: NodeJS.ProcessEnv): ExecutableBoundary {
  const executable = resolveExecutable(environment);
  if (executable === undefined) {
    return {
      result: executableRemediation(
        'OPENCODE_EXECUTABLE_UNRESOLVED',
        'OpenCode is not executable from PATH.',
      ),
    };
  }

  const version = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    env: environment,
    timeout: 10_000,
  });
  if (version.status !== 0 || version.error !== undefined) {
    return {
      result: executableRemediation(
        'OPENCODE_EXECUTABLE_FAILED',
        'OpenCode exited before conformance could begin.',
      ),
    };
  }
  const observedVersion = version.stdout.trim();
  if (!/^1\.\d+\.\d+$/.test(observedVersion)) {
    return {
      result: executableRemediation(
        'OPENCODE_VERSION_UNSUPPORTED',
        `OpenCode ${observedVersion || '<unknown>'} is not a stable 1.x release.`,
      ),
    };
  }
  return { executable, version: observedVersion };
}

export interface OpenCodeConformanceOptions {
  /** Test-only fault injected directly by the caller, never ambient process state. */
  readonly fault?: OpenCodeConformanceFault;
}

function failedProof(code: string, message: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code, message, retryable: true }],
    data: { command: 'conformance', agent: 'opencode' },
  });
}

async function proveOpenCodeHost(
  executable: string,
  environment: NodeJS.ProcessEnv,
  fault: OpenCodeConformanceFault | undefined,
): Promise<CliResult | undefined> {
  if (!proveOpenCodeCatalogue(executable, environment, fault)) {
    return failedProof(
      'OPENCODE_CATALOGUE_CONFORMANCE_FAILED',
      'OpenCode did not discover the required Safeword catalogue.',
    );
  }
  const denial = await proveOpenCodeDenial(executable, environment, fault !== 'disarmed-denial');
  if (!denial.denialSurfaced || !denial.sentinelAbsent) {
    return failedProof(
      'OPENCODE_DENIAL_CONFORMANCE_FAILED',
      'OpenCode did not prove Safeword denial without a side effect.',
    );
  }
  if (!(await proveOpenCodeControl(executable, environment))) {
    return failedProof(
      'OPENCODE_CONTROL_CONFORMANCE_FAILED',
      'The disarmed OpenCode sentinel did not produce its expected side effect.',
    );
  }
  const skill = await proveOpenCodeSkillInvocation(executable, environment);
  return skill.argumentsObserved && skill.canonicalBodyObserved
    ? undefined
    : failedProof(
        'OPENCODE_SKILL_CONFORMANCE_FAILED',
        'OpenCode did not load the canonical skill with the exact command arguments.',
      );
}

export async function runOpenCodeConformance(
  environment: NodeJS.ProcessEnv = process.env,
  options: OpenCodeConformanceOptions = {},
): Promise<CliResult> {
  const boundary = executableBoundary(environment);
  if ('result' in boundary) return boundary.result;
  const { executable, version } = boundary;
  const { fault } = options;

  const profile = installedProfile(environment);
  if (profile === undefined) return profileRemediation();
  const proofFailure = await proveOpenCodeHost(executable, environment, fault);
  if (proofFailure !== undefined) return proofFailure;

  writePassingOpenCodeConformance(openCodeProfilePaths(profile.root).conformance, {
    schema_version: 1,
    safeword_version: profile.identity.safeword_version,
    opencode_version: version,
    platform: process.platform,
    arch: process.arch,
    plugin_sha256: profile.identity.plugin_sha256,
    command_catalogue: true,
    agent_catalogue: true,
    denial: true,
    control: true,
    checked_at: new Date().toISOString(),
    result: 'passed',
  });

  return createResult({
    state: 'changed',
    data: {
      command: 'conformance',
      agent: 'opencode',
      opencode_version: version,
      conformant: true,
      discovery: OPENCODE_EXPECTED_DISCOVERY,
      denial: true,
      control: true,
      skill_invocation: true,
    },
  });
}
