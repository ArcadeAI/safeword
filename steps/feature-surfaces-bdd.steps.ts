import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

interface FeatureSurfacesWorld {
  temporaryDirectory: string;
  result: { stdout: string; stderr: string; exitCode: number };
  authoredSurfaces?: string;
  loadedGuidance?: string[];
  loadedTemplates?: string[];
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts');
const DEFAULT_SURFACES_PATH = nodePath.join('.project', 'surfaces.md');
const CONFIGURED_NAMESPACE_ROOT = 'team-ns';

function createCustomerProject(prefix: string): string {
  const project = mkdtempSync(nodePath.join(tmpdir(), prefix));
  writeFileSync(
    nodePath.join(project, 'package.json'),
    JSON.stringify({ name: 'customer-project', version: '1.0.0' }, undefined, 2),
  );
  return project;
}

function writeSafewordConfig(project: string, config: Record<string, unknown>): void {
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.safeword', 'config.json'),
    JSON.stringify(config, undefined, 2),
  );
}

function runSafeword(project: string, args: string[]): FeatureSurfacesWorld['result'] {
  const result = spawnSync('bun', [CLI_PATH, ...args], {
    cwd: project,
    env: {
      ...process.env,
      SAFEWORD_NO_AUTO_UPGRADE: '1',
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1',
    },
    encoding: 'utf8',
    timeout: 60_000,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

function markConfiguredSafewordProject(project: string): void {
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  mkdirSync(nodePath.join(project, '.claude'), { recursive: true });
  writeFileSync(nodePath.join(project, '.safeword', 'version'), '0.5.0');
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# Old content\n');
  writeFileSync(nodePath.join(project, '.claude', 'settings.json'), '{}');
  writeFileSync(nodePath.join(project, 'AGENTS.md'), '.safeword/SAFEWORD.md\n\n# Agents\n');
}

function markSafewordDevDependenciesInstalled(project: string): void {
  const packageJsonPath = nodePath.join(project, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
  };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    '@cucumber/cucumber': '^12.0.0',
    '@types/node': '^24.0.0',
    eslint: '^10.0.0',
    prettier: '^3.0.0',
    safeword: '0.0.0-test',
    tsx: '^4.0.0',
  };
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, undefined, 2));
}

function assertCommandSucceeded(result: FeatureSurfacesWorld['result']): void {
  assert.equal(result.exitCode, 0, `stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`);
}

function readProjectFile(world: FeatureSurfacesWorld, relativePath: string): string {
  assert.ok(world.temporaryDirectory, 'customer project was not created');
  return readFileSync(nodePath.join(world.temporaryDirectory, relativePath), 'utf8');
}

function expectSurfacesStarter(content: string): void {
  assert.ok(content.includes('# Surfaces'), 'surfaces.md should have a Surfaces heading');
  assert.ok(content.includes('Project-wide feature surface inventory'), content);
  assert.ok(content.includes('## Claude Code'), content);
  assert.ok(content.includes('## OpenAI Codex'), content);
  assert.ok(content.includes('**Kind:** Agent runtime'), content);
}

function expectOrderedNeedles(content: string, needles: string[]): void {
  let previous = -1;
  for (const needle of needles) {
    const current = content.indexOf(needle);
    assert.ok(current > previous, `"${needle}" was not found after previous needle`);
    previous = current;
  }
}

After(function (this: FeatureSurfacesWorld) {
  if (this.temporaryDirectory === undefined) return;
  rmSync(this.temporaryDirectory, { recursive: true, force: true });
});

Given('a customer project with no namespace root', function (this: FeatureSurfacesWorld) {
  this.temporaryDirectory = createCustomerProject('safeword-surfaces-fresh-');
});

Given(
  'a customer project whose safeword config sets paths.projectRoot',
  function (this: FeatureSurfacesWorld) {
    this.temporaryDirectory = createCustomerProject('safeword-surfaces-root-');
    markConfiguredSafewordProject(this.temporaryDirectory);
    writeSafewordConfig(this.temporaryDirectory, {
      installedPacks: [],
      paths: { projectRoot: CONFIGURED_NAMESPACE_ROOT },
    });
  },
);

Given('a customer project with an authored surfaces.md', function (this: FeatureSurfacesWorld) {
  this.temporaryDirectory = createCustomerProject('safeword-surfaces-authored-');
  this.authoredSurfaces = '# Surfaces\n\n## Customer Console\n\n**Kind:** UI\n';
  mkdirSync(nodePath.join(this.temporaryDirectory, '.project'), { recursive: true });
  writeFileSync(
    nodePath.join(this.temporaryDirectory, DEFAULT_SURFACES_PATH),
    this.authoredSurfaces,
  );
});

Given(
  'a customer project whose safeword config sets paths.surfaces',
  function (this: FeatureSurfacesWorld) {
    this.temporaryDirectory = createCustomerProject('safeword-surfaces-override-');
    markConfiguredSafewordProject(this.temporaryDirectory);
    writeSafewordConfig(this.temporaryDirectory, {
      installedPacks: [],
      paths: { surfaces: 'docs/surfaces.md' },
    });
  },
);

Then(
  'the resolved namespace root contains surfaces.md with starter guidance',
  function (this: FeatureSurfacesWorld) {
    expectSurfacesStarter(readProjectFile(this, DEFAULT_SURFACES_PATH));
  },
);

Then(
  'surfaces.md is created under the configured namespace root',
  function (this: FeatureSurfacesWorld) {
    expectSurfacesStarter(
      readProjectFile(this, nodePath.join(CONFIGURED_NAMESPACE_ROOT, 'surfaces.md')),
    );
  },
);

Then('the authored surfaces.md content is unchanged', function (this: FeatureSurfacesWorld) {
  assert.equal(readProjectFile(this, DEFAULT_SURFACES_PATH), this.authoredSurfaces);
});

Then(
  'the default namespace-root surfaces.md is not created',
  function (this: FeatureSurfacesWorld) {
    assert.ok(
      !existsSync(nodePath.join(this.temporaryDirectory, DEFAULT_SURFACES_PATH)),
      'paths.surfaces should suppress the default surfaces.md scaffold',
    );
  },
);

Given(
  'an in-progress feature that affects Claude Code and OpenAI Codex',
  function (this: FeatureSurfacesWorld) {
    this.temporaryDirectory = createCustomerProject('safeword-surfaces-check-');
    assertCommandSucceeded(runSafeword(this.temporaryDirectory, ['setup', '--yes']));
    markSafewordDevDependenciesInstalled(this.temporaryDirectory);

    const ticketRoot = nodePath.join(this.temporaryDirectory, '.project/tickets/SUR001-demo');
    mkdirSync(ticketRoot, { recursive: true });
    writeFileSync(
      nodePath.join(ticketRoot, 'ticket.md'),
      ['---', 'id: SUR001', 'type: feature', 'status: in_progress', '---', ''].join('\n'),
    );
    writeFileSync(
      nodePath.join(ticketRoot, 'spec.md'),
      [
        '# Spec',
        '',
        '## Surfaces',
        '',
        'Affected:',
        '- Claude Code',
        '- OpenAI Codex',
        '',
        '## Jobs To Be Done',
        '',
        '### demo.TB1 — Trace',
        '',
        '**Persona:** TB',
        '',
        '#### demo.TB1.AC1 — behavior works',
        '',
      ].join('\n'),
    );
    mkdirSync(nodePath.join(this.temporaryDirectory, 'features'), { recursive: true });
    writeFileSync(
      nodePath.join(this.temporaryDirectory, 'features/demo.feature'),
      [
        'Feature: Demo',
        '',
        '  Rule: Runtime coverage',
        '',
        '    @demo.TB1.AC1 @surface.claude-code',
        '    Scenario: Claude Code coverage only',
        '      Given a',
        '      When b',
        '      Then c',
        '',
      ].join('\n'),
    );
  },
);

When('safeword check runs', function (this: FeatureSurfacesWorld) {
  assert.ok(this.temporaryDirectory, 'customer project was not created');
  this.result = runSafeword(this.temporaryDirectory, ['check', '--offline']);
});

Then(
  'safeword reports missing surface coverage for OpenAI Codex',
  function (this: FeatureSurfacesWorld) {
    assert.equal(
      this.result.exitCode,
      0,
      `check should warn without failing\nstdout:\n${this.result.stdout}\n\nstderr:\n${this.result.stderr}`,
    );
    const combined = `${this.result.stdout}\n${this.result.stderr}`;
    assert.match(combined, /OpenAI Codex.*uncovered surface/i);
  },
);

Given('the installed BDD intake guidance', function (this: FeatureSurfacesWorld) {
  this.loadedGuidance = [
    'packages/cli/templates/skills/bdd/DISCOVERY.md',
    '.claude/skills/bdd/DISCOVERY.md',
    '.agents/skills/bdd/DISCOVERY.md',
  ].map(relativePath => readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8'));
});

When('an agent starts feature intake', function (this: FeatureSurfacesWorld) {
  assert.ok(this.loadedGuidance, 'BDD intake guidance was not loaded');
});

Then(
  'the guidance tells the agent to load surfaces.md after personas.md and glossary.md',
  function (this: FeatureSurfacesWorld) {
    assert.ok(this.loadedGuidance, 'BDD intake guidance was not loaded');
    for (const content of this.loadedGuidance) {
      expectOrderedNeedles(content, [
        '## Load project personas',
        '## Load project glossary',
        '## Load project surfaces',
      ]);
      assert.ok(content.includes('paths.surfaces'), content);
      assert.ok(content.includes('<namespace-root>/surfaces.md'), content);
      assert.match(content, /surfaces\.md` is empty.*add surfaces now/is);
    }
  },
);

Given('the installed feature spec template', function (this: FeatureSurfacesWorld) {
  this.loadedTemplates = [
    'packages/cli/templates/spec-template.md',
    'packages/cli/templates/doc-templates/feature-spec-template.md',
    '.safeword/templates/spec-template.md',
    '.safeword/templates/feature-spec-template.md',
  ].map(relativePath => readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8'));
});

When('a feature spec is scaffolded', function (this: FeatureSurfacesWorld) {
  assert.ok(this.loadedTemplates, 'feature spec templates were not loaded');
});

Then(
  'it includes a Surfaces section for affected runtime contexts',
  function (this: FeatureSurfacesWorld) {
    assert.ok(this.loadedTemplates, 'feature spec templates were not loaded');
    for (const content of this.loadedTemplates) {
      assert.ok(content.includes('## Surfaces'), content);
      assert.match(content, /configured\s+surfaces file/, content);
      assert.ok(content.includes('Affected:'), content);
      assert.ok(content.includes('@surface.<slug>'), content);
    }
  },
);
