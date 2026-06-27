#!/usr/bin/env bun
// Safeword Claude Code plugin — SessionStart version handshake (read-only).
//
// The plugin ships the static agent layer (skills) and auto-updates via its
// marketplace; the CLI ships the runtime hooks + project-state layer in
// `.safeword/` and updates via `bunx safeword`. Those two clocks drift. This
// hook detects the dangerous direction — plugin newer than the CLI runtime it
// depends on — and surfaces it loudly with an actionable command, instead of
// failing silently later (ticket J611KP).
//
// Runs from the read-only plugin cache via run-bun.sh, so it uses only node:fs
// (works under bun AND the `npx tsx` fallback) and never writes anything.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Minimum CLI/runtime version this plugin build is compatible with. Bump only
// when a skill or hook contract changes in a way an older `.safeword/` can't
// satisfy (owned by the versioning skill). The promoted skills (explain, lint,
// cleanup-zombies) add no new `.safeword/` runtime contract, so the floor is the
// current installed-runtime baseline, not the latest package version.
const PLUGIN_MIN_CLI = '0.57.0';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = path.join(projectDir, '.safeword');

// Not a safeword project yet — the bootstrap SessionStart nudge handles this.
if (!existsSync(safewordDir)) {
  process.exit(0);
}

const versionFile = path.join(safewordDir, 'version');
const runtimeVersion = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : '';

/** Parse strict `major.minor.patch`; null if not that shape. */
function parseSemver(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** -1 if a<b, 0 if equal, 1 if a>b. */
function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

const runtime = parseSemver(runtimeVersion);
const minimum = parseSemver(PLUGIN_MIN_CLI);

// Unreadable/unknown runtime version — don't block, just stay quiet.
if (!runtime || !minimum) {
  process.exit(0);
}

if (compareSemver(runtime, minimum) < 0) {
  // Plugin requires a newer CLI runtime than this project has installed.
  // Exit 2 → stderr surfaces to Claude as a system reminder with the fix.
  process.stderr.write(
    `SAFEWORD: plugin requires CLI >= ${PLUGIN_MIN_CLI} but this project's .safeword runtime is ${runtimeVersion}. ` +
      `Run \`bunx safeword@latest upgrade\` to sync the project runtime.\n`,
  );
  process.exit(2);
}

// Compatible — confirm the plugin is live (mirrors the CLI hook's banner).
console.log(`SAFE WORD plugin active (skills) — CLI runtime v${runtimeVersion} compatible.`);
