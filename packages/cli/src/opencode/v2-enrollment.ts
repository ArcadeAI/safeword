import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { hostname } from 'node:os';
import nodePath from 'node:path';

import type { OPENCODE_V2_PLUGIN_LAYOUT } from '../schema.js';
import { canonicalDirectory } from '../utils/fs.js';

type Layout = typeof OPENCODE_V2_PLUGIN_LAYOUT;

export interface OpenCodeV2Selection {
  readonly projectDirectory: string;
  readonly packageDirectory: string;
  readonly epoch: string;
}

export interface OpenCodeV2Enrollment {
  readonly schema_version: 1;
  readonly lane: 2;
  readonly machine: string;
  readonly profile_directory: string;
  readonly project_directory: string;
  readonly package_directory: string;
  readonly epoch: string;
  readonly entry_sha256: string;
  readonly runtime_sha256: string;
}

function digest(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function openCodeV2EnrollmentPath(profile: string, project: string, layout: Layout): string {
  return nodePath.join(profile, layout.enrollments, `${digest(project)}.json`);
}

/** Enrollment is an instruction from the lifecycle controller, never host evidence. */
export function createOpenCodeV2Enrollment(
  profile: string,
  selection: OpenCodeV2Selection,
  layout: Layout,
): OpenCodeV2Enrollment {
  const project = canonicalDirectory(selection.projectDirectory);
  const packageDirectory = canonicalDirectory(selection.packageDirectory);
  if (!project || !packageDirectory || selection.epoch.trim() === '')
    throw new Error('OpenCode V2 enrollment requires existing canonical directories and an epoch.');
  return {
    schema_version: 1,
    lane: 2,
    machine: hostname(),
    profile_directory: profile,
    project_directory: project,
    package_directory: packageDirectory,
    epoch: selection.epoch,
    entry_sha256: digest(readFileSync(nodePath.join(packageDirectory, layout.entry))),
    runtime_sha256: digest(readFileSync(nodePath.join(packageDirectory, layout.runtime))),
  };
}

/** Missing, foreign or changed enrollment cannot activate this package in another location. */
export function readOpenCodeV2Enrollment(
  profile: string,
  project: string,
  packageDirectory: string,
  layout: Layout,
): OpenCodeV2Enrollment | undefined {
  try {
    const file = openCodeV2EnrollmentPath(profile, project, layout);
    const record = JSON.parse(readFileSync(file, 'utf8')) as OpenCodeV2Enrollment;
    const expected = createOpenCodeV2Enrollment(
      profile,
      { projectDirectory: project, packageDirectory, epoch: record.epoch },
      layout,
    );
    return Object.entries(expected).every(([key, value]) => Reflect.get(record, key) === value)
      ? record
      : undefined;
  } catch {
    return undefined;
  }
}

/** Bind every contained package file and mode, not only the enrollment entry/runtime pair. */
export function openCodeV2PayloadDigest(packageDirectory: string): string {
  const root = realpathSync(packageDirectory);
  const hash = createHash('sha256');
  const visit = (directory: string, prefix: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true }).toSorted((a, b) =>
      Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)),
    );
    for (const entry of entries) {
      const file = nodePath.join(directory, entry.name);
      const relative = nodePath.relative(root, realpathSync(file));
      if (
        relative === '..' ||
        relative.startsWith(`..${nodePath.sep}`) ||
        nodePath.isAbsolute(relative)
      )
        throw new Error('Package link resolves outside the selected payload.');
      const logical = nodePath.posix.join(prefix, entry.name);
      const metadata = statSync(file);
      if (entry.isDirectory()) {
        hash.update(JSON.stringify([logical, 'directory', metadata.mode & 0o777]));
        visit(file, logical);
      } else {
        if (!metadata.isFile())
          throw new Error('Package payload requires contained regular files.');
        const bytes = readFileSync(file);
        hash.update(JSON.stringify([logical, metadata.mode & 0o777, bytes.length])).update(bytes);
      }
    }
  };
  visit(root, '');
  return hash.digest('hex');
}

/** Common current target binding; never copy controller-only proof fields into host evidence. */
export function openCodeV2NativeBinding(enrollment: OpenCodeV2Enrollment, hostVersion: string) {
  const configSnapshot = [enrollment.profile_directory, enrollment.project_directory].flatMap(
    root =>
      ['opencode.jsonc', 'opencode.json', '.safeword/config.json'].map(name => {
        const file = nodePath.join(root, name);
        return [file, existsSync(file) ? digest(readFileSync(file)) : 'absent'];
      }),
  );
  return {
    schema_version: enrollment.schema_version,
    lane: enrollment.lane,
    machine: enrollment.machine,
    profile_directory: enrollment.profile_directory,
    project_directory: enrollment.project_directory,
    package_directory: enrollment.package_directory,
    epoch: enrollment.epoch,
    entry_sha256: enrollment.entry_sha256,
    runtime_sha256: enrollment.runtime_sha256,
    host_version: hostVersion,
    platform: process.platform,
    arch: process.arch,
    payload_sha256: openCodeV2PayloadDigest(enrollment.package_directory),
    configuration_sha256: digest(JSON.stringify(configSnapshot)),
  };
}

export function openCodeV2NativeStore(
  binding: ReturnType<typeof openCodeV2NativeBinding>,
  directory: string,
) {
  const root = nodePath.join(binding.profile_directory, directory);
  const bucket = digest(JSON.stringify(binding));
  return {
    directory: nodePath.join(root, bucket),
    keyFile: nodePath.join(root, 'integrity.key'),
    headFile: nodePath.join(root, 'heads', `${bucket}.json`),
  };
}
