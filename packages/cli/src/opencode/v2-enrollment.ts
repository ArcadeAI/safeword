import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
