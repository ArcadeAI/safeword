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

import { isValidPreset, PRESETS } from '../utils/autonomy-policy.js';
import { PROJECT_CONFIG_SUBPATH, readAutonomyPolicy } from '../utils/autonomy-policy-config.js';
import { readFileSafe, writeJson } from '../utils/fs.js';
import { error, header, keyValue } from '../utils/output.js';

function projectConfigPath(cwd: string): string {
  return nodePath.join(cwd, ...PROJECT_CONFIG_SUBPATH);
}

function readConfig(cwd: string): Record<string, unknown> {
  const content = readFileSafe(projectConfigPath(cwd));
  if (content === undefined) return {};
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Print the resolved per-axis posture for the project. */
export function autonomyShow(cwd: string = process.cwd()): void {
  const resolved = readAutonomyPolicy(cwd);
  header('Autonomy posture');
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
