import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

import { isSafePackageVersion } from '../../src/utils/version.js';

export interface CodexPluginGenerationOptions {
  readonly checkOnly: boolean;
  readonly effectiveVersion: string;
  readonly output?: string;
}

interface RawGenerationOptions {
  readonly checkOnly: boolean;
  readonly requestedVersion?: string;
  readonly output?: string;
}

function releaseIdentity(version: string): string {
  return version.split('+', 1)[0] ?? version;
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Keep duplicate, missing-value, and unknown-option failures adjacent at this small CLI trust boundary.
function readGenerationArguments(arguments_: readonly string[]): RawGenerationOptions {
  let checkOnly = false;
  let requestedVersion: string | undefined;
  let output: string | undefined;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--check') {
      if (checkOnly) throw new Error('Duplicate option: --check');
      checkOnly = true;
      continue;
    }
    if (argument !== '--version' && argument !== '--output') {
      throw new Error(`Unknown option: ${argument ?? ''}`);
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`);
    }
    index += 1;
    if (argument === '--version') {
      if (requestedVersion !== undefined) throw new Error('Duplicate option: --version');
      requestedVersion = value;
    } else {
      if (output !== undefined) throw new Error('Duplicate option: --output');
      output = value;
    }
  }

  return { checkOnly, requestedVersion, output };
}

function validateGenerationOptions(raw: RawGenerationOptions, packageVersion: string): void {
  if (!isSafePackageVersion(packageVersion))
    throw new Error(`Package version is not valid SemVer: ${packageVersion}`);
  if (raw.checkOnly && (raw.requestedVersion !== undefined || raw.output !== undefined))
    throw new Error('--check cannot be combined with --version or --output');
  if ((raw.requestedVersion === undefined) !== (raw.output === undefined))
    throw new Error('--version and --output must be provided together');
  if (raw.requestedVersion === undefined) return;
  if (!isSafePackageVersion(raw.requestedVersion))
    throw new Error(`Effective version is not valid SemVer: ${raw.requestedVersion}`);
  if (releaseIdentity(raw.requestedVersion) !== releaseIdentity(packageVersion))
    throw new Error(
      `Effective version must describe the same release as ${packageVersion}: ${raw.requestedVersion}`,
    );
}

export function parseCodexPluginGenerationOptions(
  arguments_: readonly string[],
  packageVersion: string,
): CodexPluginGenerationOptions {
  const raw = readGenerationArguments(arguments_);
  validateGenerationOptions(raw, packageVersion);

  return {
    checkOnly: raw.checkOnly,
    effectiveVersion: raw.requestedVersion ?? packageVersion,
    ...(raw.output !== undefined && { output: nodePath.resolve(raw.output) }),
  };
}

export async function publishFreshDirectory(
  output: string,
  generate: (stagingDirectory: string) => Promise<void>,
): Promise<void> {
  if (existsSync(output)) throw new Error(`Output already exists: ${output}`);
  const parent = nodePath.dirname(output);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(nodePath.join(parent, `.${nodePath.basename(output)}.tmp-`));
  let published = false;
  try {
    await generate(staging);
    renameSync(staging, output);
    published = true;
  } finally {
    if (!published) rmSync(staging, { recursive: true, force: true });
  }
}
