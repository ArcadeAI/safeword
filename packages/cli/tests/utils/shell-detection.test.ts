import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { detectProjectType } from '../../src/utils/project-detector';

const temporaryDirectories: string[] = [];

afterEach(() => {
  const directories = [...temporaryDirectories];
  temporaryDirectories.length = 0;
  for (const dir of directories) rmSync(dir, { force: true, recursive: true });
});

function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-shell-'));
  temporaryDirectories.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const abs = nodePath.join(root, relativePath);
    mkdirSync(nodePath.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

describe('project shell detection', () => {
  it('is true when the USER has a shell script in their own source tree', () => {
    const root = makeRepo({ 'scripts/deploy.sh': '#!/bin/sh\necho hi\n' });
    expect(detectProjectType({}, root).shell).toBe(true);
  });

  it('is false when the only .sh files live in safeword-owned dirs', () => {
    // A fresh Rust project whose only .sh files were installed by safeword and
    // the auto-installed language skill. These are NOT the user's scripts, so
    // shell detection must ignore them — otherwise the post-setup health check
    // expects a prettier-plugin-sh that setup never installed and
    // `setup --yes` exits 1 (the rust-golden-path CI regression).
    const root = makeRepo({
      'Cargo.toml': '[package]\nname = "x"\nversion = "0.1.0"\nedition = "2021"\n',
      '.safeword/scripts/cleanup-zombies.sh': '#!/bin/sh\n',
      '.claude/skills/rust-skills/checks/check.sh': '#!/bin/sh\n',
      '.agents/skills/rust-skills/checks/check.sh': '#!/bin/sh\n',
    });
    expect(detectProjectType({}, root).shell).toBe(false);
  });

  it('is false for a project with no shell scripts at all', () => {
    const root = makeRepo({ 'src/main.rs': 'fn main() {}\n' });
    expect(detectProjectType({}, root).shell).toBe(false);
  });
});
