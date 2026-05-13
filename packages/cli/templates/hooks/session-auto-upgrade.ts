#!/usr/bin/env bun
// Safeword: Auto-upgrade at session start (SessionStart)
// Reads .safeword/.update-cache.json, applies patch upgrades silently with a dedicated commit.
// Skips if: not a patch bump, dirty working tree, autoUpgrade disabled, or CI environment.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { bumpType } from './lib/version.ts';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = `${projectDir}/.safeword`;

if (!existsSync(safewordDir)) {
  process.exit(0);
}

// --- Read current version ---
const versionPath = `${safewordDir}/version`;
const currentVersion = existsSync(versionPath) ? readFileSync(versionPath, 'utf8').trim() : '0.0.0';

// --- Read update cache ---
interface UpdateCache {
  latestVersion?: string;
  checkedAt?: number;
}

const cachePath = `${safewordDir}/.update-cache.json`;
const cacheFile = Bun.file(cachePath);
if (!(await cacheFile.exists())) {
  process.exit(0); // No cache yet, first session — async hook will populate it
}

let cache: UpdateCache;
try {
  cache = (await cacheFile.json()) as UpdateCache;
} catch {
  process.exit(0); // Corrupted cache
}

if (!cache.latestVersion) {
  process.exit(0);
}

const latest = cache.latestVersion;

// --- Version comparison ---
const bump = bumpType(currentVersion, latest);

if (bump === 'none') {
  process.exit(0); // No update needed (latest <= current)
}

if (bump !== 'patch') {
  // Minor or major — notify only
  console.log(
    `SAFEWORD: v${latest} available (${bump}) — run \`bunx safeword@${latest} upgrade\` to update`,
  );
  process.exit(0);
}

// --- Check opt-out ---
if (process.env.SAFEWORD_NO_AUTO_UPGRADE || process.env.CI) {
  console.log(`SAFEWORD: v${latest} available — auto-upgrade disabled`);
  process.exit(0);
}

// Check config file opt-out
try {
  const configPath = `${safewordDir}/config.json`;
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { autoUpgrade?: boolean };
    if (config.autoUpgrade === false) {
      console.log(`SAFEWORD: v${latest} available — auto-upgrade disabled in config`);
      process.exit(0);
    }
  }
} catch {
  // Config parse error, proceed with upgrade
}

// Node's execSync defaults to a 1MB stdout/stderr buffer and kills the subprocess
// with ENOBUFS on overflow. `safeword upgrade` output exceeds that on a real
// install, so we raise the ceiling for every shell-out in this hook. 50MB is
// generous; real upgrade output is well under 1MB but headroom is cheap.
const EXEC_BUFFER = 50 * 1024 * 1024;

// --- Check dirty working tree ---
try {
  const status = execSync('git status --porcelain', {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: EXEC_BUFFER,
  }).trim();
  if (status) {
    console.log(`SAFEWORD: v${latest} available — will apply when working tree is clean`);
    process.exit(0);
  }
} catch {
  // Not a git repo or git not available — skip auto-upgrade
  process.exit(0);
}

// --- Perform upgrade ---
try {
  console.log(`SAFEWORD: Auto-upgrading v${currentVersion} → v${latest}...`);

  // Run the exact version (not @latest) to avoid supply chain ambiguity
  execSync(`bunx safeword@${latest} upgrade`, {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: EXEC_BUFFER,
  });

  // Stage only safeword-managed files that changed
  const changedFiles = execSync('git diff --name-only', {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: EXEC_BUFFER,
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  const untrackedFiles = execSync('git ls-files --others --exclude-standard', {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: EXEC_BUFFER,
  })
    .trim()
    .split('\n')
    .filter(Boolean);

  const safewordPaths = [
    '.safeword/',
    '.claude/',
    '.cursor/',
    '.mcp.json',
    '.gitignore',
    'AGENTS.md',
    'CLAUDE.md',
  ];
  const filesToStage = [...changedFiles, ...untrackedFiles].filter(f =>
    safewordPaths.some(prefix => f.startsWith(prefix)),
  );

  if (filesToStage.length > 0) {
    execSync(`git add ${filesToStage.map(f => `"${f}"`).join(' ')}`, {
      cwd: projectDir,
      encoding: 'utf8',
      maxBuffer: EXEC_BUFFER,
    });
    execSync(`git commit -m "chore: safeword auto-upgrade v${currentVersion} → v${latest}"`, {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: EXEC_BUFFER,
    });
  }

  console.log(`SAFEWORD: Auto-upgraded v${currentVersion} → v${latest}`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.log(`SAFEWORD: Auto-upgrade to v${latest} failed — will retry next session. ${message}`);
}
