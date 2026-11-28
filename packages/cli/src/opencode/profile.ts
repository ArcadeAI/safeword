import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import hostReleases from '../lifecycle/host-releases.json' with { type: 'json' };
import { OPENCODE_V2_PLUGIN_LAYOUT } from '../schema.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';
import { openCodeProfilePaths } from './config-root.js';
import { currentOpenCodeV2Identity } from './conformance.js';
import { readOpenCodeV2Lane } from './evidence.js';
import type { OpenCodeV2Enrollment, OpenCodeV2Selection } from './v2-enrollment.js';
import {
  removeOpenCodeV2Profile,
  selectedOpenCodeV2Enrollment,
  stageOpenCodeV2Profile,
} from './v2-profile.js';

export { type PlatformEnvironment, resolveOpenCodeConfigRoot } from './config-root.js';

export interface ObserveOpenCodeProfileInput {
  readonly now?: number;
  readonly opencodeVersion?: string;
  readonly projectDirectory?: string;
}

function unavailable(
  code: string,
  message: string,
  selectedPackage?: { recovery: string | undefined },
): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'error' }],
    nextActions: [
      {
        kind: 'human',
        instruction:
          selectedPackage?.recovery ??
          `Use OpenCode ${hostReleases.opencode.version} with an admitted V2 package and current local conformance/native activation. Normal customer admission is not yet available. Remove any old V1 installation manually; Safeword does not inspect or modify those external files.`,
        mutates: false,
        requiresHuman: true,
      },
    ],
    data: {
      installed: selectedPackage !== undefined,
      activated: false,
      conformant: false,
      pre_tool: 'unavailable',
      profile_removable: false,
    },
  });
}

export function installOpenCodeProfile(
  root: string,
  selection?:
    | { readonly nativeV2: OpenCodeV2Selection }
    | { readonly projectDirectory: string; readonly opencodeVersion?: string },
): CliResult {
  if (selection && 'nativeV2' in selection)
    return stageOpenCodeV2Profile(root, openCodeProfilePaths(root).lock, selection.nativeV2);
  const packageDirectory = nodePath.join(import.meta.dirname, OPENCODE_V2_PLUGIN_LAYOUT.directory);
  if (selection && existsSync(nodePath.join(packageDirectory, OPENCODE_V2_PLUGIN_LAYOUT.entry))) {
    if (selection.opencodeVersion !== hostReleases.opencode.version)
      return unavailable(
        'OPENCODE_VERSION_UNSUPPORTED',
        `Install OpenCode ${hostReleases.opencode.version} to use the bundled Safeword plugin.`,
      );
    const { projectDirectory } = selection;
    return stageOpenCodeV2Profile(root, openCodeProfilePaths(root).lock, {
      projectDirectory,
      packageDirectory,
    });
  }
  return unavailable(
    'OPENCODE_V2_ADMISSION_REQUIRED',
    'OpenCode V2 is the sole supported target; no admitted customer package is currently available.',
  );
}

export function uninstallOpenCodeProfile(
  root: string,
  projectDirectory: string,
  expected?: { fingerprint: string | undefined },
): CliResult {
  return removeOpenCodeV2Profile(root, openCodeProfilePaths(root).lock, projectDirectory, expected);
}

function observeV2Protection(
  enrollment: OpenCodeV2Enrollment,
  input: ObserveOpenCodeProfileInput,
): CliResult {
  const observeLane = (runtime: 'CLI' | 'TUI') => {
    try {
      return readOpenCodeV2Lane(
        currentOpenCodeV2Identity(enrollment, input.opencodeVersion ?? 'unobserved', runtime),
        input.now ?? Date.now(),
      );
    } catch {
      return {
        activated: false,
        conformant: false,
        guarantees: [{ id: 'reject_action', state: 'unproved' }],
        registrations: [],
      };
    }
  };
  const lanes = { CLI: observeLane('CLI'), TUI: observeLane('TUI') };
  const active = lanes.CLI.activated && lanes.TUI.activated;
  return createResult({
    state: active ? 'healthy' : 'action_required',
    findings: active
      ? []
      : [
          {
            code: 'OPENCODE_V2_CONFORMANCE_REQUIRED',
            message:
              'This selected OpenCode V2 package lacks current conformance or a fresh, attributable native host observation.',
            severity: 'error',
          },
        ],
    nextActions: [
      {
        kind: 'human',
        instruction:
          'Obtain current local conformance, then use the enrolled project in a dedicated standalone CLI or prompted TUI session. Native activation currently requires macOS process observation and system Python; shared, remote or unrecognized hosts remain inactive.',
        mutates: false,
        requiresHuman: true,
      },
    ],
    data: {
      installed: true,
      activated: active,
      conformant: lanes.CLI.conformant && lanes.TUI.conformant,
      pre_tool: active ? 'block' : 'unavailable',
      profile_removable: false,
      lane: 2,
      runtime_lanes: lanes,
    },
  });
}

export function observeOpenCodeProfile(
  root: string,
  input: ObserveOpenCodeProfileInput = {},
): CliResult {
  if (input.opencodeVersion !== hostReleases.opencode.version) {
    // Enrollment establishes installation independently of host conformance.
    if (
      input.opencodeVersion &&
      isSafePackageVersion(input.opencodeVersion) &&
      selectedOpenCodeV2Enrollment(root, input.projectDirectory, input.opencodeVersion)
    )
      return unavailable(
        'OPENCODE_VERSION_UNSUPPORTED',
        `The selected OpenCode package is installed. Protection is unverified for OpenCode ${input.opencodeVersion}.`,
        {
          recovery:
            compareVersions(input.opencodeVersion, hostReleases.opencode.version) > 0
              ? 'Update Safeword to a release that supports this OpenCode version, then restart OpenCode.'
              : undefined,
        },
      );
    return unavailable(
      'OPENCODE_VERSION_UNSUPPORTED',
      `Only OpenCode ${hostReleases.opencode.version} is supported; this host is unprotected.`,
    );
  }
  const enrollment = selectedOpenCodeV2Enrollment(
    root,
    input.projectDirectory,
    input.opencodeVersion,
  );
  return enrollment
    ? observeV2Protection(enrollment, input)
    : unavailable(
        'OPENCODE_V2_ENROLLMENT_REQUIRED',
        'No current V2 enrollment selects this project and package.',
      );
}
