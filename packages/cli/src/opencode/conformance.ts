import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, readFileSync, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import hostReleases from '../lifecycle/host-releases.json' with { type: 'json' };
import { resolveOpenCodeConfigRoot } from './config-root.js';
import { captureOpenCodeV2, openCodeConformanceFixtureDigest } from './conformance-fixture.js';
import { openCodeV2ConformanceIdentity, publishOpenCodeV2Attempt } from './evidence.js';
import type { OpenCodeV2Enrollment } from './v2-enrollment.js';
import { selectedOpenCodeV2Enrollment } from './v2-profile.js';

function resolveExecutable(environment: NodeJS.ProcessEnv, name = 'opencode'): string | undefined {
  const extensions =
    process.platform === 'win32' ? (environment.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  const pathEntries = (environment.PATH ?? '').split(nodePath.delimiter).filter(Boolean);
  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = nodePath.resolve(directory, `${name}${extension.toLowerCase()}`);
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
        instruction: `Install OpenCode ${hostReleases.opencode.version} and make \`opencode\` executable on PATH, then rerun conformance.`,
        mutates: false,
        requiresHuman: true,
      },
    ],
    data: { command: 'conformance', agent: 'opencode' },
  });
}

type ExecutableBoundary =
  { readonly executable: string; readonly version: string } | { readonly result: CliResult };

export function observeOpenCodeVersion(environment: NodeJS.ProcessEnv): string | undefined {
  const executable = resolveExecutable(environment);
  if (executable === undefined) return undefined;
  const version = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    env: { ...environment, OPENCODE_DISABLE_AUTOUPDATE: 'true' },
    timeout: 10_000,
  });
  return version.status === 0 && version.error === undefined
    ? normalizedVersion(version.stdout)
    : undefined;
}

function normalizedVersion(output: string): string {
  return output.trim().replace(/^opencode v/u, '');
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
    env: { ...environment, OPENCODE_DISABLE_AUTOUPDATE: 'true' },
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
  const observedVersion = normalizedVersion(version.stdout);
  if (observedVersion !== hostReleases.opencode.version) {
    return {
      result: executableRemediation(
        'OPENCODE_VERSION_UNSUPPORTED',
        `OpenCode ${observedVersion || '<unknown>'} is not the supported ${hostReleases.opencode.version} release.`,
      ),
    };
  }
  return { executable, version: observedVersion };
}

export interface OpenCodeConformanceOptions {
  readonly projectDirectory?: string;
  readonly runtime?: 'CLI' | 'TUI';
}

export function currentOpenCodeV2Identity(
  enrollment: OpenCodeV2Enrollment,
  version: string,
  runtime: 'CLI' | 'TUI',
) {
  return openCodeV2ConformanceIdentity(
    enrollment,
    version,
    runtime,
    openCodeConformanceFixtureDigest(),
    createHash('sha256')
      .update(readFileSync(import.meta.filename))
      .digest('hex'),
  );
}

async function captureSelectedV2(
  executable: string,
  environment: NodeJS.ProcessEnv,
  enrollment: OpenCodeV2Enrollment,
  version: string,
  { runtime }: { runtime: 'CLI' | 'TUI' },
) {
  let capture: Awaited<ReturnType<typeof captureOpenCodeV2>>;
  let proofId: string | undefined;
  let publicationError: string | undefined;
  try {
    const identity = currentOpenCodeV2Identity(enrollment, version, runtime);
    capture = await captureOpenCodeV2(executable, environment, enrollment, {
      runtime,
      version,
      realBun: resolveExecutable(process.env, 'bun'),
      payloadSha256: identity.payload_sha256,
    });
    try {
      const current = currentOpenCodeV2Identity(enrollment, version, runtime);
      if (
        capture.reason !== 'capture-error' &&
        JSON.stringify(identity) !== JSON.stringify(current)
      )
        capture = {
          ...capture,
          outcome: 'unavailable',
          reason: 'identity-changed',
          guarantees: undefined,
          registrations: undefined,
          native_activation: undefined,
          error: 'Conformance identity changed during capture.',
        };
      proofId = publishOpenCodeV2Attempt(identity, { ...capture }).id;
    } catch (error) {
      publicationError = error instanceof Error ? error.message : String(error);
    }
  } catch (error) {
    capture = {
      outcome: 'unavailable',
      reason: 'capture-error',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return { capture, proofId, publicationError };
}

async function runSelectedV2Conformance(
  executable: string,
  environment: NodeJS.ProcessEnv,
  options: OpenCodeConformanceOptions,
  version: string,
): Promise<CliResult> {
  const root = resolveOpenCodeConfigRoot({
    platform: process.platform === 'win32' ? 'windows' : 'unix',
    env: environment,
  });
  const enrollment = root
    ? selectedOpenCodeV2Enrollment(root, options.projectDirectory)
    : undefined;
  if (!enrollment)
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'OPENCODE_V2_ENROLLMENT_REQUIRED',
          message: 'No current OpenCode V2 enrollment selects this project and package.',
          severity: 'error',
        },
      ],
      nextActions: [
        {
          kind: 'human',
          instruction:
            'OpenCode V2 conformance is unavailable without a current explicitly staged enrollment.',
          mutates: false,
          requiresHuman: true,
        },
      ],
      data: { command: 'conformance', agent: 'opencode', lane: 2, conformant: false },
    });
  const runtime = options.runtime ?? 'CLI';
  const { capture, proofId, publicationError } = await captureSelectedV2(
    executable,
    environment,
    enrollment,
    version,
    { runtime },
  );
  const admitted = capture.outcome === 'passed' && !!proofId;
  return createResult({
    state: admitted ? 'healthy' : 'action_required',
    findings: admitted
      ? []
      : [
          {
            code: 'OPENCODE_V2_OBSERVATIONS_REQUIRED',
            message: 'No validated native observations establish conformance for this run.',
            severity: 'error',
          },
        ],
    data: {
      command: 'conformance',
      agent: 'opencode',
      lane: 2,
      runtime,
      conformant: admitted,
      capture,
      proof_id: proofId,
      publication_error: publicationError,
    },
  });
}

export async function runOpenCodeConformance(
  environment: NodeJS.ProcessEnv = process.env,
  options: OpenCodeConformanceOptions = {},
): Promise<CliResult> {
  const boundary = executableBoundary(environment);
  if ('result' in boundary) return boundary.result;
  return runSelectedV2Conformance(boundary.executable, environment, options, boundary.version);
}
