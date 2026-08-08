import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { isCursorProjectPath, type SafewordSchema } from '../schema.js';
import { projectLifecycleSchema } from './schema.js';

/**
 * Safe Word-owned Cursor files declared by the schema. Cursor has no host
 * process to interrogate, so its project-local assets are the only surface
 * evidence available.
 */
function cursorOwnedFiles(schema: SafewordSchema): readonly string[] {
  return [...Object.keys(schema.ownedFiles), ...Object.keys(schema.managedFiles)].filter(path =>
    isCursorProjectPath(path),
  );
}

/** True when this project already carries Safe Word-owned Cursor assets. */
export function hasCursorProjectAssets(cwd: string, schema: SafewordSchema): boolean {
  return cursorOwnedFiles(schema).some(path => existsSync(nodePath.join(cwd, path)));
}

/**
 * Observe the Cursor surface from its own assets rather than mirroring the
 * project result, so a Cursor-only gap cannot be reported as healthy.
 */
export function observeCursorProject(cwd: string, schema: SafewordSchema): CliResult {
  const owned = cursorOwnedFiles(schema);
  const missing = owned.filter(path => !existsSync(nodePath.join(cwd, path)));
  if (missing.length === 0) {
    return createResult({
      state: 'healthy',
      data: {
        command: 'cursor status',
        coverage: 'project-owned Cursor assets',
        owned_files: owned.length,
      },
    });
  }
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'CURSOR_ASSETS_MISSING',
        message: `${missing.length} Safe Word-owned Cursor file(s) are missing; run \`safeword install --agents=cursor\`.`,
        severity: 'warning',
      },
    ],
    nextActions: [
      { command: 'safeword install --agents=cursor', mutates: true, requiresHuman: false },
    ],
    data: {
      command: 'cursor status',
      coverage: 'project-owned Cursor assets',
      owned_files: owned.length,
      missing_files: missing.length,
    },
  });
}

/**
 * Advise when a project carries Cursor assets that the current selection
 * excludes, so an upgrade cannot silently leave them at an older release.
 * Resolves the Cursor-inclusive schema itself — the selection's own schema has
 * every Cursor path filtered out and could never detect them.
 */
export function unselectedCursorFinding(
  cwd: string,
  agents: readonly string[],
): CliResult['findings'] {
  if (agents.includes('cursor')) return [];
  if (!hasCursorProjectAssets(cwd, projectLifecycleSchema(cwd, ['cursor']))) return [];
  return [
    {
      code: 'CURSOR_NOT_SELECTED',
      message:
        'This project has Safe Word-owned Cursor assets that the current selection excludes; include `--agents=cursor` to keep them current.',
      severity: 'info',
    },
  ];
}
