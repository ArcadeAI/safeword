/**
 * E2E Test: Rust Golden Path
 *
 * Verifies that a Rust project with safeword works correctly:
 * - clippy.toml config is created (project root + .safeword/)
 * - rustfmt.toml config is created (project root + .safeword/)
 * - Cargo.toml gets [lints.clippy] section merged
 * - cargo clippy runs and catches issues (when installed)
 * - rustfmt formats Rust files (when installed)
 *
 * Note: Tests requiring clippy/rustfmt are skipped if not installed.
 * Uses a single project setup (expensive) shared across all tests.
 */

import { spawnSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRustProject,
  createRustWorkspace,
  createTemporaryDirectory,
  fileExists,
  initGitRepo,
  isClippyInstalled,
  isRustfmtInstalled,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  runLintHook,
  writeTestFile,
} from '../helpers';

const CLIPPY_AVAILABLE = isClippyInstalled();
const RUSTFMT_AVAILABLE = isRustfmtInstalled();

describe('E2E: Rust Golden Path', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustProject(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000); // 3 min timeout for setup

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  // Scenario 1: Single-crate Rust project setup
  it('creates clippy.toml at project root', () => {
    expect(fileExists(projectDirectory, 'clippy.toml')).toBe(true);

    const config = readTestFile(projectDirectory, 'clippy.toml');
    expect(config).toContain('cognitive-complexity-threshold');
    expect(config).toContain('too-many-arguments-threshold');
  });

  it('creates .safeword/clippy.toml', () => {
    expect(fileExists(projectDirectory, '.safeword/clippy.toml')).toBe(true);

    const config = readTestFile(projectDirectory, '.safeword/clippy.toml');
    expect(config).toContain('cognitive-complexity-threshold = 10');
    expect(config).toContain('too-many-arguments-threshold = 5');
  });

  it('creates rustfmt.toml at project root', () => {
    expect(fileExists(projectDirectory, 'rustfmt.toml')).toBe(true);

    const config = readTestFile(projectDirectory, 'rustfmt.toml');
    expect(config).toContain('edition');
    expect(config).toContain('max_width');
  });

  it('creates .safeword/rustfmt.toml', () => {
    expect(fileExists(projectDirectory, '.safeword/rustfmt.toml')).toBe(true);

    const config = readTestFile(projectDirectory, '.safeword/rustfmt.toml');
    expect(config).toContain('edition = "2021"');
    expect(config).toContain('max_width = 100');
    expect(config).toContain('newline_style = "Unix"');
  });

  it('merges [lints.clippy] into Cargo.toml', () => {
    const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');

    // Check for [lints.clippy] section with pedantic enabled
    expect(cargoToml).toContain('[lints.clippy]');
    expect(cargoToml).toContain('pedantic');

    // Check for [lints.rust] section with unsafe_code denied
    expect(cargoToml).toContain('[lints.rust]');
    expect(cargoToml).toContain('unsafe_code');
  });

  it.skipIf(!CLIPPY_AVAILABLE)('clippy config is valid', () => {
    // cargo clippy should run without config errors
    const result = spawnSync('cargo', ['clippy', '--', '--version'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    // Just checking it doesn't error on config parsing
    expect(result.status).toBe(0);
  });

  it.skipIf(!CLIPPY_AVAILABLE)('clippy runs on valid code', () => {
    // main.rs from createRustProject should be valid
    const result = spawnSync('cargo', ['clippy'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
  });

  it.skipIf(!CLIPPY_AVAILABLE)('clippy detects unwrap_used violation', () => {
    // Modify main.rs to include an unwrap call (files must be in module tree to be checked)
    writeTestFile(
      projectDirectory,
      'src/main.rs',
      `fn main() {
    let x: Option<i32> = Some(5);
    let _y = x.unwrap(); // clippy::unwrap_used should trigger
    println!("Hello, world!");
}
`,
    );

    // Run clippy with deny on unwrap_used (our config has it as warn)
    const result = spawnSync('cargo', ['clippy', '--', '-D', 'clippy::unwrap_used'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/unwrap_used|unwrap/i);
  });

  it.skipIf(!RUSTFMT_AVAILABLE)('rustfmt formats files', () => {
    writeTestFile(projectDirectory, 'src/ugly.rs', `fn main(){println!("no spaces")}`);

    spawnSync('rustfmt', ['src/ugly.rs'], { cwd: projectDirectory });

    const formatted = readTestFile(projectDirectory, 'src/ugly.rs');
    expect(formatted).toContain('fn main() {');
  });

  it.skipIf(!RUSTFMT_AVAILABLE)('lint hook processes .rs files', () => {
    const filePath = nodePath.join(projectDirectory, 'src/hook-test.rs');
    writeTestFile(projectDirectory, 'src/hook-test.rs', `fn hook_test(){println!("test")}`);

    runLintHook(projectDirectory, filePath);

    const result = readTestFile(projectDirectory, 'src/hook-test.rs');
    expect(result).toContain('fn hook_test() {');
  });
});

// Scenario 4: Existing clippy.toml is preserved
describe('E2E: Rust Config Preservation', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustProject(projectDirectory);
    // Create existing clippy.toml BEFORE setup
    writeTestFile(
      projectDirectory,
      'clippy.toml',
      `# My custom clippy config
cognitive-complexity-threshold = 25
`,
    );
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('preserves existing clippy.toml at project root', () => {
    const config = readTestFile(projectDirectory, 'clippy.toml');
    // Should keep user's custom threshold
    expect(config).toContain('cognitive-complexity-threshold = 25');
    expect(config).toContain('My custom clippy config');
  });

  it('creates .safeword/clippy.toml that preserves customer thresholds and fills gaps', () => {
    expect(fileExists(projectDirectory, '.safeword/clippy.toml')).toBe(true);
    const config = readTestFile(projectDirectory, '.safeword/clippy.toml');
    // Customer's threshold preserved (not overridden to 10)
    expect(config).toContain('cognitive-complexity-threshold = 25');
    // Safeword fills gaps for thresholds customer didn't set
    expect(config).toContain('too-many-arguments-threshold = 5');
    expect(config).toContain('too-many-lines-threshold = 100');
  });

  it('adds no safeword defaults when customer sets all thresholds', async () => {
    // Create a second project where customer covers everything
    const fullCoverageDirectory = createTemporaryDirectory();
    createRustProject(fullCoverageDirectory);
    writeTestFile(
      fullCoverageDirectory,
      'clippy.toml',
      `cognitive-complexity-threshold = 20
too-many-arguments-threshold = 8
too-many-lines-threshold = 150
type-complexity-threshold = 300
`,
    );
    initGitRepo(fullCoverageDirectory);
    await runCli(['setup', '--yes'], { cwd: fullCoverageDirectory });

    const config = readTestFile(fullCoverageDirectory, '.safeword/clippy.toml');
    // All customer thresholds preserved
    expect(config).toContain('cognitive-complexity-threshold = 20');
    expect(config).toContain('too-many-arguments-threshold = 8');
    // No "Safeword defaults" section since all gaps are filled
    expect(config).not.toContain('Safeword defaults');

    removeTemporaryDirectory(fullCoverageDirectory);
  });
});

// Scenario 4b: Existing rustfmt.toml is preserved
describe('E2E: Rust Rustfmt Config Preservation', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustProject(projectDirectory);
    // Create existing rustfmt.toml BEFORE setup
    writeTestFile(
      projectDirectory,
      'rustfmt.toml',
      `# My custom rustfmt config
max_width = 120
tab_spaces = 4
`,
    );
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('preserves existing rustfmt.toml at project root', () => {
    const config = readTestFile(projectDirectory, 'rustfmt.toml');
    // Should keep user's custom settings
    expect(config).toContain('max_width = 120');
    expect(config).toContain('tab_spaces = 4');
    expect(config).toContain('My custom rustfmt config');
  });

  it('creates .safeword/rustfmt.toml for hooks', () => {
    expect(fileExists(projectDirectory, '.safeword/rustfmt.toml')).toBe(true);
    const config = readTestFile(projectDirectory, '.safeword/rustfmt.toml');
    // Safeword config has strict defaults
    expect(config).toContain('max_width = 100');
  });
});

// Scenario 5: Existing Cargo.toml lints are skipped entirely (user owns)
describe('E2E: Rust Existing Lints Preserved', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustProject(projectDirectory);
    // Add [lints.clippy] section BEFORE setup (simulates user's existing config)
    const cargoPath = 'Cargo.toml';
    const existingContent = readTestFile(projectDirectory, cargoPath);
    writeTestFile(
      projectDirectory,
      cargoPath,
      `${existingContent}
[lints.clippy]
# User's custom lint config
unwrap_used = "allow"
`,
    );
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('preserves user lints config (does NOT add safeword lints)', () => {
    const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');
    // User's setting preserved
    expect(cargoToml).toContain('unwrap_used = "allow"');
    // Safeword's pedantic NOT added (we skip entirely)
    expect(cargoToml).not.toContain('pedantic');
    // Should only have one [lints.clippy] section
    const lintClippyCount = (cargoToml.match(/\[lints\.clippy\]/g) || []).length;
    expect(lintClippyCount).toBe(1);
  });

  it('still creates .safeword/ configs for hooks', () => {
    expect(fileExists(projectDirectory, '.safeword/clippy.toml')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/rustfmt.toml')).toBe(true);
    // Safeword strict config still available for hooks
    const config = readTestFile(projectDirectory, '.safeword/clippy.toml');
    expect(config).toContain('cognitive-complexity-threshold = 10');
  });
});

// Scenario 7: TypeScript + Rust polyglot project
describe('E2E: TypeScript + Rust Mixed Project', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    // Create both package.json AND Cargo.toml
    writeTestFile(
      projectDirectory,
      'package.json',
      JSON.stringify({
        name: 'mixed-project',
        version: '0.1.0',
        devDependencies: { typescript: '^5.0.0' },
      }),
    );
    createRustProject(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('creates TypeScript config (eslint.config.mjs)', () => {
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
  });

  it('creates Rust config (clippy.toml)', () => {
    expect(fileExists(projectDirectory, 'clippy.toml')).toBe(true);
  });

  it('creates Rust config (rustfmt.toml)', () => {
    expect(fileExists(projectDirectory, 'rustfmt.toml')).toBe(true);
  });

  it('both packs coexist in .safeword/', () => {
    // TypeScript pack
    expect(fileExists(projectDirectory, '.safeword/eslint.config.mjs')).toBe(true);
    // Rust pack
    expect(fileExists(projectDirectory, '.safeword/clippy.toml')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/rustfmt.toml')).toBe(true);
  });
});

// Scenario 12: Pure Rust project (no package.json)
describe('E2E: Pure Rust Project', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustProject(projectDirectory);
    // Ensure NO package.json exists
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('does NOT create package.json', () => {
    expect(fileExists(projectDirectory, 'package.json')).toBe(false);
  });

  it('does NOT create eslint.config.mjs', () => {
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(false);
  });

  it('creates Rust configs', () => {
    expect(fileExists(projectDirectory, '.safeword/clippy.toml')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/rustfmt.toml')).toBe(true);
    expect(fileExists(projectDirectory, 'clippy.toml')).toBe(true);
    expect(fileExists(projectDirectory, 'rustfmt.toml')).toBe(true);
  });
});

// Scenario 2: Workspace setup with member crates
describe('E2E: Rust Workspace Setup', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustWorkspace(projectDirectory, { members: ['core', 'cli'] });
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('adds [workspace.lints.clippy] to root Cargo.toml', () => {
    const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');
    expect(cargoToml).toContain('[workspace.lints.clippy]');
    expect(cargoToml).toContain('pedantic');
  });

  it('adds [workspace.lints.rust] to root Cargo.toml', () => {
    const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');
    expect(cargoToml).toContain('[workspace.lints.rust]');
    expect(cargoToml).toContain('unsafe_code');
  });

  it('adds [lints] workspace = true to crates/core/Cargo.toml', () => {
    const cargoToml = readTestFile(projectDirectory, 'crates/core/Cargo.toml');
    expect(cargoToml).toContain('[lints]');
    expect(cargoToml).toContain('workspace = true');
  });

  it('adds [lints] workspace = true to crates/cli/Cargo.toml', () => {
    const cargoToml = readTestFile(projectDirectory, 'crates/cli/Cargo.toml');
    expect(cargoToml).toContain('[lints]');
    expect(cargoToml).toContain('workspace = true');
  });
});

// Scenario 3: Virtual workspace setup (no root package)
describe('E2E: Rust Virtual Workspace', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    // createRustWorkspace creates a virtual workspace by default (no [package])
    createRustWorkspace(projectDirectory, { members: ['lib-a', 'lib-b'] });
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('adds [workspace.lints.clippy] to virtual workspace', () => {
    const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');
    // Should NOT have [lints.clippy] (that's for single-crate)
    expect(cargoToml).not.toContain('[lints.clippy]');
    // Should have [workspace.lints.clippy]
    expect(cargoToml).toContain('[workspace.lints.clippy]');
  });

  it('member crates inherit via workspace = true', () => {
    const libraryA = readTestFile(projectDirectory, 'crates/lib-a/Cargo.toml');
    const libraryB = readTestFile(projectDirectory, 'crates/lib-b/Cargo.toml');

    expect(libraryA).toContain('[lints]');
    expect(libraryA).toContain('workspace = true');
    expect(libraryB).toContain('[lints]');
    expect(libraryB).toContain('workspace = true');
  });
});

// Scenario 6: Member with explicit [lints] section is skipped
describe('E2E: Rust Workspace Skip Explicit Lints', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustWorkspace(projectDirectory, { members: ['modified', 'pristine'] });

    // Add explicit [lints] section to 'modified' crate BEFORE setup
    const modifiedCargoPath = 'crates/modified/Cargo.toml';
    const existingContent = readTestFile(projectDirectory, modifiedCargoPath);
    writeTestFile(
      projectDirectory,
      modifiedCargoPath,
      `${existingContent}
[lints.clippy]
unwrap_used = "allow"
`,
    );

    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('preserves explicit [lints] in modified crate', () => {
    const cargoToml = readTestFile(projectDirectory, 'crates/modified/Cargo.toml');
    // Should keep user's setting
    expect(cargoToml).toContain('unwrap_used = "allow"');
    // Should NOT add workspace = true (already has explicit lints)
    expect(cargoToml).not.toMatch(/\[lints\]\s*\nworkspace = true/);
  });

  it('adds workspace = true to pristine crate', () => {
    const cargoToml = readTestFile(projectDirectory, 'crates/pristine/Cargo.toml');
    expect(cargoToml).toContain('[lints]');
    expect(cargoToml).toContain('workspace = true');
  });
});

// Test glob pattern expansion in workspace members (members = ["crates/*"])
describe('E2E: Rust Workspace Glob Pattern', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    // Creates workspace with members = ["crates/*"] and crates/alpha, crates/beta
    createRustWorkspace(projectDirectory, { members: ['alpha', 'beta', 'gamma'], useGlob: true });
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('uses glob pattern in root Cargo.toml', () => {
    const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');
    // Verify the glob pattern is preserved (we don't expand it in the file)
    expect(cargoToml).toContain('members = ["crates/*"]');
    // Workspace lints should still be added
    expect(cargoToml).toContain('[workspace.lints.clippy]');
  });

  it('adds [lints] workspace = true to all discovered crates', () => {
    // All three crates should have lints.workspace = true
    for (const crate of ['alpha', 'beta', 'gamma']) {
      const cargoToml = readTestFile(projectDirectory, `crates/${crate}/Cargo.toml`);
      expect(cargoToml).toContain('[lints]');
      expect(cargoToml).toContain('workspace = true');
    }
  });
});

// Test lint hook fallback: rustfmt works without .safeword/rustfmt.toml
describe('E2E: Rust Lint Hook Fallback', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustProject(projectDirectory);
    initGitRepo(projectDirectory);
    // Run setup to get the hook infrastructure
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
    // Delete .safeword/rustfmt.toml to test fallback path
    const rustfmtConfig = nodePath.join(projectDirectory, '.safeword/rustfmt.toml');
    if (fileExists(projectDirectory, '.safeword/rustfmt.toml')) {
      unlinkSync(rustfmtConfig);
    }
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it.skipIf(!RUSTFMT_AVAILABLE)('lint hook formats .rs files without safeword config', () => {
    const filePath = nodePath.join(projectDirectory, 'src/fallback-test.rs');
    writeTestFile(projectDirectory, 'src/fallback-test.rs', `fn fallback_test(){println!("test")}`);

    // Run lint hook - should use plain rustfmt (no --config-path)
    runLintHook(projectDirectory, filePath);

    // File should still be formatted (rustfmt works without config)
    const result = readTestFile(projectDirectory, 'src/fallback-test.rs');
    expect(result).toContain('fn fallback_test() {');
  });
});

// Scenario 11: Lint hook gracefully handles edge cases (doesn't crash)
describe('E2E: Rust Lint Hook Graceful Handling', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustProject(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('lint hook completes without crashing on syntax error file', () => {
    // Create a file with invalid Rust syntax
    writeTestFile(projectDirectory, 'src/bad-syntax.rs', `fn broken({{{{ not valid rust`);

    const filePath = nodePath.join(projectDirectory, 'src/bad-syntax.rs');

    // Hook should complete without throwing (uses .nothrow())
    // This verifies graceful degradation - even if rustfmt fails to parse, hook doesn't crash
    expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
  });

  it('lint hook completes without crashing on non-existent file', () => {
    const filePath = nodePath.join(projectDirectory, 'src/does-not-exist.rs');

    // Hook should complete without throwing
    expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
  });
});

// Scenario 8: Add Rust to existing TypeScript project
describe('E2E: Add Rust to Existing TypeScript Project', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    // Create TypeScript-only project first
    writeTestFile(
      projectDirectory,
      'package.json',
      JSON.stringify({
        name: 'ts-only-project',
        version: '0.1.0',
        devDependencies: { typescript: '^5.0.0' },
      }),
    );
    initGitRepo(projectDirectory);
    // Initial setup with TypeScript only
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('starts with only TypeScript pack installed', () => {
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
    expect(fileExists(projectDirectory, 'Cargo.toml')).toBe(false);
    expect(fileExists(projectDirectory, 'clippy.toml')).toBe(false);
  });

  describe('after adding Cargo.toml and running upgrade', () => {
    beforeAll(async () => {
      // Add Rust to the project
      createRustProject(projectDirectory);

      // Run upgrade to detect and install Rust pack
      // Note: upgrade command doesn't have --yes flag
      await runCli(['upgrade'], { cwd: projectDirectory });
    }, 60_000);

    it('installs Rust pack configs', () => {
      expect(fileExists(projectDirectory, 'clippy.toml')).toBe(true);
      expect(fileExists(projectDirectory, 'rustfmt.toml')).toBe(true);
      expect(fileExists(projectDirectory, '.safeword/clippy.toml')).toBe(true);
      expect(fileExists(projectDirectory, '.safeword/rustfmt.toml')).toBe(true);
    });

    it('adds lints to Cargo.toml', () => {
      const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');
      expect(cargoToml).toContain('[lints.clippy]');
      expect(cargoToml).toContain('pedantic');
    });

    it('ESLint config remains intact', () => {
      expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
      expect(fileExists(projectDirectory, '.safeword/eslint.config.mjs')).toBe(true);
    });

    it.skipIf(!RUSTFMT_AVAILABLE)('rustfmt works on Rust files', () => {
      writeTestFile(projectDirectory, 'src/test.rs', `fn test(){println!("test")}`);

      const filePath = nodePath.join(projectDirectory, 'src/test.rs');
      runLintHook(projectDirectory, filePath);

      const result = readTestFile(projectDirectory, 'src/test.rs');
      expect(result).toContain('fn test() {');
    });
  });
});

// Test idempotency: running setup twice should be safe
describe('E2E: Rust Setup Idempotency', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustProject(projectDirectory);
    initGitRepo(projectDirectory);
    // Run setup TWICE
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('does not duplicate [lints.clippy] section', () => {
    const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');
    // Count occurrences of [lints.clippy]
    const lintClippyCount = (cargoToml.match(/\[lints\.clippy\]/g) || []).length;
    expect(lintClippyCount).toBe(1);
  });

  it('does not duplicate [lints.rust] section', () => {
    const cargoToml = readTestFile(projectDirectory, 'Cargo.toml');
    // Count occurrences of [lints.rust]
    const lintRustCount = (cargoToml.match(/\[lints\.rust\]/g) || []).length;
    expect(lintRustCount).toBe(1);
  });

  it('config files remain valid', () => {
    // Configs should still exist and be valid
    expect(fileExists(projectDirectory, 'clippy.toml')).toBe(true);
    expect(fileExists(projectDirectory, 'rustfmt.toml')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/clippy.toml')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/rustfmt.toml')).toBe(true);
  });
});

// Scenario 10: Lint hook uses package targeting in workspaces
describe('E2E: Rust Lint Hook Package Targeting', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createRustWorkspace(projectDirectory, { members: ['core', 'cli'] });
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it.skipIf(!CLIPPY_AVAILABLE)(
    'lint hook runs cargo clippy with -p <package> for workspace member (Scenario 10)',
    () => {
      // Create a file with a clippy-fixable issue: single_char_pattern
      // clippy suggests 'l' (char) instead of "l" (string) for contains()
      // This CANNOT be fixed by rustfmt, only by clippy --fix
      writeTestFile(
        projectDirectory,
        'crates/core/src/lib.rs',
        `pub fn test_function() -> bool {
    let s = "hello";
    s.contains("l")
}
`,
      );

      const filePath = nodePath.join(projectDirectory, 'crates/core/src/lib.rs');
      const result = runLintHook(projectDirectory, filePath);

      // Hook should complete successfully
      expect(result.status).toBe(0);

      // Verify clippy ran and fixed the single_char_pattern issue
      // If clippy ran with --fix, it changes "l" to 'l'
      const fixed = readTestFile(projectDirectory, 'crates/core/src/lib.rs');
      expect(fixed).toContain("s.contains('l')"); // Clippy fix: char instead of &str
    },
  );

  it.skipIf(!CLIPPY_AVAILABLE)(
    'lint hook skips clippy for virtual workspace root files (no package)',
    () => {
      // Create a build.rs at workspace root (no [package] section in root Cargo.toml)
      writeTestFile(
        projectDirectory,
        'build.rs',
        `fn main(){println!("cargo:rerun-if-changed=build.rs");}`,
      );

      const filePath = nodePath.join(projectDirectory, 'build.rs');
      const result = runLintHook(projectDirectory, filePath);

      // Hook should complete without error (rustfmt only, no clippy)
      expect(result.status).toBe(0);

      // File should still be formatted
      const formatted = readTestFile(projectDirectory, 'build.rs');
      expect(formatted).toContain('fn main() {');
    },
  );
});
