#!/usr/bin/env bun
// Safeword: Auto-upgrade at session start (SessionStart)
// Reads .safeword/.update-cache.json, applies patch upgrades silently with a dedicated commit.
// Skips if: not a patch bump, dirty working tree, autoUpdate disabled, or CI environment.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

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
function parseVersion(v: string): [number, number, number] {
  const parts = v.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

const [curMajor, curMinor, curPatch] = parseVersion(currentVersion);
const [latMajor, latMinor, latPatch] = parseVersion(latest);

// No update needed
if (
  latMajor < curMajor ||
  (latMajor === curMajor && latMinor < curMinor) ||
  (latMajor === curMajor && latMinor === curMinor && latPatch <= curPatch)
) {
  process.exit(0);
}

// --- Classify bump type ---
const isPatch = latMajor === curMajor && latMinor === curMinor && latPatch > curPatch;

if (!isPatch) {
  // Minor or major — notify only
  const bumpType = latMajor > curMajor ? 'major' : 'minor';
  console.log(
    `SAFEWORD: v${latest} available (${bumpType}) — run \`bunx safeword@${latest} upgrade\` to update`,
  );
  process.exit(0);
}

// --- Check opt-out ---
if (process.env.SAFEWORD_NO_AUTO_UPDATE || process.env.CI) {
  console.log(`SAFEWORD: v${latest} available — auto-update disabled`);
  process.exit(0);
}

// Check config file opt-out
try {
  const configPath = `${safewordDir}/config.json`;
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { autoUpdate?: boolean };
    if (config.autoUpdate === false) {
      console.log(`SAFEWORD: v${latest} available — auto-update disabled in config`);
      process.exit(0);
    }
  }
} catch {
  // Config parse error, proceed with upgrade
}

// --- Check dirty working tree ---
try {
  const status = execSync('git status --porcelain', { cwd: projectDir, encoding: 'utf8' }).trim();
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
  });

  // Stage only safeword-managed files that changed
  const changedFiles = execSync('git diff --name-only', { cwd: projectDir, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const untrackedFiles = execSync('git ls-files --others --exclude-standard', {
    cwd: projectDir,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);

  const safewordPaths = [
    '.safeword/',
    '.claude/',
    '.cursor/',
    '.mcp.json',
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
    });
    execSync(`git commit -m "chore: safeword auto-upgrade v${currentVersion} → v${latest}"`, {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }

  console.log(`SAFEWORD: Auto-upgraded v${currentVersion} → v${latest}`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.log(`SAFEWORD: Auto-upgrade to v${latest} failed — will retry next session. ${message}`);
}
