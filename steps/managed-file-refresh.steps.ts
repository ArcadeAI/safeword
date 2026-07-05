/**
 * Steps for features/managed-file-refresh.feature (ticket A4HG61, #849).
 * Black-box: build a temp project, drive the real safeword CLI
 * (setup/upgrade/diff/reset), and inspect the provenance manifest at
 * .safeword/managed-files.json plus the managed files it governs.
 */

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');
const MANIFEST_RELATIVE_PATH = '.safeword/managed-files.json';

/** Managed files setup always writes into an empty project (BDD lane + codex config). */
const REPRESENTATIVE_MANAGED_FILES = [
  'features/safeword-lane.feature',
  'steps/world.ts',
  'steps/shared.steps.ts',
  '.codex/config.toml',
];

/** A stable static managed file to exercise refresh mechanics against. */
const TARGET_MANAGED_FILE = 'features/safeword-lane.feature';

/** Placeholder bytes standing in for an older safeword revision's output. */
const OLD_REVISION_CONTENT = '# an older safeword revision wrote this\n';

/** Placeholder bytes standing in for a customer's hand edit. */
const CUSTOMER_EDIT_CONTENT = '# the customer edited this file\n';

/** The ctx-generated managed config exercised by the SM1.R1/adoption scenarios. */
const GENERATED_MANAGED_FILE = 'eslint.config.mjs';

interface RefreshWorld extends SafewordWorld {
  projectDirectory?: string;
  /** The managed file a scenario exercises (static lane file by default). */
  targetFile?: string;
  /** The currently resolved content for the target file, captured post-setup. */
  currentResolved?: string;
  /** Bytes the scenario expects upgrade to leave untouched. */
  frozenBytes?: string;
  /** Manifest entries captured before the When, for preservation asserts. */
  manifestBefore?: Record<string, string>;
  /** Target file mtime captured before the When, for not-rewritten asserts. */
  mtimeBefore?: number;
  /** Target bytes captured just before upgrade runs (for changed-content asserts). */
  preUpgradeBytes?: string;
  /** When true, "resolves different content" uses the real generator lever (formatter config). */
  generatorLever?: boolean;
}

function projectDir(world: RefreshWorld): string {
  world.projectDirectory ??= mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'managed-refresh-'));
  return world.projectDirectory;
}

/** Drive the real CLI hermetically; record the result on the world. */
function runSafeword(world: RefreshWorld, args: string[]): void {
  const result = spawnSync('bun', [CLI_PATH, ...args], {
    cwd: projectDir(world),
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1',
      SAFEWORD_SKIP_INSTALL: '1',
    },
  });
  world.result = {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function readManifest(world: RefreshWorld): { files: Record<string, string> } {
  const manifestPath = nodePath.join(projectDir(world), MANIFEST_RELATIVE_PATH);
  assert.ok(existsSync(manifestPath), `expected provenance manifest at ${MANIFEST_RELATIVE_PATH}`);
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as { files: Record<string, string> };
}

After(function (this: RefreshWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

function targetFile(world: RefreshWorld): string {
  return world.targetFile ?? TARGET_MANAGED_FILE;
}

function targetPath(world: RefreshWorld): string {
  return nodePath.join(projectDir(world), targetFile(world));
}

function writeManifestFiles(world: RefreshWorld, files: Record<string, string>): void {
  writeFileSync(
    nodePath.join(projectDir(world), MANIFEST_RELATIVE_PATH),
    `${JSON.stringify({ version: 1, files }, undefined, 2)}\n`,
  );
}

function captureTargetMtime(world: RefreshWorld): void {
  world.mtimeBefore = statSync(targetPath(world)).mtimeMs;
}

/** Run setup and capture the target file's resolved content + manifest state. */
function installProject(world: RefreshWorld): void {
  runSafeword(world, ['setup', '--yes']);
  assert.equal(world.result.exitCode, 0, `setup failed:\n${world.result.stderr}`);
  world.currentResolved = readFileSync(targetPath(world), 'utf8');
}

/** A project whose language detection makes the eslint.config.mjs generator fire. */
function installJavascriptProject(world: RefreshWorld): void {
  world.targetFile = GENERATED_MANAGED_FILE;
  writeFileSync(
    nodePath.join(projectDir(world), 'package.json'),
    JSON.stringify({ name: 'host', version: '1.0.0', devDependencies: { typescript: '^5.0.0' } }),
  );
  installProject(world);
}

/** Overwrite the target file AND its record consistently — the state an older install left behind. */
function simulateOlderInstall(world: RefreshWorld): void {
  writeFileSync(targetPath(world), OLD_REVISION_CONTENT);
  world.frozenBytes = OLD_REVISION_CONTENT;
  const manifest = readManifest(world);
  manifest.files[targetFile(world)] = sha256(OLD_REVISION_CONTENT);
  writeManifestFiles(world, manifest.files);
}

Given('a fresh project with no safeword install', function (this: RefreshWorld) {
  projectDir(this);
});

Given(
  'a clone of an installed project with a committed provenance manifest',
  function (this: RefreshWorld) {
    installProject(this);
    this.manifestBefore = readManifest(this).files;
  },
);

Given(
  'an installed project whose managed file matches its recorded provenance',
  function (this: RefreshWorld) {
    installProject(this);
    const recorded = readManifest(this).files[targetFile(this)];
    assert.equal(recorded, sha256(this.currentResolved ?? ''), 'setup left a mismatched record');
  },
);

Given('safeword now resolves different content for that file', function (this: RefreshWorld) {
  // Three honest levers, per scenario state:
  // - generated config: a real context mutation (add a formatter config) so
  //   the generator output genuinely changes — never a manifest edit, which
  //   would fake the adoption the scenario proved (review finding MF4);
  // - untouched static file: construct the state an older install left
  //   behind — old bytes with a matching record — so the CURRENT template
  //   genuinely differs (pristine + stale);
  // - already-diverged file (edited scenarios): the divergence this step
  //   asserts already holds — nothing to construct.
  if (this.generatorLever) {
    writeFileSync(nodePath.join(projectDir(this), 'biome.json'), '{}\n');
    return;
  }
  const onDisk = readFileSync(targetPath(this), 'utf8');
  if (onDisk === this.currentResolved) simulateOlderInstall(this);
});

Given('an installed project whose managed file was deleted', function (this: RefreshWorld) {
  installProject(this);
  rmSync(targetPath(this));
});

Given(
  'an installed project with a managed-path file that has no provenance entry',
  function (this: RefreshWorld) {
    installProject(this);
    const manifest = readManifest(this);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- constructing the unrecorded state
    delete manifest.files[targetFile(this)];
    writeManifestFiles(this, manifest.files);
  },
);

Given(
  "that file's content differs from the currently resolved output",
  function (this: RefreshWorld) {
    this.frozenBytes = CUSTOMER_EDIT_CONTENT;
    writeFileSync(targetPath(this), CUSTOMER_EDIT_CONTENT);
  },
);

When('safeword upgrade runs', function (this: RefreshWorld) {
  if (existsSync(targetPath(this))) {
    this.preUpgradeBytes = readFileSync(targetPath(this), 'utf8');
  }
  runSafeword(this, ['upgrade']);
});

Then('the upgrade succeeds', function (this: RefreshWorld) {
  assert.equal(this.result.exitCode, 0, `upgrade failed:\n${this.result.stderr}`);
});

Then(
  'the manifest still records every previously recorded managed file',
  function (this: RefreshWorld) {
    const after = readManifest(this).files;
    for (const [path, hash] of Object.entries(this.manifestBefore ?? {})) {
      assert.equal(after[path], hash, `provenance for ${path} was lost or changed by setup`);
    }
  },
);

Then('the file contains the newly resolved content', function (this: RefreshWorld) {
  const onDisk = readFileSync(targetPath(this), 'utf8');
  if (this.generatorLever) {
    // The generator's new output isn't reconstructible in-test; refresh is
    // proven by changed bytes whose hash the manifest now records.
    assert.notEqual(onDisk, this.preUpgradeBytes, 'generated config was not refreshed');
    assert.equal(readManifest(this).files[targetFile(this)], sha256(onDisk));
    return;
  }
  assert.equal(onDisk, this.currentResolved, 'file was not refreshed to current resolved content');
});

Then('the manifest records the new content for that file', function (this: RefreshWorld) {
  const onDisk = readFileSync(targetPath(this), 'utf8');
  assert.equal(
    readManifest(this).files[targetFile(this)],
    sha256(onDisk),
    'manifest was not updated to the refreshed content',
  );
});

Then('the file exists with currently resolved content', function (this: RefreshWorld) {
  assert.ok(existsSync(targetPath(this)), 'deleted managed file was not recreated');
  assert.equal(readFileSync(targetPath(this), 'utf8'), this.currentResolved);
});

Then("the file's bytes are unchanged", function (this: RefreshWorld) {
  const onDisk = readFileSync(targetPath(this), 'utf8');
  assert.equal(onDisk, this.frozenBytes, 'a file safeword cannot prove pristine was rewritten');
});

When('safeword setup runs', function (this: RefreshWorld) {
  runSafeword(this, ['setup', '--yes']);
  assert.equal(this.result.exitCode, 0, `setup failed:\n${this.result.stderr}`);
});

Then(
  'the provenance manifest records every managed file setup wrote',
  function (this: RefreshWorld) {
    const manifest = readManifest(this);
    for (const relativePath of REPRESENTATIVE_MANAGED_FILES) {
      assert.ok(
        manifest.files[relativePath] !== undefined,
        `manifest is missing an entry for ${relativePath}`,
      );
    }
  },
);

Then("each recorded hash matches that file's on-disk content", function (this: RefreshWorld) {
  const manifest = readManifest(this);
  for (const [relativePath, recordedHash] of Object.entries(manifest.files)) {
    const absolutePath = nodePath.join(projectDir(this), relativePath);
    assert.ok(existsSync(absolutePath), `recorded file ${relativePath} is missing on disk`);
    assert.equal(
      recordedHash,
      sha256(readFileSync(absolutePath, 'utf8')),
      `recorded hash for ${relativePath} does not match on-disk content`,
    );
  }
});

// --- TB1.R2: reporting ---

Then('the upgrade output reports that file as updated', function (this: RefreshWorld) {
  assert.ok(
    this.result.stdout.includes(targetFile(this)),
    `upgrade output does not mention ${targetFile(this)}:\n${this.result.stdout}`,
  );
});

When('safeword diff runs', function (this: RefreshWorld) {
  runSafeword(this, ['diff']);
  assert.equal(this.result.exitCode, 0, `diff failed:\n${this.result.stderr}`);
});

Then('the diff output reports that file as pending update', function (this: RefreshWorld) {
  assert.ok(
    this.result.stdout.includes(targetFile(this)),
    `diff output does not mention ${targetFile(this)}:\n${this.result.stdout}`,
  );
});

// --- TB1.R3: no churn ---

Given('safeword resolves identical content for that file', function (this: RefreshWorld) {
  // Post-setup state: on-disk === resolved output already. Capture mtime so
  // the Then can prove no write happened.
  captureTargetMtime(this);
});

Then('the upgrade output does not report that file', function (this: RefreshWorld) {
  assert.ok(
    !this.result.stdout.includes(targetFile(this)),
    `upgrade output unexpectedly mentions ${targetFile(this)}`,
  );
});

Then('the file is not rewritten', function (this: RefreshWorld) {
  assert.equal(
    statSync(targetPath(this)).mtimeMs,
    this.mtimeBefore,
    'file was rewritten (mtime changed)',
  );
});

// --- TB2.R1 / TB2.R2: customer edits win ---

Given(
  'an installed project whose managed file was edited after install',
  function (this: RefreshWorld) {
    installProject(this);
    // The install being upgraded is an older one: old bytes + matching record,
    // then the customer's edit on top (record still points at the old write).
    simulateOlderInstall(this);
    writeFileSync(targetPath(this), CUSTOMER_EDIT_CONTENT);
    this.frozenBytes = CUSTOMER_EDIT_CONTENT;
  },
);

Then("the file's bytes are exactly as the customer left them", function (this: RefreshWorld) {
  assert.equal(
    readFileSync(targetPath(this), 'utf8'),
    this.frozenBytes,
    'upgrade rewrote a customer-edited managed file',
  );
});

Then('the upgrade output does not report that file as updated', function (this: RefreshWorld) {
  assert.ok(
    !this.result.stdout.includes(targetFile(this)),
    `upgrade output unexpectedly reports ${targetFile(this)}`,
  );
});

Given(
  'an installed project whose managed file was refreshed by a previous upgrade',
  function (this: RefreshWorld) {
    installProject(this);
    simulateOlderInstall(this);
    runSafeword(this, ['upgrade']);
    assert.equal(this.result.exitCode, 0, `priming upgrade failed:\n${this.result.stderr}`);
    assert.equal(
      readFileSync(targetPath(this), 'utf8'),
      this.currentResolved,
      'priming refresh did not happen',
    );
  },
);

Given('the customer then edited that file', function (this: RefreshWorld) {
  writeFileSync(targetPath(this), CUSTOMER_EDIT_CONTENT);
  this.frozenBytes = CUSTOMER_EDIT_CONTENT;
});

// --- TB2.R3: cleanup ---

Given('an installed project with a recorded provenance manifest', function (this: RefreshWorld) {
  installProject(this);
});

When(/^safeword (reset(?: --full)?) runs$/, function (this: RefreshWorld, command: string) {
  runSafeword(this, [...command.split(' '), '--yes']);
  assert.equal(this.result.exitCode, 0, `${command} failed:\n${this.result.stderr}`);
});

Then('no provenance manifest remains in the project', function (this: RefreshWorld) {
  assert.ok(
    !existsSync(nodePath.join(projectDir(this), MANIFEST_RELATIVE_PATH)),
    'provenance manifest survived reset',
  );
});

// --- SM1.R1: generator coverage ---

Given(
  'an installed project whose generated managed config matches its recorded provenance',
  function (this: RefreshWorld) {
    installJavascriptProject(this);
    this.generatorLever = true;
    const recorded = readManifest(this).files[targetFile(this)];
    assert.equal(recorded, sha256(this.currentResolved ?? ''), 'setup left a mismatched record');
  },
);

Given(
  "safeword's generator now resolves different content for that config",
  function (this: RefreshWorld) {
    // Real context mutation: an existing formatter flips getEslintConfig to
    // its formatter-agnostic variant.
    writeFileSync(nodePath.join(projectDir(this), 'biome.json'), '{}\n');
  },
);

Then('the config contains the newly resolved content', function (this: RefreshWorld) {
  const onDisk = readFileSync(targetPath(this), 'utf8');
  assert.notEqual(onDisk, this.preUpgradeBytes, 'generated config was not refreshed');
});

Then('the manifest records the new content for that config', function (this: RefreshWorld) {
  const onDisk = readFileSync(targetPath(this), 'utf8');
  assert.equal(readManifest(this).files[targetFile(this)], sha256(onDisk));
});

Given(
  "safeword's generator now resolves no content for that config",
  function (this: RefreshWorld) {
    // A host-authored config earlier in ESLint's discovery order suppresses
    // the generator entirely (it must not fight a host config).
    writeFileSync(nodePath.join(projectDir(this), 'eslint.config.ts'), 'export default [];\n');
    this.frozenBytes = readFileSync(targetPath(this), 'utf8');
  },
);

Then("the config's bytes are unchanged", function (this: RefreshWorld) {
  assert.equal(
    readFileSync(targetPath(this), 'utf8'),
    this.frozenBytes,
    'a generator-suppressed config was touched',
  );
});

// --- SM1.R2: adoption is byte-identity only ---

Given('an installed project with no provenance manifest', function (this: RefreshWorld) {
  installProject(this);
  rmSync(nodePath.join(projectDir(this), MANIFEST_RELATIVE_PATH));
});

Given(
  'a managed file whose content equals the currently resolved output',
  function (this: RefreshWorld) {
    // Post-setup state already satisfies this; capture mtime for the
    // adopted-without-a-write assert.
    captureTargetMtime(this);
  },
);

Then('the manifest records that file', function (this: RefreshWorld) {
  assert.equal(
    readManifest(this).files[targetFile(this)],
    sha256(readFileSync(targetPath(this), 'utf8')),
    'file was not adopted into provenance',
  );
});

Given(
  'an installed project whose managed file equals the currently resolved output',
  function (this: RefreshWorld) {
    installProject(this);
    captureTargetMtime(this);
  },
);

Given("that file's recorded provenance does not match its content", function (this: RefreshWorld) {
  const manifest = readManifest(this);
  manifest.files[targetFile(this)] = 'deadbeef'.repeat(8);
  writeManifestFiles(this, manifest.files);
});

Then('the manifest records the current content for that file', function (this: RefreshWorld) {
  assert.equal(
    readManifest(this).files[targetFile(this)],
    sha256(readFileSync(targetPath(this), 'utf8')),
    'record was not healed to the current content',
  );
});

Given(
  'an installed project whose managed file was adopted into provenance by a previous upgrade',
  function (this: RefreshWorld) {
    installJavascriptProject(this);
    this.generatorLever = true;
    rmSync(nodePath.join(projectDir(this), MANIFEST_RELATIVE_PATH));
    runSafeword(this, ['upgrade']);
    assert.equal(this.result.exitCode, 0, `adopting upgrade failed:\n${this.result.stderr}`);
    assert.equal(
      readManifest(this).files[targetFile(this)],
      sha256(readFileSync(targetPath(this), 'utf8')),
      'file was not adopted',
    );
  },
);

Given('an upgrade has already run without adopting that file', function (this: RefreshWorld) {
  runSafeword(this, ['upgrade']);
  assert.equal(this.result.exitCode, 0, `upgrade failed:\n${this.result.stderr}`);
  const manifest = readManifest(this);
  assert.ok(
    manifest.files[targetFile(this)] === undefined,
    'differing file was unexpectedly adopted',
  );
});

Then('the manifest records no entry for that file', function (this: RefreshWorld) {
  assert.ok(
    readManifest(this).files[targetFile(this)] === undefined,
    'unprovable file was adopted into provenance',
  );
});

// --- SM1.R2: corrupt manifest fails safe, loudly ---

Given(
  'an installed project whose provenance manifest is unparseable',
  function (this: RefreshWorld) {
    installProject(this);
    writeFileSync(nodePath.join(projectDir(this), MANIFEST_RELATIVE_PATH), '{corrupt');
  },
);

Given(
  'safeword now resolves different content for a pristine managed file',
  function (this: RefreshWorld) {
    // Would-be pristine: old bytes on disk; the corrupt manifest makes that
    // unprovable, which is the point.
    writeFileSync(targetPath(this), OLD_REVISION_CONTENT);
    this.frozenBytes = OLD_REVISION_CONTENT;
  },
);

Then('no managed file is rewritten', function (this: RefreshWorld) {
  assert.equal(
    readFileSync(targetPath(this), 'utf8'),
    this.frozenBytes,
    'a file was rewritten despite an unreadable manifest',
  );
});

Then("the manifest file's bytes are unchanged", function (this: RefreshWorld) {
  assert.equal(
    readFileSync(nodePath.join(projectDir(this), MANIFEST_RELATIVE_PATH), 'utf8'),
    '{corrupt',
    'the corrupt manifest was replaced or re-adopted',
  );
});

Then(
  'the upgrade output warns that the provenance manifest is unreadable',
  function (this: RefreshWorld) {
    const output = this.result.stdout + this.result.stderr;
    assert.ok(output.includes('unreadable'), `no manifest warning in output:\n${output}`);
  },
);

// --- SM1.R2: configKey suppression ---

Given(
  "an installed project whose managed file's configKey path override is set",
  function (this: RefreshWorld) {
    this.targetFile = '.project/personas.md';
    installProject(this);
    // Setup can only run on a fresh project (.safeword/ presence refuses it),
    // so the reachable flow is override-after-install: merge the paths key
    // into the config setup wrote, per K7N2QM.
    const configPath = nodePath.join(projectDir(this), '.safeword', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.paths = { ...(config.paths as Record<string, unknown>), personas: 'docs/people.md' };
    writeFileSync(configPath, `${JSON.stringify(config, undefined, 2)}\n`);
    this.manifestBefore = readManifest(this).files;
  },
);

Given(
  'the customer moved that managed file away from its default location',
  function (this: RefreshWorld) {
    rmSync(targetPath(this));
  },
);

Then('the overridden managed file is not recreated', function (this: RefreshWorld) {
  assert.ok(
    !existsSync(targetPath(this)),
    'configKey-overridden managed file was recreated by upgrade',
  );
});

Then('the manifest entry for that file is unchanged', function (this: RefreshWorld) {
  assert.equal(
    readManifest(this).files[targetFile(this)],
    this.manifestBefore?.[targetFile(this)],
    'suppressed entry was re-recorded or pruned',
  );
});

Given(
  'a managed file whose content differs from the currently resolved output',
  function (this: RefreshWorld) {
    this.frozenBytes = CUSTOMER_EDIT_CONTENT;
    writeFileSync(targetPath(this), CUSTOMER_EDIT_CONTENT);
  },
);
