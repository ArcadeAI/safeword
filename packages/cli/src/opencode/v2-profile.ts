import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { hostname } from 'node:os';
import nodePath from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { applyEdits, modify, parse, type ParseError } from 'jsonc-parser';

import { type CliResult, createResult, type Effect } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout, PROJECT_MUTATION_LOCK } from '../schema.js';
import { hasSafewordProjectMarker } from '../utils/configured-paths.js';
import { canonicalDirectory } from '../utils/fs.js';
import { acquireProfileLock, releaseProfileLock } from '../utils/profile-lock.js';
import { isSha256 } from './records.js';
import {
  createOpenCodeV2Enrollment,
  type OpenCodeV2Enrollment,
  openCodeV2EnrollmentPath,
  type OpenCodeV2Selection,
  readOpenCodeV2Enrollment,
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

/** Resolve only the selected project's current enrollment and actual profile declaration. */
export function selectedOpenCodeV2Enrollment(
  root: string,
  projectDirectory: string | undefined,
  observedVersion?: string,
): OpenCodeV2Enrollment | undefined {
  if (observedVersion !== undefined && !observedVersion.startsWith('2.')) return undefined;
  if (projectDirectory === undefined) return undefined;
  const profile = canonicalDirectory(root);
  const project = canonicalDirectory(projectDirectory);
  if (!profile || !project) return undefined;
  try {
    const value = JSON.parse(
      readFileSync(openCodeV2EnrollmentPath(profile, project, layout), 'utf8'),
    ) as Partial<OpenCodeV2Enrollment>;
    if (typeof value.package_directory !== 'string') return undefined;
    const record = readOpenCodeV2Enrollment(profile, project, value.package_directory, layout);
    if (record === undefined) return undefined;
    const declarations = readDeclaration(profile).plugins.filter(entry =>
      refersToPackage(entry, record.package_directory),
    );
    return declarations.length === 1 ? record : undefined;
  } catch {
    return undefined;
  }
}

function ownedDeclaration(profile: string, packageDirectory: string) {
  return { package: packageDirectory, options: { profileDirectory: profile } };
}

function reconcileDeclaration(
  profile: string,
  packageDirectory: string,
): { file: string; before: string; after: string } {
  const { file, before, plugins } = readDeclaration(profile);
  const entry = ownedDeclaration(profile, packageDirectory);
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

function assertSelectedRefresh(
  before: string | undefined,
  record: OpenCodeV2Enrollment,
  previous?: OpenCodeV2Enrollment,
): void {
  // A selected refresh may replace only the exact record observed before the
  // owned payload changed. Enrollment is an instruction, never native proof.
  if (previous && before !== `${JSON.stringify(previous, undefined, 2)}\n`)
    throw new Error('The prior native enrollment changed; Safeword preserved it.');
  const sameSelection =
    previous &&
    Object.keys(previous).length === Object.keys(record).length &&
    Object.entries(record).every(
      ([key, value]) =>
        key === 'entry_sha256' || key === 'runtime_sha256' || Reflect.get(previous, key) === value,
    );
  const content = `${JSON.stringify(record, undefined, 2)}\n`;
  if (before !== undefined && before !== content && !sameSelection)
    throw new Error('The checkout has different native enrollment; Safeword preserved it.');
}

function readRetainedEnrollment(before: string | undefined): OpenCodeV2Enrollment | undefined {
  if (before === undefined) return undefined;
  const record = JSON.parse(before) as OpenCodeV2Enrollment;
  if (!isSha256(record.entry_sha256) || !isSha256(record.runtime_sha256))
    throw new Error('Invalid OpenCode enrollment; Safeword preserved it.');
  return record;
}

function writeProfileDeclaration(file: string, content: string): void {
  const mode = existsSync(file) ? statSync(file).mode & 0o777 : 0o600;
  writeDurableFile(file, content, { mode });
}

function writeEnrollment(
  profile: string,
  project: string,
  selection: Omit<OpenCodeV2Selection, 'epoch'> | OpenCodeV2Selection,
  previous?: OpenCodeV2Enrollment,
): CliResult {
  const file = openCodeV2EnrollmentPath(profile, project, layout);
  const before = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  const retained = 'epoch' in selection ? previous : readRetainedEnrollment(before);
  const record = createOpenCodeV2Enrollment(
    profile,
    {
      ...selection,
      epoch: 'epoch' in selection ? selection.epoch : (retained?.epoch ?? randomUUID()),
    },
    layout,
  );
  assertSelectedRefresh(before, record, retained);
  const declaration = reconcileDeclaration(profile, record.package_directory);
  const content = `${JSON.stringify(record, undefined, 2)}\n`;
  if (before === content && declaration.before === declaration.after)
    return createResult({ state: 'healthy' });
  // A crash after declaration but before enrollment leaves the package inert.
  if (declaration.before !== declaration.after)
    writeProfileDeclaration(declaration.file, declaration.after);
  writeDurableFile(file, content, { mode: 0o600 });
  return createResult({
    state: 'changed',
    effects: {
      files: [
        ...(declaration.before === declaration.after
          ? []
          : [{ kind: 'update', target: declaration.file, operation: 'write' }]),
        { kind: 'update', target: file, operation: 'write' },
      ],
    },
  });
}

function hasEnrollmentScope(record: OpenCodeV2Enrollment, profile: string, file: string): boolean {
  return (
    record?.schema_version === 1 &&
    record.lane === 2 &&
    record.machine === hostname() &&
    record.profile_directory === profile &&
    typeof record.project_directory === 'string' &&
    nodePath.isAbsolute(record.project_directory) &&
    openCodeV2EnrollmentPath(profile, record.project_directory, layout) === file
  );
}

function readRemovalEnrollment(profile: string, file: string): OpenCodeV2Enrollment {
  // Removal also works after the bundled package is moved or its bytes change.
  const record = JSON.parse(readFileSync(file, 'utf8')) as OpenCodeV2Enrollment;
  if (
    !hasEnrollmentScope(record, profile, file) ||
    typeof record.package_directory !== 'string' ||
    !nodePath.isAbsolute(record.package_directory) ||
    typeof record.epoch !== 'string' ||
    record.epoch.trim() === '' ||
    !isSha256(record.entry_sha256) ||
    !isSha256(record.runtime_sha256)
  )
    throw new Error('Invalid OpenCode enrollment; Safeword preserved it.');
  return record;
}

interface RemovalPlan {
  file: string;
  edit: { file: string; before: string; after: string } | undefined;
}

function planRemoval(profile: string, project: string): RemovalPlan | undefined {
  const file = openCodeV2EnrollmentPath(profile, project, layout);
  if (!existsSync(file)) return;
  const { package_directory: packageDirectory } = readRemovalEnrollment(profile, file);
  const directory = nodePath.dirname(file);
  const shared = readdirSync(directory).some(name => {
    const sibling = nodePath.join(directory, name);
    return (
      sibling !== file &&
      /^[a-f0-9]{64}\.json$/.test(name) &&
      readRemovalEnrollment(profile, sibling).package_directory === packageDirectory
    );
  });
  let edit: RemovalPlan['edit'];
  if (!shared) {
    const declaration = readDeclaration(profile);
    const matches = declaration.plugins
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => refersToPackage(entry, packageDirectory));
    const match = matches[0];
    if (match) {
      if (
        matches.length !== 1 ||
        !isDeepStrictEqual(match.entry, ownedDeclaration(profile, packageDirectory))
      )
        throw new Error(
          'The selected OpenCode package has a different declaration; Safeword preserved it.',
        );
      const after = applyEdits(
        declaration.before,
        modify(declaration.before, ['plugins', match.index], undefined, {}),
      );
      edit = { file: declaration.file, before: declaration.before, after };
    }
  }
  return { file, edit };
}

function removalFingerprint(plan: RemovalPlan): string {
  return createHash('sha256')
    .update(JSON.stringify([plan.file, readFileSync(plan.file, 'utf8'), plan.edit]))
    .digest('hex');
}

export function observeOpenCodeV2Removal(
  root: string,
  projectDirectory: string,
):
  { enrollment: string; declaration?: string; fingerprint?: string; refusal?: string } | undefined {
  const profile = canonicalDirectory(root);
  const project = canonicalDirectory(projectDirectory);
  if (!profile || !project) return;
  const file = openCodeV2EnrollmentPath(profile, project, layout);
  if (!existsSync(file)) return;
  try {
    const plan = planRemoval(profile, project);
    if (!plan) return;
    return {
      enrollment: file,
      declaration: plan.edit?.file,
      fingerprint: removalFingerprint(plan),
    };
  } catch (error) {
    return { enrollment: file, refusal: error instanceof Error ? error.message : String(error) };
  }
}

function removeEnrollment(
  profile: string,
  project: string,
  expected?: { fingerprint: string | undefined },
): CliResult {
  const plan = planRemoval(profile, project);
  if (expected && expected.fingerprint !== (plan && removalFingerprint(plan)))
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'PLAN_STALE',
          message: 'The OpenCode enrollment or profile changed. Preview uninstall again.',
          severity: 'warning',
        },
      ],
    });
  if (!plan) return createResult({ state: 'healthy' });
  const { file, edit } = plan;
  const files: Effect[] = [];
  if (edit) {
    // Keep the enrollment until the declaration write succeeds so a retry can finish removal.
    writeProfileDeclaration(edit.file, edit.after);
    files.push({ kind: 'update', target: edit.file, operation: 'write' });
  }
  unlinkSync(file);
  files.push({ kind: 'delete', target: file, operation: 'delete' });
  return createResult({ state: 'changed', effects: { files } });
}

export function removeOpenCodeV2Profile(
  root: string,
  profileLockPath: string,
  projectDirectory: string,
  expected?: { fingerprint: string | undefined },
): CliResult {
  if (!expected?.fingerprint && !observeOpenCodeV2Removal(root, projectDirectory))
    return createResult({ state: 'healthy' });
  return mutateProfile(root, profileLockPath, projectDirectory, 'remove', (profile, project) =>
    removeEnrollment(profile, project, expected),
  );
}

/** Internal selected-lane controller. Public native cutover remains proof-gated elsewhere. */
export function stageOpenCodeV2Profile(
  root: string,
  profileLockPath: string,
  selection: Omit<OpenCodeV2Selection, 'epoch'> | OpenCodeV2Selection,
  previous?: OpenCodeV2Enrollment,
): CliResult {
  return mutateProfile(
    root,
    profileLockPath,
    selection.projectDirectory,
    'enroll',
    (profile, project) => writeEnrollment(profile, project, selection, previous),
  );
}

function mutateProfile(
  root: string,
  profileLockPath: string,
  projectDirectory: string,
  operation: 'enroll' | 'remove',
  mutate: (profile: string, project: string) => CliResult,
): CliResult {
  const profile = canonicalDirectory(root);
  const project = canonicalDirectory(projectDirectory);
  if (!profile || !project || (operation === 'enroll' && !hasSafewordProjectMarker(project)))
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
      return mutate(profile, project);
    } finally {
      releaseProfileLock(profileLock);
    }
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code:
            operation === 'enroll'
              ? 'OPENCODE_V2_ENROLLMENT_UNAVAILABLE'
              : 'OPENCODE_V2_REMOVAL_UNAVAILABLE',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      ],
    });
  } finally {
    releaseProfileLock(projectLock);
  }
}
