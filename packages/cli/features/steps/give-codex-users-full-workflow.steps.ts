import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  assertCodexPluginCatalogue,
  assertCodexSkillMetadataBudget,
  CODEX_SKILL_METADATA_LIMIT,
  codexSkillMetadataCharacters,
  generateCodexPluginAssets,
  type GeneratedPluginAsset,
} from '../../src/codex-plugin/catalogue.ts';
import {
  assertPinnedBunxHookCommand,
  codexPluginHookCommands,
  type CodexPluginHookEntry,
} from '../../src/codex-plugin/hooks.ts';
import { assertCachedCodexPlugin } from '../../tests/helpers/codex-plugin-cache.ts';
import {
  assertPackedCodexPlugin,
  extractPackedCliPackage,
  packCliPackage,
} from '../../tests/helpers/codex-plugin-package.ts';
import type { SafewordWorld } from './world.js';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '../..');
const CLI_PATH = nodePath.join(CLI_ROOT, 'dist/cli.js');
const CANONICAL_SKILLS = nodePath.join(CLI_ROOT, 'templates/skills');
const PLUGIN_ROOT = nodePath.join(CLI_ROOT, 'codex-plugin');
const WORKFLOW_TREES = ['.agents/skills', '.codex/skills', '.safeword/skills'] as const;

type Contract = () => void;

interface WorkflowWorld extends SafewordWorld {
  fixtureRoot?: string;
  generatedAssets?: GeneratedPluginAsset[];
  pluginDirectory?: string;
  projectDirectory?: string;
  packageDirectory?: string;
  metadataCharacters?: number;
  releaseContract?: Contract;
  sourceContract?: Contract;
  integrationContract?: Contract;
  packageContract?: Contract;
  hookContract?: Contract;
  contractError?: Error;
  hookContractError?: Error;
}

function fixtureRoot(world: WorkflowWorld): string {
  if (world.fixtureRoot === undefined) {
    world.fixtureRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-workflow-'));
  }
  return world.fixtureRoot;
}

function recordContract(world: WorkflowWorld, contract: Contract): void {
  try {
    contract();
    world.contractError = undefined;
  } catch (error) {
    world.contractError = error instanceof Error ? error : new Error(String(error));
  }
}

function assertContractRejected(world: WorkflowWorld, detail?: string): void {
  assert.ok(world.contractError !== undefined, 'expected release contract to reject the fixture');
  if (detail !== undefined) assert.ok(world.contractError.message.includes(detail));
}

function assertNoProjectWorkflowTree(projectRoot: string): void {
  for (const directory of WORKFLOW_TREES) {
    assert.equal(
      existsSync(nodePath.join(projectRoot, directory)),
      false,
      `${directory} must not exist in a Codex plugin project`,
    );
  }
}

function copyPluginFixture(world: WorkflowWorld): string {
  const pluginDirectory = nodePath.join(fixtureRoot(world), 'codex-plugin');
  cpSync(PLUGIN_ROOT, pluginDirectory, { recursive: true });
  world.pluginDirectory = pluginDirectory;
  return pluginDirectory;
}

function packageVersion(): string {
  return JSON.parse(readFileSync(nodePath.join(CLI_ROOT, 'package.json'), 'utf8'))
    .version as string;
}

function readPluginHooks(): Record<string, CodexPluginHookEntry[]> {
  return (
    JSON.parse(readFileSync(nodePath.join(PLUGIN_ROOT, 'hooks.json'), 'utf8')) as {
      hooks: Record<string, CodexPluginHookEntry[]>;
    }
  ).hooks;
}

function commandSlot(hooks: Record<string, CodexPluginHookEntry[]>): { command: string } {
  for (const entries of Object.values(hooks)) {
    for (const entry of entries) {
      const nestedHooks = entry.hooks ?? [];
      for (const hook of nestedHooks) {
        if (hook.command !== undefined) return hook as { command: string };
      }
    }
  }
  throw new Error('plugin hook manifest contains no commands');
}

function runSetup(projectRoot: string) {
  const result = spawnSync(process.execPath, [CLI_PATH, 'setup', '--yes', '--no-modify'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, SAFEWORD_SKIP_INSTALL: '1' },
  });
  return {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  };
}

After(function (this: WorkflowWorld) {
  if (this.fixtureRoot !== undefined) {
    rmSync(this.fixtureRoot, { recursive: true, force: true });
  }
});

Given('a canonical workflow requires supporting phase material', function (this: WorkflowWorld) {
  copyPluginFixture(this);
});

Given('the generated plugin omits that material', function (this: WorkflowWorld) {
  const pluginDirectory = this.pluginDirectory;
  assert.ok(pluginDirectory !== undefined, 'plugin fixture was not initialized');
  rmSync(nodePath.join(pluginDirectory, 'skills/bdd/references/DISCOVERY.md'));
  this.releaseContract = () => {
    assertCodexPluginCatalogue(CANONICAL_SKILLS, pluginDirectory);
  };
});

When('the plugin release contract runs', function (this: WorkflowWorld) {
  assert.ok(this.releaseContract !== undefined, 'plugin release contract was not initialized');
  recordContract(this, this.releaseContract);
});

Then('the release is rejected', function (this: WorkflowWorld) {
  assertContractRejected(this);
});

Given('an empty project has no Safe Word workflow material', function (this: WorkflowWorld) {
  const projectDirectory = nodePath.join(fixtureRoot(this), 'project');
  mkdirSync(projectDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(projectDirectory, 'package.json'),
    JSON.stringify({ name: 'codex-workflow-fixture', private: true }),
  );
  assertNoProjectWorkflowTree(projectDirectory);
  this.projectDirectory = projectDirectory;
});

When('the builder sets up Safe Word for Codex', function (this: WorkflowWorld) {
  assert.ok(this.projectDirectory !== undefined, 'project fixture was not initialized');
  const result = runSetup(this.projectDirectory);
  assert.equal(result.exitCode, 0, result.output);
  this.result = { stdout: result.output, stderr: '', exitCode: result.exitCode };
});

Then(
  'Safe Word directs the builder to the explicit Codex plugin migration command',
  function (this: WorkflowWorld) {
    assert.ok(this.result.stdout.includes('safeword migrate codex-plugin'), this.result.stdout);
  },
);

Then(
  'the project contains no Safe Word workflow tree in .agents, .codex, or .safeword',
  function (this: WorkflowWorld) {
    assert.ok(this.projectDirectory !== undefined, 'project fixture was not initialized');
    assertNoProjectWorkflowTree(this.projectDirectory);
  },
);

Given(
  'a generated plugin writes Safe Word workflow material into the target project',
  function (this: WorkflowWorld) {
    const projectDirectory = nodePath.join(fixtureRoot(this), 'project');
    mkdirSync(nodePath.join(projectDirectory, '.agents/skills/bdd'), { recursive: true });
    cpSync(
      nodePath.join(PLUGIN_ROOT, 'skills/bdd/SKILL.md'),
      nodePath.join(projectDirectory, '.agents/skills/bdd/SKILL.md'),
    );
    this.projectDirectory = projectDirectory;
    this.integrationContract = () => {
      assertNoProjectWorkflowTree(projectDirectory);
    };
  },
);

When('the Codex integration contract runs', function (this: WorkflowWorld) {
  assert.ok(this.integrationContract !== undefined, 'integration contract was not initialized');
  recordContract(this, this.integrationContract);
});

Then('the integration is rejected', function (this: WorkflowWorld) {
  assertContractRejected(this, '.agents');
});

Given('a canonical Safe Word workflow', function (this: WorkflowWorld) {
  const canonicalSkillsDirectory = nodePath.join(fixtureRoot(this), 'canonical-skills');
  mkdirSync(nodePath.join(canonicalSkillsDirectory, 'alpha'), { recursive: true });
  mkdirSync(nodePath.join(canonicalSkillsDirectory, 'beta'), { recursive: true });
  writeFileSync(
    nodePath.join(canonicalSkillsDirectory, 'alpha/SKILL.md'),
    [
      '---',
      'name: alpha',
      'description: Invoke /beta and retain /beta.md',
      'allowed-tools: Bash',
      '---',
      '',
      'Run /beta, preserve /outside, and consult TDD.md.',
      '',
    ].join('\n'),
  );
  writeFileSync(
    nodePath.join(canonicalSkillsDirectory, 'alpha/TDD.md'),
    '# TDD detail\n\nRun /beta before writing /beta.md.\n',
  );
  writeFileSync(
    nodePath.join(canonicalSkillsDirectory, 'beta/SKILL.md'),
    ['---', 'name: beta', 'description: Referenced skill', '---', '', '# Beta', ''].join('\n'),
  );
  this.pluginDirectory = canonicalSkillsDirectory;
});

When('Safe Word generates its Codex plugin skill', function (this: WorkflowWorld) {
  assert.ok(this.pluginDirectory !== undefined, 'canonical workflow fixture was not initialized');
  this.generatedAssets = generateCodexPluginAssets(this.pluginDirectory);
});

Then(
  'the output differs only in supported metadata, scoped invocation, and reference-path adaptations',
  function (this: WorkflowWorld) {
    assert.deepEqual(this.generatedAssets, [
      {
        relativePath: nodePath.join('skills', 'alpha', 'SKILL.md'),
        content:
          '---\nname: alpha\ndescription: Invoke $safeword:beta and retain /beta.md\n---\n\nRun $safeword:beta, preserve /outside, and consult references/TDD.md.\n',
      },
      {
        relativePath: nodePath.join('skills', 'alpha', 'references', 'TDD.md'),
        content: '# TDD detail\n\nRun $safeword:beta before writing /beta.md.\n',
      },
      {
        relativePath: nodePath.join('skills', 'beta', 'SKILL.md'),
        content: '---\nname: beta\ndescription: Referenced skill\n---\n\n# Beta\n',
      },
    ]);
  },
);

Given('the generated Safe Word plugin catalogue', function (this: WorkflowWorld) {
  this.generatedAssets = generateCodexPluginAssets(CANONICAL_SKILLS);
});

When('the release contract measures its skill metadata inventory', function (this: WorkflowWorld) {
  assert.ok(this.generatedAssets !== undefined, 'generated plugin catalogue was not initialized');
  assertCodexSkillMetadataBudget(this.generatedAssets);
  this.metadataCharacters = codexSkillMetadataCharacters(this.generatedAssets);
});

Then(
  'the inventory is no more than {int} characters',
  function (this: WorkflowWorld, limit: number) {
    assert.ok(this.metadataCharacters !== undefined, 'metadata inventory was not measured');
    assert.ok(this.metadataCharacters <= limit, `${this.metadataCharacters} exceeds ${limit}`);
  },
);

Given(
  'a generated Safe Word plugin catalogue has metadata inventory over 8000 characters',
  function (this: WorkflowWorld) {
    const assets = generateCodexPluginAssets(CANONICAL_SKILLS);
    this.releaseContract = () => {
      assertCodexSkillMetadataBudget([
        ...assets,
        {
          relativePath: 'skills/oversized/SKILL.md',
          content: `---\nname: oversized\ndescription: ${'x'.repeat(CODEX_SKILL_METADATA_LIMIT)}\n---\n`,
        },
      ]);
    };
  },
);

Given(
  'a generated Codex workflow differs from its canonical workflow outside the allowed adaptations',
  function (this: WorkflowWorld) {
    const pluginDirectory = copyPluginFixture(this);
    writeFileSync(
      nodePath.join(pluginDirectory, 'skills/bdd/references/DISCOVERY.md'),
      '# Drift outside the allowed adaptation\n',
    );
    this.sourceContract = () => {
      assertCodexPluginCatalogue(CANONICAL_SKILLS, pluginDirectory);
    };
  },
);

When('the source-to-plugin contract runs', function (this: WorkflowWorld) {
  assert.ok(this.sourceContract !== undefined, 'source-to-plugin contract was not initialized');
  recordContract(this, this.sourceContract);
});

Then('generation is rejected', function (this: WorkflowWorld) {
  assertContractRejected(this, 'differs from the canonical transformation');
});

When('Safe Word packs a release package', function (this: WorkflowWorld) {
  const destination = nodePath.join(fixtureRoot(this), 'packed');
  mkdirSync(destination, { recursive: true });
  this.packageDirectory = extractPackedCliPackage(
    packCliPackage(CLI_ROOT, destination),
    destination,
  );
});

Then(
  'the package contains every generated skill and reference asset',
  function (this: WorkflowWorld) {
    assert.ok(this.packageDirectory !== undefined, 'packed package fixture was not initialized');
    assertPackedCodexPlugin(CLI_ROOT, this.packageDirectory);
  },
);

Given('a packed Safe Word package omits a generated plugin asset', function (this: WorkflowWorld) {
  const destination = nodePath.join(fixtureRoot(this), 'packed');
  mkdirSync(destination, { recursive: true });
  const packageDirectory = extractPackedCliPackage(
    packCliPackage(CLI_ROOT, destination),
    destination,
  );
  rmSync(nodePath.join(packageDirectory, 'codex-plugin/skills/bdd/references/DISCOVERY.md'));
  this.packageContract = () => {
    assertPackedCodexPlugin(CLI_ROOT, packageDirectory);
  };
});

When('the package release contract runs', function (this: WorkflowWorld) {
  assert.ok(this.packageContract !== undefined, 'package release contract was not initialized');
  recordContract(this, this.packageContract);
});

Then('publication is rejected', function (this: WorkflowWorld) {
  assertContractRejected(this, 'missing expected asset');
});

Given(
  'a target project contains a copy of a required Safe Word workflow asset',
  function (this: WorkflowWorld) {
    const root = fixtureRoot(this);
    const projectDirectory = nodePath.join(root, 'project');
    const installedPath = nodePath.join(root, 'home/plugins/cache/safeword/safeword/0.68.0');
    cpSync(PLUGIN_ROOT, installedPath, { recursive: true });
    const projectCopy = nodePath.join(
      projectDirectory,
      '.agents/skills/bdd/references/DISCOVERY.md',
    );
    mkdirSync(nodePath.dirname(projectCopy), { recursive: true });
    cpSync(nodePath.join(installedPath, 'skills/bdd/references/DISCOVERY.md'), projectCopy);
    this.projectDirectory = projectDirectory;
    this.pluginDirectory = installedPath;
  },
);

Given('the installed plugin cache omits that asset', function (this: WorkflowWorld) {
  const cachedFixtureRoot = this.fixtureRoot;
  const installedPath = this.pluginDirectory;
  assert.ok(cachedFixtureRoot !== undefined, 'cache fixture was not initialized');
  assert.ok(installedPath !== undefined, 'cached plugin fixture was not initialized');
  rmSync(nodePath.join(installedPath, 'skills/bdd/references/DISCOVERY.md'));
  this.integrationContract = () =>
    assertCachedCodexPlugin(CLI_ROOT, nodePath.join(cachedFixtureRoot, 'home'), installedPath);
});

When('the isolated installation contract runs', function (this: WorkflowWorld) {
  assert.ok(
    this.integrationContract !== undefined,
    'isolated installation contract was not initialized',
  );
  recordContract(this, this.integrationContract);
});

Then('the installation is rejected', function (this: WorkflowWorld) {
  assertContractRejected(this, 'missing expected asset');
});

Given('the generated Safe Word plugin hooks', function (this: WorkflowWorld) {
  const version = packageVersion();
  const hooks = readPluginHooks();
  this.hookContract = () => {
    for (const command of codexPluginHookCommands(hooks)) {
      assertPinnedBunxHookCommand(command, version);
    }
  };
});

When('the hook release contract runs', function (this: WorkflowWorld) {
  assert.ok(this.hookContract !== undefined, 'hook release contract was not initialized');
  try {
    this.hookContract();
    this.hookContractError = undefined;
  } catch (error) {
    this.hookContractError = error instanceof Error ? error : new Error(String(error));
  }
});

Then('every Safe Word hook invokes a version-pinned Bunx command', function (this: WorkflowWorld) {
  assert.equal(this.hookContractError, undefined);
});

Given(
  'a Safe Word plugin hook violates the {string} policy',
  function (this: WorkflowWorld, policy: string) {
    const hooks = readPluginHooks();
    const command = commandSlot(hooks);
    const version = packageVersion();
    switch (policy) {
      case 'npx execution': {
        command.command = `npx safeword@${version} hook codex session-start`;

        break;
      }
      case 'unpinned CLI version': {
        command.command = 'bunx --bun safeword hook codex session-start';

        break;
      }
      case 'hook-trust bypass flag': {
        command.command = `bunx --bun safeword@${version} hook codex session-start --dangerously-bypass-hook-trust`;

        break;
      }
      default: {
        throw new Error(`unknown hook policy: ${policy}`);
      }
    }
    this.hookContract = () => {
      for (const hookCommand of codexPluginHookCommands(hooks)) {
        assertPinnedBunxHookCommand(hookCommand, version);
      }
    };
  },
);

Then('the release is rejected for {string}', function (this: WorkflowWorld, policy: string) {
  assert.ok(this.hookContractError !== undefined, 'expected hook contract to reject the fixture');
  const expectedMessage = {
    'npx execution': 'Bunx',
    'unpinned CLI version': `safeword@${packageVersion()}`,
    'hook-trust bypass flag': 'must not bypass',
  }[policy];
  assert.ok(expectedMessage !== undefined, `unknown hook policy: ${policy}`);
  assert.ok(this.hookContractError.message.includes(expectedMessage));
});
