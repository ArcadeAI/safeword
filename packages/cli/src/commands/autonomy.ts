/**
 * `safeword autonomy` — view and set the project's autonomy posture
 * (ticket HPQ43R). `show` prints the resolved per-axis posture; `set <preset>`
 * records a named preset in the committed `.safeword/config.json`.
 *
 * This is the user-facing surface over the pure resolver in
 * `utils/autonomy-policy` and its IO layer `utils/autonomy-policy-config`.
 */

import nodePath from 'node:path';
import process from 'node:process';

import {
  AXES,
  isValidAxis,
  isValidPosture,
  isValidPreset,
  PRESETS,
} from '../utils/autonomy-policy.js';
import {
  PERSONAL_CONFIG_SUBPATH,
  PROJECT_CONFIG_SUBPATH,
  readAutonomyPolicy,
} from '../utils/autonomy-policy-config.js';
import { readFileSafe, writeJson } from '../utils/fs.js';
import { error, header, keyValue } from '../utils/output.js';

function configPathFor(cwd: string, personal: boolean): string {
  return nodePath.join(cwd, ...(personal ? PERSONAL_CONFIG_SUBPATH : PROJECT_CONFIG_SUBPATH));
}

function projectConfigPath(cwd: string): string {
  return nodePath.join(cwd, ...PROJECT_CONFIG_SUBPATH);
}

function readConfigAt(path: string): Record<string, unknown> {
  const content = readFileSafe(path);
  if (content === undefined) return {};
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readConfig(cwd: string): Record<string, unknown> {
  return readConfigAt(projectConfigPath(cwd));
}

/** Print the resolved per-axis posture for the project, naming its source. */
export function autonomyShow(cwd: string = process.cwd()): void {
  const resolved = readAutonomyPolicy(cwd);
  const projectPreset = (readConfig(cwd).autonomy as { preset?: unknown } | undefined)?.preset;
  const presetLabel = isValidPreset(projectPreset) ? projectPreset : 'Full review (default)';
  const hasPersonal = readConfigAt(configPathFor(cwd, true)).autonomy !== undefined;
  // Source goes in the header, not a keyValue line, so per-axis parsers see
  // only the five axis rows.
  header(`Autonomy posture — ${presetLabel}${hasPersonal ? ' + personal overrides' : ''}`);
  for (const [axis, posture] of Object.entries(resolved)) {
    keyValue(axis, posture);
  }
}

/**
 * Record a named preset in the committed project config. Rejects an unknown
 * preset (the committed config is left untouched) and exits non-zero.
 */
export function autonomySet(preset: string, cwd: string = process.cwd()): void {
  if (!isValidPreset(preset)) {
    error(`Unknown preset "${preset}". Choose one of: ${PRESETS.join(', ')}.`);
    process.exitCode = 1;
    return;
  }
  const config = readConfig(cwd);
  const autonomy = (config.autonomy as Record<string, unknown> | undefined) ?? {};
  writeJson(projectConfigPath(cwd), { ...config, autonomy: { ...autonomy, preset } });
  header('Autonomy posture');
  keyValue('preset', preset);
}

/**
 * Override a single axis's posture. Writes to the project config by default,
 * or the gitignored personal config with `--personal` (which wins on resolve).
 * Rejects an unknown axis or posture, leaving the target config untouched.
 */
export function autonomyOverride(
  axis: string,
  posture: string,
  options: { personal?: boolean } = {},
  cwd: string = process.cwd(),
): void {
  if (!isValidAxis(axis)) {
    error(`Unknown axis "${axis}". Choose one of: ${AXES.join(', ')}.`);
    process.exitCode = 1;
    return;
  }
  if (!isValidPosture(posture)) {
    error(`Unknown posture "${posture}". Choose "ask" or "autonomous".`);
    process.exitCode = 1;
    return;
  }
  const path = configPathFor(cwd, options.personal ?? false);
  const config = readConfigAt(path);
  const autonomy = (config.autonomy as Record<string, unknown> | undefined) ?? {};
  const overrides = (autonomy.overrides as Record<string, string> | undefined) ?? {};
  writeJson(path, {
    ...config,
    autonomy: { ...autonomy, overrides: { ...overrides, [axis]: posture } },
  });
  header(`Autonomy posture${options.personal ? ' (personal)' : ''}`);
  keyValue(axis, posture);
}
