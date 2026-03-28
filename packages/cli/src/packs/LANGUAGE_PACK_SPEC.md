# Language Pack Specification

How to add support for a new language in safeword.

## Core Interface

Every language pack implements `LanguagePack` from `types.ts`:

```typescript
interface LanguagePack {
  id: string; // e.g., 'python', 'golang'
  name: string; // e.g., 'Python', 'Go'
  extensions: string[]; // e.g., ['.py', '.pyi'] or ['.go']
  detect(cwd: string): boolean;
  setup(cwd: string, ctx: SetupContext): SetupResult;
}
```

## Linter Philosophy

**Strictness:** Curated strict rules by default. Additive when extending customer config.

| Language   | Strictness Setting                      | Exclusions                                      |
| ---------- | --------------------------------------- | ----------------------------------------------- |
| TypeScript | ESLint: multiple strict plugins         | Minimal (Prettier conflicts)                    |
| Python     | Curated `extend-select` (E,F,W,I,UP,B…) | Formatter conflicts (COM812, ISC001, E501)      |
| Go         | `default: standard` + curated `enable`  | `std-error-handling`, `common-false-positives`  |
| Rust       | `pedantic = "warn"`                     | `missing_errors_doc`, `module_name_repetitions` |

**Design Constraints (Required):** Every language pack MUST enforce:

| Constraint                | ESLint                    | Ruff                       | golangci-lint               | Clippy                              |
| ------------------------- | ------------------------- | -------------------------- | --------------------------- | ----------------------------------- |
| Cyclomatic complexity ≤10 | `complexity: 10`          | `C901` (max-complexity=10) | `cyclop` (default: 10)      | `cognitive-complexity-threshold=10` |
| Max nesting depth ≤4      | `max-depth: 4`            | N/A                        | `nestif` (min-complexity=4) | N/A                                 |
| Max function params ≤5    | `max-params: 5`           | `PLR0913` (default: 5)     | N/A                         | `too-many-arguments-threshold=5`    |
| Max callback nesting ≤3   | `max-nested-callbacks: 3` | N/A                        | N/A                         | N/A                                 |

**Why:** LLMs write dense, complex code. These constraints force decomposition and improve maintainability.

**Rule Categories (Required):** Every language pack SHOULD enable rules for:

| Category       | ESLint                   | Ruff         | golangci-lint | Clippy                 |
| -------------- | ------------------------ | ------------ | ------------- | ---------------------- |
| Security       | `eslint-plugin-security` | `S` (bandit) | `gosec`       | `unsafe_code = "deny"` |
| Import cycles  | `import-x/no-cycle`      | -            | `depguard`    | N/A                    |
| Async/Promise  | `eslint-plugin-promise`  | `ASYNC`      | N/A           | N/A                    |
| Regex safety   | `eslint-plugin-regexp`   | -            | -             | N/A                    |
| Error handling | N/A                      | N/A          | `errcheck`    | `unwrap_used = "warn"` |

**Severity:** Use `error` not `warn`. LLMs ignore warnings—only errors stop code generation.

## Dual Config Architecture

Safeword uses a **two-layer config strategy** to enforce strict rules on LLM-generated code while respecting human preferences:

| Location                | Purpose            | Used By          | Strictness                           |
| ----------------------- | ------------------ | ---------------- | ------------------------------------ |
| `.safeword/{tool}.toml` | LLM enforcement    | Lint hook        | Strict (pedantic, complexity limits) |
| `{tool}.toml` (root)    | Human/IDE defaults | Manual runs, IDE | Sensible defaults or user-customized |

**How it works:**

1. **Setup creates both:** `.safeword/` configs (strict) AND project root configs (sensible defaults)
2. **Lint hook uses `.safeword/`:** `--config-path .safeword/{tool}.toml` enforces strict rules
3. **Humans use root configs:** Manual `cargo clippy`, IDE integration, CI pipelines

**Why this matters:**

- LLM writes code → hook runs → strict rules catch issues ✓
- Human runs linter manually → their preferences apply (not forced into pedantic mode)
- User can customize root config without breaking LLM enforcement

**User config preservation:** When users already have lint config (e.g., `[lints.clippy]` in Cargo.toml), skip entirely rather than merge:

- TOML/YAML merging is complex and error-prone
- Users who configure lints know what they want
- `.safeword/` configs still enforce strict rules via the hook

This separation means **hook enforcement is independent of project-wide config**. Even if a user has lax rules in their project config, the lint hook still applies strict rules to LLM-generated code.

## Pack File Structure

Every language pack has three files in `src/packs/{lang}/`:

```
src/packs/{lang}/
├── index.ts   # LanguagePack interface implementation
├── files.ts   # File definitions (ownedFiles, managedFiles, jsonMerges)
└── setup.ts   # Setup utilities (detection, installation helpers)
```

### files.ts Exports

| Export               | Purpose                                               | Example                 |
| -------------------- | ----------------------------------------------------- | ----------------------- |
| `{lang}OwnedFiles`   | Config files in `.safeword/` (overwritten on upgrade) | `.safeword/ruff.toml`   |
| `{lang}ManagedFiles` | Project root configs (created if missing)             | `ruff.toml`, `mypy.ini` |
| `{lang}JsonMerges`   | Keys merged into existing JSON (optional)             | `package.json` scripts  |
| `{lang}Packages`     | NPM packages to install (TypeScript only)             | `eslint`, `prettier`    |

These exports are spread into `schema.ts`:

```typescript
// schema.ts
ownedFiles: {
  ...typescriptOwnedFiles,
  ...pythonOwnedFiles,
  ...golangOwnedFiles,
},
managedFiles: {
  ...typescriptManagedFiles,
  ...pythonManagedFiles,
  ...golangManagedFiles,
},
```

### Reconciliation System

Files are managed through reconciliation (not direct writes):

| File Type      | Created            | Updated                          | Deleted on Reset |
| -------------- | ------------------ | -------------------------------- | ---------------- |
| `ownedFiles`   | If missing         | Always (if content changed)      | Yes              |
| `managedFiles` | If missing         | Only if content matches template | Yes              |
| `jsonMerges`   | Never (merge only) | Merge specific keys              | Keys removed     |

**Key principle:** Pack `setup()` functions should return `{ files: [] }` and let reconciliation handle file creation.

## Integration Points (Checklist)

### 1. Pack File (`src/packs/{lang}/index.ts`)

```typescript
import { setup{Lang}Tooling } from './setup.js';

export const {lang}Pack: LanguagePack = {
  id: '{lang}',
  name: '{Lang}',
  extensions: ['.ext'],
  detect(cwd) { /* return true if lang manifest exists */ },
  setup(_cwd, _ctx) {
    // Config files created by reconciliation (ownedFiles/managedFiles)
    return setup{Lang}Tooling();
  },
};
```

**Detection heuristic:** Check for the language's manifest file:

- Python → `pyproject.toml` OR `requirements.txt`
- TypeScript/JS → `package.json`
- Go → `go.mod`
- Rust → `Cargo.toml`
- Java → `pom.xml` or `build.gradle`

### 2. Files Definition (`src/packs/{lang}/files.ts`)

```typescript
import type { FileDefinition, ManagedFileDefinition } from '../../schema.js';

// Config generator (private, used by exports below)
function generateProjectConfig(): string {
  return `# Generated by safeword\n...`;
}

// Owned files (.safeword/ - overwritten on upgrade)
export const {lang}OwnedFiles: Record<string, FileDefinition> = {
  '.safeword/{tool}.config': {
    generator: ctx => ctx.languages?.{lang} ? generateSafewordConfig() : null,
  },
};

// Managed files (project root - created if missing)
export const {lang}ManagedFiles: Record<string, ManagedFileDefinition> = {
  '{tool}.config': {
    generator: ctx => {
      if (!ctx.languages?.{lang}) return null;
      if (ctx.projectType.existing{Tool}Config) return null;
      return generateProjectConfig();
    },
  },
};
```

### 3. Registry (`src/packs/registry.ts`)

```typescript
import { {lang}Pack } from './{lang}/index.js';

export const LANGUAGE_PACKS: Record<string, LanguagePack> = {
  // ...existing
  {lang}: {lang}Pack,
};
```

### 4. Lint Hook (`templates/hooks/lib/lint.ts`)

Add extension set and linting logic:

```typescript
// Note: extensions WITHOUT leading dot (different from LanguagePack.extensions)
const {LANG}_EXTENSIONS = new Set(['{ext}', '{ext2}']);

// In lintFile():
if ({LANG}_EXTENSIONS.has(extension)) {
  await $`{linter} --fix ${file}`.nothrow().quiet();
  await $`{formatter} ${file}`.nothrow().quiet();
  return;
}
```

**Pattern:** `linter --fix` then `formatter`. Use `.nothrow().quiet()` to skip gracefully if tools not installed.

**Graceful degradation:** The hook must NEVER crash, even on:

- Syntax errors in source files (linter/formatter can't parse)
- Non-existent files passed to the hook
- Missing tools (not installed)

All tool invocations use `.nothrow()` to ensure the hook completes regardless of tool exit codes.

**Error output:** For tools that should show errors (ESLint, shellcheck), print stderr on failure:

```typescript
const result = await $`bunx eslint --fix ${file}`.nothrow().quiet();
if (result.exitCode !== 0 && result.stderr.length > 0) {
  console.log(result.stderr.toString());
}
```

**Shell scripts:** Handled as a special case (not a full language pack):

```typescript
const SHELL_EXTENSIONS = new Set(['sh']);

if (SHELL_EXTENSIONS.has(extension)) {
  await $`bunx shellcheck ${file}`.nothrow().quiet();
  if (existsSync(`${projectDir}/node_modules/prettier-plugin-sh`)) {
    await $`bunx prettier --write ${file}`.nothrow().quiet();
  }
}
```

**Tool Granularity:** Not all tools support file-level targeting. Design accordingly:

| Tool          | Granularity | Lint Hook Strategy                                                  |
| ------------- | ----------- | ------------------------------------------------------------------- |
| ESLint        | File        | `eslint --fix ${file}`                                              |
| Ruff          | File        | `ruff check --fix ${file}`                                          |
| rustfmt       | File        | `rustfmt ${file}`                                                   |
| Clippy        | Package     | Format only in hook; clippy at package level (deferred or separate) |
| golangci-lint | Directory   | `golangci-lint run --fix ${file}` (works but runs on directory)     |

If a linter can't target files, the lint hook should run only the formatter. Package-level linting can be:

1. Deferred to manual `cargo clippy --fix` / `golangci-lint run --fix`
2. Run on the whole project (expensive for large monorepos)
3. Triggered separately via pre-commit hooks

### 5. Project Detector (`src/utils/project-detector.ts`)

Add language to detection:

```typescript
// Add to GO_MOD constant area
const {LANG}_MANIFEST = '{manifest}';

// Update Languages interface
export interface Languages {
  javascript: boolean;
  python: boolean;
  golang: boolean;
  {lang}: boolean;  // Add new language
}

// Update detectLanguages()
export function detectLanguages(cwd: string): Languages {
  // ...existing...
  const has{Lang}Manifest = existsSync(nodePath.join(cwd, {LANG}_MANIFEST));

  return {
    // ...existing...
    {lang}: has{Lang}Manifest,
  };
}
```

### 6. Setup Command (`src/commands/setup.ts`)

Integrate language setup into the main flow:

```typescript
// In setup():
// 1. Update isNonJsOnly check
const isNonJsOnly = (languages.python || languages.golang || languages.{lang}) && !languages.javascript;

// 2. Add detection message
if (languages.{lang} && !languages.javascript) info('{Lang} project detected (skipping JS tooling)');

// 3. Config files are created by reconcile() via ownedFiles/managedFiles
// No need to call pack setup directly - reconciliation handles everything

// 4. Track installed packs
const detectedPacks = detectLanguagePacks(cwd);
for (const packId of detectedPacks) {
  addInstalledPack(cwd, packId);
}
```

**Note:** Config file creation is handled by `reconcile()` using the pack's `ownedFiles` and `managedFiles`.
The setup command just needs to detect the language and register the pack.

### 7. Test Helpers (`tests/helpers.ts`)

```typescript
// Tool availability check
export function is{Tool}Installed(): boolean {
  return isCommandAvailable('{tool}');
}

// Project scaffolding
export function create{Lang}Project(dir: string, options?: {...}): void {
  writeTestFile(dir, '{manifest}', '...');
  // Include minimal valid source file if needed
  writeTestFile(dir, 'main.{ext}', '...');
}

// Linter execution (for TypeScript/ESLint)
export function runEslint(dir: string, file: string, extraArgs: string[] = []): SpawnSyncReturns<string> {
  return spawnSync('bunx', ['eslint', file, ...extraArgs], { cwd: dir, encoding: 'utf8' });
}
```

### 8. Golden Path Test (`tests/integration/{lang}-golden-path.test.ts`)

```typescript
const TOOL_AVAILABLE = is{Tool}Installed();

describe('E2E: {Lang} Golden Path', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    create{Lang}Project(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup'], { cwd: projectDirectory, timeout: TIMEOUT_SETUP });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) removeTemporaryDirectory(projectDirectory);
  });

  // Always runs - config generation
  it('creates {tool} config', () => {
    // Verify tool config exists (format varies by language)
    // Python: expect(config).toContain('[tool.ruff]')
    // Go: gofmt needs no config, just verify setup completes
  });

  // Skipped if tool not installed
  it.skipIf(!TOOL_AVAILABLE)('{tool} config is valid and runs', () => {...});
  it.skipIf(!TOOL_AVAILABLE)('{tool} detects violations', () => {...});
  it.skipIf(!TOOL_AVAILABLE)('{tool} formats files', () => {...});
  it.skipIf(!TOOL_AVAILABLE)('post-tool-lint hook processes {lang} files', () => {...});
});

// Idempotency test - setup twice should be safe
describe('E2E: {Lang} Setup Idempotency', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    create{Lang}Project(projectDirectory);
    initGitRepo(projectDirectory);
    // Run setup TWICE
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => removeTemporaryDirectory(projectDirectory));

  it('does not duplicate config sections', () => {
    const manifest = readTestFile(projectDirectory, '{manifest}');
    const sectionCount = (manifest.match(/\[{config-section}\]/g) || []).length;
    expect(sectionCount).toBe(1);
  });
});

// Graceful hook degradation tests - add to golden path suite or create separate suite
describe('E2E: {Lang} Lint Hook Graceful Handling', () => {
  // ... standard beforeAll/afterAll with project setup ...

  it('hook completes without crashing on syntax error file', () => {
    writeTestFile(projectDirectory, 'src/bad.{ext}', 'invalid {lang} syntax {{{{');
    const filePath = nodePath.join(projectDirectory, 'src/bad.{ext}');
    expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
  });

  it('hook completes without crashing on non-existent file', () => {
    const filePath = nodePath.join(projectDirectory, 'src/missing.{ext}');
    expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
  });
});

// Fallback test - hook works even without .safeword/ config
describe('E2E: {Lang} Lint Hook Fallback', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    create{Lang}Project(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
    // Delete .safeword config AFTER setup to test fallback path
    unlinkSync(nodePath.join(projectDirectory, '.safeword/{tool}.config'));
  }, 180_000);

  afterAll(() => removeTemporaryDirectory(projectDirectory));

  it.skipIf(!TOOL_AVAILABLE)('formats files without safeword config', () => {
    writeTestFile(projectDirectory, 'src/test.{ext}', 'unformatted code');
    const filePath = nodePath.join(projectDirectory, 'src/test.{ext}');
    runLintHook(projectDirectory, filePath);

    // File should still be formatted (tool uses defaults)
    const result = readTestFile(projectDirectory, 'src/test.{ext}');
    expect(result).toContain('formatted output');
  });
});
```

**Tip: Match Skip Conditions to What You're Testing**

Use the correct availability check for the tool being tested:

```typescript
// ❌ Wrong: skips on clippy but test only uses rustfmt
it.skipIf(!CLIPPY_AVAILABLE)('rustfmt formats files', () => {
  spawnSync('rustfmt', [file]); // Only uses rustfmt!
});

// ✅ Correct: skip condition matches the tool being tested
it.skipIf(!RUSTFMT_AVAILABLE)('rustfmt formats files', () => {
  spawnSync('rustfmt', [file]);
});
```

This matters when tools can be installed independently. Create separate `is{Tool}Installed()` helpers for each tool (linter vs formatter).

**Tip: Violation Tests Must Use Actual Caught Violations**

Test code must trigger linters that are actually enabled. Research what your linter catches:

```typescript
// ❌ Go: unused functions in `package main` are NOT caught (golangci-lint)
writeTestFile(
  dir,
  'bad.go',
  `package main
func unused() {} // NOT detected!
`,
);

// ✅ Go: unused imports ARE caught by 'unused' linter
writeTestFile(
  dir,
  'bad.go',
  `package main
import "fmt" // unused import - DETECTED
func bad() { println("not using fmt") }
`,
);
```

Research the default linter set before writing violation tests.

### 9. Tooling Validation Test (`tests/integration/tooling-validation.test.ts`)

Add a suite if the language has type checking or framework-specific rules:

```typescript
describe('E2E: {Tool} Type Error Detection', () => {
  it.skipIf(!TOOL_AVAILABLE)('{tool} catches type errors', () => {...});
});
```

## Package Manager Detection (Optional)

Only needed if the language has multiple package managers (Python: pip/poetry/uv/pipenv). Skip for languages with one PM (Go: `go mod`).

```typescript
export function detect{Lang}PackageManager(cwd: string): '{pm1}' | '{pm2}' | '{pm3}' {
  // Check lockfiles first (most reliable)
  if (exists(join(cwd, '{pm1}.lock'))) return '{pm1}';
  if (exists(join(cwd, '{pm2}.lock'))) return '{pm2}';
  // Check manifest markers
  if (manifestContains('[tool.{pm1}]')) return '{pm1}';
  // Default
  return '{pm3}';
}

export function get{Lang}InstallCommand(cwd: string, tools: string[]): string {
  const pm = detect{Lang}PackageManager(cwd);
  switch (pm) {
    case '{pm1}': return `{pm1} add --dev ${tools.join(' ')}`;
    // ...
  }
}
```

## Dependency Installation (Optional)

Languages with package managers should auto-install tooling dependencies during setup:

```typescript
export function install{Lang}Dependencies(cwd: string, tools: string[]): boolean {
  const pm = detect{Lang}PackageManager(cwd);

  // Skip if package manager doesn't support dev dependencies well (e.g., pip with PEP 668)
  if (pm === 'pip') return false;

  try {
    execSync(get{Lang}InstallCommand(cwd, tools), { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
```

| Language   | Auto-Install        | Reason                                    |
| ---------- | ------------------- | ----------------------------------------- |
| TypeScript | ✓ via npm/yarn/pnpm | Standard dev dependency workflow          |
| Python     | ✓ via uv/poetry     | pip skipped (PEP 668 externally-managed)  |
| Go         | ✗                   | Tools installed globally via `go install` |

## Type Checking Config (Optional)

Languages with separate type checkers should configure them during setup:

| Language   | Type Checker | Config Location              |
| ---------- | ------------ | ---------------------------- |
| TypeScript | tsc          | `tsconfig.json` (managed)    |
| Python     | mypy         | `mypy.ini` (standalone file) |
| Go         | N/A          | Built into compiler          |

Config generators go in `files.ts` and are used by `managedFiles`:

```typescript
// files.ts - Python mypy config generator
function generateProjectMypyConfig(): string {
  return `# Generated by safeword
[mypy]
ignore_missing_imports = True
show_error_codes = True
pretty = True
`;
}

export const pythonManagedFiles = {
  'mypy.ini': {
    generator: ctx => {
      if (!ctx.languages?.python) return null;
      if (ctx.projectType.existingMypyConfig) return null; // Skip if user has config
      return generateProjectMypyConfig();
    },
  },
};
```

## Existing Tooling Detection (Optional)

For languages with established ecosystems, detect if the project already has linting/formatting configured:

```typescript
// In project-detector.ts or {lang}-setup.ts
export function hasExisting{Lang}Linter(cwd: string): boolean {
  // Check for config files, scripts, or dependencies
}
```

| Language   | Linter Detection                   | Formatter Detection                     |
| ---------- | ---------------------------------- | --------------------------------------- |
| TypeScript | ESLint config files, `lint` script | Prettier/Biome configs, `format` script |
| Python     | `[tool.ruff]` section              | Ruff format, Black configs              |
| Go         | N/A (go vet is built-in)           | N/A (gofmt is built-in)                 |

**Usage:** Skip auto-configuration if tooling already exists to avoid conflicts.

## Setup File Pattern (`src/packs/{lang}/setup.ts`)

Setup files contain detection and installation utilities. Config generators go in `files.ts`.

```typescript
// Detection functions
export function detect{Lang}Layers(cwd: string): string[] { /* architecture detection */ }
export function has{Tool}Dependency(cwd: string): boolean { /* check if tool already declared */ }
export function detect{Lang}PackageManager(cwd: string): 'uv' | 'poetry' | 'pip' { /* PM detection */ }

// Installation helpers (for auto-installing dev dependencies)
export function install{Lang}Dependencies(cwd: string, tools: string[]): boolean { /* install tools */ }

// Main setup - called by pack's setup()
export function setup{Lang}Tooling(): SetupResult {
  // Config files are created by reconciliation (ownedFiles/managedFiles in files.ts)
  // This function exists for:
  // 1. Future language-specific setup logic
  // 2. Consistency with other packs
  return { files: [] };
}
```

**Note:** Config generators (`generate{Tool}Config()`) should be in `files.ts`, not `setup.ts`.
The setup function should NOT write files directly—reconciliation handles that.

## Workspace/Monorepo Handling (When Applicable)

Languages with native workspace support require special handling:

| Language   | Workspace Mechanism         | Root Marker           | Member Discovery             |
| ---------- | --------------------------- | --------------------- | ---------------------------- |
| Rust       | `[workspace]` in Cargo.toml | `[workspace]` section | `members = ["crates/*"]`     |
| Go         | `go.work` file              | `go.work` exists      | `use ./module1` directives   |
| TypeScript | package.json workspaces     | `workspaces` field    | `workspaces: ["packages/*"]` |

### Workspace Detection

```typescript
// In setup.ts
export function detectWorkspaceType(
  manifestContent: string,
): 'virtual' | 'root-package' | 'single' {
  // virtual = workspace without root package (Rust: [workspace] but no [package])
  // root-package = workspace WITH root package (Rust: both [workspace] and [package])
  // single = no workspace
}
```

**Detection Edge Cases:** Document false positives. Example:

- `[workspace.dependencies]` contains "workspace" but is NOT a workspace marker
- Use section header matching (`[workspace]`) not substring matching

### Config Propagation

Workspaces often need config in TWO places:

1. **Root config** - defines the rules (`[workspace.lints.clippy]`)
2. **Member inheritance** - tells members to use root rules (`lints.workspace = true`)

```typescript
// Rust example: setup.ts
function addRootLints(cargoPath: string, content: string, isWorkspace: boolean): void {
  const lintsToAdd = isWorkspace ? WORKSPACE_LINTS : SINGLE_CRATE_LINTS;
  // Append to manifest
}

function addMemberLints(cwd: string, content: string): void {
  const members = parseWorkspaceMembers(content);
  for (const member of members) {
    // Add inheritance directive to each member
  }
}
```

### Member Parsing Limitations

Glob patterns (`members = ["crates/*"]`) require filesystem expansion. Simple regex extraction only works for explicit paths:

```typescript
// Works: members = ["crates/core", "crates/cli"]
// Fails: members = ["crates/*"]  ← requires glob expansion
```

Document this limitation or implement glob expansion.

### User Config Preservation

When modifying existing manifests (not creating new files):

- **Check before modifying** - skip if user already has the section
- **Append, don't replace** - add new sections at end of file
- **User wins** - never overwrite user's explicit settings

```typescript
function hasExistingLints(content: string): boolean {
  return content.includes('[lints.clippy]') || content.includes('[lints]');
}

// In setup:
if (hasExistingLints(content)) return; // User config preserved
```

## Config File Merging (Non-JSON)

The reconciliation system handles JSON merges via `jsonMerges`. For non-JSON formats (TOML, YAML, INI), use the setup function:

| Format | Merge Strategy              | Example              |
| ------ | --------------------------- | -------------------- |
| JSON   | `jsonMerges` in schema.ts   | package.json scripts |
| TOML   | Append sections in setup.ts | Cargo.toml `[lints]` |
| YAML   | Not yet supported           | -                    |

```typescript
// TOML section append pattern (Rust Cargo.toml)
export function setupRustTooling(cwd: string): SetupResult {
  const cargoPath = join(cwd, 'Cargo.toml');
  const content = readFileSync(cargoPath, 'utf8');

  if (!hasExistingLints(content)) {
    const lintsSection = `[lints.clippy]\npedantic = "warn"\n`;
    writeFileSync(cargoPath, `${content.trimEnd()}\n\n${lintsSection}`);
  }

  return { files: [] }; // Let reconciliation handle other files
}
```

**Key difference from managed files:** Merging modifies an existing user file, while managed files create new files if missing.

## Tool Version Compatibility

Some tools have unstable/nightly-only options that **fail silently** on stable versions:

| Tool    | Gotcha                                  | Recommendation                              |
| ------- | --------------------------------------- | ------------------------------------------- |
| rustfmt | Unstable options ignored on stable Rust | Use only stable options                     |
| ESLint  | Flat config (v9+) vs legacy config      | Detect version, generate appropriate format |
| Ruff    | Rapid iteration, options renamed        | Pin to known-good version in docs           |

**Research before implementation:** Test your config with the stable/default tool version, not just nightly.

## Architecture Validation (Optional)

If the language ecosystem has import/layer enforcement tools:

| Language   | Tool              | Config Location                   |
| ---------- | ----------------- | --------------------------------- |
| Python     | import-linter     | `.importlinter` (standalone file) |
| TypeScript | eslint-boundaries | `eslint.config.mjs`               |
| Go         | depguard          | `.golangci.yml`                   |

Pattern: Detect layer directories (domain, services, api, etc.), generate contracts if 2+ layers found.

```typescript
// files.ts - Python import-linter config
export const pythonManagedFiles = {
  '.importlinter': {
    generator: ctx => {
      if (!ctx.languages?.python) return null;
      if (ctx.projectType.existingImportLinterConfig) return null;
      const layers = detectPythonLayers(ctx.cwd);
      if (layers.length < 2) return null; // Need 2+ layers for contracts
      return generateImportLinterConfig(layers);
    },
  },
};
```

## Framework Detection (Optional)

Languages with frameworks may need framework-specific configs:

```typescript
// In utils/{lang}-setup.ts or detect.ts
export function detect{Lang}Framework(cwd: string): 'django' | 'flask' | 'fastapi' | null {
  const deps = readManifestDependencies(cwd);
  if (deps.includes('django')) return 'django';
  // ...
}
```

TypeScript does this at **lint time** via `safeword.detect()` in eslint.config.mjs. Python does it at **setup time**.

## Additional Test Files

Beyond golden-path and tooling-validation, add:

**File Naming Convention:** Create language-specific test files rather than adding to existing generic files:

- `mixed-project-{lang}.test.ts` (not adding to `mixed-project.test.ts`)
- `add-language-{lang}.test.ts` (not adding to `add-language.test.ts`)
- `setup-{lang}.test.ts` (not adding to `setup.test.ts`)

This keeps test files focused and makes it easy to run language-specific tests.

### Unit Tests (`tests/utils/{lang}-setup.test.ts`)

```typescript
describe('Package Manager Detection', () => {
  it('detects {pm} from lockfile', () => {...});
  it('defaults to {default-pm}', () => {...});
});

describe('{Tool} Dependency Detection', () => {
  it('returns false when manifest missing', () => {...});
  it('detects {tool} in dependencies array', () => {...});
  it('does NOT match config section', () => {...}); // Avoid false positives
});
```

### Conditional Setup Tests (`tests/commands/setup-{lang}.test.ts`)

```typescript
describe('Conditional Setup for {Lang} Projects', () => {
  it('skips JS tooling for {lang}-only projects', () => {...});
  it('does NOT create package.json for pure {lang}', () => {...});
  it('shows {lang}-appropriate next steps', () => {...});
  it('still creates .safeword directory', () => {...});
  it('installs both toolchains for polyglot projects', () => {...});
});
```

### Mixed Project Test (`tests/integration/mixed-project.test.ts`)

Verify polyglot projects work correctly:

```typescript
describe('E2E: Mixed Project (TypeScript + {Lang})', () => {
  it('detects and installs both language packs', () => {...});
  it('ESLint runs on TypeScript files', () => {...});
  it('{tool} config added to {manifest}', () => {...});
  it('lint hook routes .ts to ESLint', () => {...});
  it.skipIf(!TOOL_AVAILABLE)('lint hook routes .{ext} to {tool}', () => {...});
});
```

### Add Language Test (`tests/integration/add-language.test.ts`)

Verify upgrade path when adding a language to existing project:

```typescript
describe('E2E: Add {Lang} to Existing Project', () => {
  beforeAll(/* setup with TypeScript only */);

  it('starts with only TypeScript pack installed', () => {...});

  describe('after adding {manifest} and running upgrade', () => {
    beforeAll(/* add {manifest}, run upgrade */);

    it('installs {lang} pack', () => {...});
    it('adds {tool} config', () => {...});
    it.skipIf(!TOOL_AVAILABLE)('{tool} works on {lang} files', () => {...});
    it('ESLint still works on TypeScript files', () => {...});
  });
});
```

## Parity Checklist

Before shipping a new language pack, verify:

**Core Integration:**

- [ ] `detect()` returns true for lang-only projects
- [ ] `setup()` creates valid tool config
- [ ] Hook lints files with correct extension
- [ ] Hook skips gracefully if tools not installed
- [ ] Hook handles edge cases without crashing (syntax errors, missing files)

**Testing (10 test areas):**

- [ ] Golden path: config created, tool runs, violations detected, formatting works, hook works
- [ ] Tooling validation: type checker catches errors (if applicable)
- [ ] Unit tests: detection functions, workspace detection, config parsing
- [ ] Conditional setup: pure {lang} skips irrelevant tooling
- [ ] Mixed project: both languages work together, hook routes correctly
- [ ] Add language: upgrade path installs pack when manifest added
- [ ] Workspace setup: root config + member inheritance (if applicable)
- [ ] Config preservation: existing user config not overwritten
- [ ] Idempotency: running setup twice doesn't duplicate config sections
- [ ] Fallback: hook works when .safeword/ config is missing

**Test Helpers:**

- [ ] `is{Tool}Installed()` for each tool separately (e.g., `isClippyInstalled()` AND `isRustfmtInstalled()`)
- [ ] `create{Lang}Project(dir, options?)` with package manager variants
- [ ] `run{Linter}(dir, file)` for linter execution (if applicable)

**Project Types:**

- [ ] Pure {lang} project (no package.json) works end-to-end
- [ ] Mixed project (JS + {lang}) works correctly
- [ ] Existing tool configs are preserved (not clobbered)
- [ ] Workspace/monorepo projects (if language supports workspaces)
- [ ] Virtual workspace (no root package, if applicable)

**Optional Integrations:**

- [ ] Package manager detection (if language has multiple)
- [ ] Auto-install dependencies (if package manager supports dev deps)
- [ ] Type checking config (if separate type checker exists)
- [ ] Existing tooling detection (if ecosystem has established tools)
- [ ] Architecture/layer detection (if import enforcement tools exist)

**Research Before Implementation:**

- [ ] Verify linter default preset (what's enabled out-of-the-box)
- [ ] Test violation detection manually (don't assume what gets caught)
- [ ] Check config format version (e.g., golangci-lint v1 vs v2 syntax)
- [ ] Confirm formatter integration (separate tool or linter flag?)
- [ ] Test config with stable toolchain (not just nightly/beta)
- [ ] Document lint hook granularity (file vs package vs directory targeting)
- [ ] Identify workspace/monorepo patterns (if applicable)
