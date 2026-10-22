import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { applyEdits, modify, parse, type ParseError } from 'jsonc-parser';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout, PROJECT_MUTATION_LOCK } from '../schema.js';
import { hasSafewordProjectMarker } from '../utils/configured-paths.js';
import { canonicalDirectory } from '../utils/fs.js';
import { acquireProfileLock, releaseProfileLock } from '../utils/profile-lock.js';
import {
  createOpenCodeV2Enrollment,
  openCodeV2EnrollmentPath,
  type OpenCodeV2Selection,
} from './v2-enrollment.js';

function refersToPackage(value: unknown, packageDirectory: string): boolean {
  if (value === packageDirectory) return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'package') === packageDirectory
  );
}

function readDeclaration(profile: string): { file: string; before: string; plugins: unknown[] } {
  const file =
    ['opencode.jsonc', 'opencode.json']
      .map(name => nodePath.join(profile, name))
      .find(path => existsSync(path)) ?? nodePath.join(profile, 'opencode.jsonc');
  const before = existsSync(file) ? readFileSync(file, 'utf8') : '{}\n';
  const errors: ParseError[] = [];
  const config = parse(before, errors) as { plugins?: unknown };
  if (errors.length > 0 || !config || typeof config !== 'object' || Array.isArray(config))
    throw new Error(
      'The OpenCode profile configuration is not a JSONC object; Safeword preserved it.',
    );
  const plugins = config.plugins ?? [];
  if (!Array.isArray(plugins))
    throw new Error('OpenCode plugins must be an array; Safeword preserved it.');
  return { file, before, plugins };
}

function reconcileDeclaration(
  profile: string,
  packageDirectory: string,
): { file: string; before: string; after: string } {
  const { file, before, plugins } = readDeclaration(profile);
  const entry = { package: packageDirectory, options: { profileDirectory: profile } };
  const matches = plugins.filter(value => refersToPackage(value, packageDirectory));
  if (matches.length === 1 && isDeepStrictEqual(matches[0], entry))
    return { file, before, after: before };
  if (matches.length > 0)
    throw new Error(
      'The selected OpenCode package has a different declaration; Safeword preserved it.',
    );
  return {
    file,
    before,
    after: applyEdits(
      before,
      modify(before, ['plugins'], [...plugins, entry], {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    ),
  };
}

function writeEnrollment(
  profile: string,
  project: string,
  selection: OpenCodeV2Selection,
): CliResult {
  const record = createOpenCodeV2Enrollment(profile, selection, layout);
  const declaration = reconcileDeclaration(profile, record.package_directory);
  const file = openCodeV2EnrollmentPath(profile, project, layout);
  const content = `${JSON.stringify(record, undefined, 2)}\n`;
  const before = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  if (before !== undefined && before !== content)
    throw new Error('The checkout has different native enrollment; Safeword preserved it.');
  if (before === content && declaration.before === declaration.after)
    return createResult({ state: 'healthy' });
  // A crash after declaration but before enrollment leaves the package inert.
  if (declaration.before !== declaration.after)
    writeDurableFile(declaration.file, declaration.after, { mode: 0o600 });
  writeDurableFile(file, content, { mode: 0o600 });
  return createResult({ state: 'changed' });
}

/** Internal selected-lane controller. Public native cutover remains proof-gated elsewhere. */
export function stageOpenCodeV2Profile(
  root: string,
  profileLockPath: string,
  selection: OpenCodeV2Selection,
): CliResult {
  const profile = canonicalDirectory(root);
  const project = canonicalDirectory(selection.projectDirectory);
  if (!profile || !project || !hasSafewordProjectMarker(project))
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'OPENCODE_V2_SCOPE_REQUIRED',
          message: 'Select an installed canonical project and existing OpenCode profile.',
          retryable: false,
        },
      ],
    });
  const projectLock = acquireProfileLock(nodePath.join(project, PROJECT_MUTATION_LOCK));
  if (!projectLock)
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'OPENCODE_PROJECT_BUSY',
          message: 'Another project change is in progress.',
          retryable: true,
        },
      ],
    });
  try {
    const profileLock = acquireProfileLock(profileLockPath);
    if (!profileLock)
      return createResult({
        state: 'failed',
        errors: [
          {
            code: 'OPENCODE_PROFILE_BUSY',
            message: 'Another OpenCode profile change is in progress.',
            retryable: true,
          },
        ],
      });
    try {
      return writeEnrollment(profile, project, selection);
    } finally {
      releaseProfileLock(profileLock);
    }
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'OPENCODE_V2_ENROLLMENT_UNAVAILABLE',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      ],
    });
  } finally {
    releaseProfileLock(projectLock);
  }
}
