import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  unlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { discoverCodexResources } from '../packages/cli/scripts/check-codex-internal-reference.js';
import { shellQuote } from '../packages/cli/src/cli-protocol/replay-command.js';
import { OPENCODE_V2_PLUGIN_LAYOUT } from '../packages/cli/src/schema.js';
import type { SafewordWorld } from './world.js';

class SelectedProject {
  readonly root = mkdtempSync(path.join(tmpdir(), 'safeword-selected-host-'));
  readonly project = path.join(this.root, 'project');
  readonly profile = path.join(this.root, 'opencode');
  readonly config = path.join(this.profile, 'opencode.jsonc');
  readonly unselectedConfig = path.join(this.root, '.codex', 'config.toml');
  readonly probe = path.join(this.root, 'unexpected-probe');
  readonly customerConfig = 'model = "customer-choice"\n';

  constructor(private readonly cli: string) {}

  prepare(binary: string) {
    assert.ok(
      existsSync(this.cli),
      'The fixture must include the built CLI alongside its OpenCode package',
    );
    for (const dir of [
      this.project,
      this.profile,
      path.dirname(this.unselectedConfig),
      path.join(this.root, 'bin'),
    ]) {
      mkdirSync(dir);
    }
    writeFileSync(this.unselectedConfig, this.customerConfig);
    writeFileSync(this.config, JSON.stringify({ theme: 'custom', plugins: ['unrelated'] }));
    writeFileSync(
      path.join(this.project, 'package.json'),
      '{"name":"host-selection","private":true}',
    );
    execFileSync('git', ['init', '-q', this.project]);
    symlinkSync(binary, path.join(this.root, 'bin/opencode'));
    for (const name of ['codex', 'claude', 'cursor', 'cursor-agent', 'agent']) {
      writeFileSync(
        path.join(this.root, 'bin', name),
        `#!/bin/sh\nprintf "%s\\n" "$0" >> ${shellQuote(this.probe)}\nexit 99\n`,
        { mode: 0o700 },
      );
    }
  }

  unselectedAssets() {
    const assets: Record<string, string> = {};
    const visit = (relative: string) => {
      const absolute = path.join(this.root, relative);
      const stat = lstatSync(absolute, { throwIfNoEntry: false });
      if (!stat) return;
      if (stat.isDirectory()) {
        assets[relative] = 'directory';
        for (const name of readdirSync(absolute)) visit(path.join(relative, name));
      } else {
        assets[relative] = stat.isSymbolicLink()
          ? 'link:' + readlinkSync(absolute)
          : 'file:' + readFileSync(absolute).toString('base64');
      }
    };
    for (const host of ['.codex', '.claude', '.cursor']) {
      visit(host);
      visit(path.join('project', host));
    }
    return assets;
  }

  environment() {
    return {
      PATH: path.join(this.root, 'bin') + path.delimiter + process.env.PATH,
      HOME: this.root,
      PWD: this.project,
      OPENCODE_CONFIG_DIR: this.profile,
      CODEX_HOME: path.dirname(this.unselectedConfig),
      CLAUDE_CONFIG_DIR: path.join(this.root, '.claude'),
      XDG_CONFIG_HOME: path.join(this.root, 'config'),
      XDG_DATA_HOME: path.join(this.root, 'data'),
      XDG_STATE_HOME: path.join(this.root, 'state'),
      XDG_CACHE_HOME: path.join(this.root, 'cache'),
    };
  }

  run(command: string, flags: string[] = [], expectedExit = 0, agent = 'opencode') {
    const networkFlags = agent === 'codex' && command === 'install' ? [] : ['--offline'];
    const result = spawnSync(
      process.execPath,
      [this.cli, command, '--agents=' + agent, ...networkFlags, '--no-input', '--json', ...flags],
      {
        cwd: this.project,
        encoding: 'utf8',
        timeout: 120_000,
        env:
          agent === 'codex'
            ? { ...this.environment(), SAFEWORD_SKIP_INSTALL: '1' }
            : this.environment(),
      },
    );
    assert.equal(
      result.status,
      expectedExit,
      result.error?.message ?? result.stderr + result.stdout,
    );
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.errors, []);
    return output;
  }

  verifyActive() {
    const result = this.run('conformance');
    assert.equal(result.data.agent, 'opencode');
    assert.equal(result.data.conformant, true);
    assert.equal(result.state, 'healthy');
  }
}

interface SelectionWorld extends SafewordWorld {
  selection?: SelectedProject;
  selectedResult?: string;
  installed?: { config: Buffer; enrollment: Buffer; record: string };
  repeat?: { changed: boolean; state: string };
  originalAssets?: Record<string, string>;
  sibling?: { installation: string; config: Buffer };
}

After({ tags: '@consistent-host-contract.TBU2.R2' }, function (this: SelectionWorld) {
  if (this.selection) rmSync(this.selection.root, { recursive: true, force: true });
});

function prepareSelection(world: SelectionWorld) {
  const descriptor =
    world.parameters.opencodeFixtureFile ?? process.env.SAFEWORD_OPENCODE_TEST_CONFIG;
  assert.ok(typeof descriptor === 'string', 'An OpenCode native fixture is required');
  const { v2CandidatePackage, v2Binary } = JSON.parse(readFileSync(descriptor, 'utf8'));
  assert.ok(typeof v2CandidatePackage === 'string' && path.isAbsolute(v2CandidatePackage));
  assert.ok(typeof v2Binary === 'string' && path.isAbsolute(v2Binary));
  world.selection = new SelectedProject(path.join(path.dirname(v2CandidatePackage), 'cli.js'));
  world.selection.prepare(v2Binary);
}

Given(
  'one host is selected and another host has existing user-owned assets and an executable probe sentinel',
  function (this: SelectionWorld) {
    prepareSelection(this);
    assert.ok(this.selection);
    this.originalAssets = this.selection.unselectedAssets();
  },
);

When(
  'Safeword runs {string} for the selected integration',
  { timeout: 180_000 },
  function (this: SelectionWorld, operation: string) {
    const fixture = this.selection;
    assert.ok(fixture);
    if (operation !== 'install') {
      assert.equal(fixture.run('install').state, 'changed');
      fixture.verifyActive();
    }
    switch (operation) {
      case 'install':
        assert.equal(fixture.run('install').state, 'changed');
        fixture.verifyActive();
        this.selectedResult = 'active installed delivery';
        break;
      case 'upgrade': {
        const before = readFileSync(fixture.config);
        const result = fixture.run('upgrade');
        assert.equal(result.changed, false);
        assert.equal(result.state, 'healthy');
        assert.deepEqual(readFileSync(fixture.config), before);
        fixture.verifyActive();
        this.selectedResult = 'active current delivery';
        break;
      }
      case 'repair': {
        const config = JSON.parse(readFileSync(fixture.config, 'utf8'));
        const before = structuredClone(config);
        assert.equal(config.plugins.length, 2);
        config.plugins = ['unrelated'];
        writeFileSync(fixture.config, JSON.stringify(config));
        assert.equal(fixture.run('install').state, 'changed');
        fixture.verifyActive();
        assert.deepEqual(JSON.parse(readFileSync(fixture.config, 'utf8')), before);
        this.selectedResult = 'restored active delivery';
        break;
      }
      case 'uninstall': {
        const enrollments = path.join(fixture.profile, OPENCODE_V2_PLUGIN_LAYOUT.enrollments);
        assert.equal(readdirSync(enrollments).length, 1);
        const plan = fixture.run('uninstall', [], 2);
        assert.equal(plan.state, 'action_required');
        assert.equal(
          fixture.run('uninstall', ['--yes', '--plan', plan.data.plan.id]).state,
          'changed',
        );
        assert.deepEqual(JSON.parse(readFileSync(fixture.config, 'utf8')), {
          theme: 'custom',
          plugins: ['unrelated'],
        });
        assert.deepEqual(existsSync(enrollments) ? readdirSync(enrollments) : [], []);
        const removed = fixture.run('conformance', [], 2);
        assert.equal(removed.state, 'action_required');
        assert.equal(removed.data.conformant, false);
        assert.ok(
          removed.findings.some(
            (finding: { code: string }) => finding.code === 'OPENCODE_V2_ENROLLMENT_REQUIRED',
          ),
        );
        this.selectedResult = 'integration removed';
        break;
      }
      default:
        throw new Error(`Unknown lifecycle operation: ${operation}`);
    }
  },
);

Then(
  "the selected integration has verified result {string} while the other host's assets remain byte-identical and its executable probe sentinel is not invoked",
  function (this: SelectionWorld, expected: string) {
    assert.ok(this.selection);
    assert.equal(this.selectedResult, expected);
    assert.deepEqual(this.selection.unselectedAssets(), this.originalAssets);
    assert.equal(existsSync(this.selection.probe), false);
  },
);

Given(
  'selected native delivery is installed and verified',
  { timeout: 180_000 },
  function (this: SelectionWorld) {
    prepareSelection(this);
    const project = this.selection!;
    assert.equal(project.run('install').state, 'changed');
    project.verifyActive();
    const directory = path.join(project.profile, OPENCODE_V2_PLUGIN_LAYOUT.enrollments);
    const records = readdirSync(directory);
    assert.equal(records.length, 1);
    this.installed = {
      config: readFileSync(project.config),
      record: records[0]!,
      enrollment: readFileSync(path.join(directory, records[0]!)),
    };
  },
);
When(
  'the same install operation is repeated',
  { timeout: 120_000 },
  function (this: SelectionWorld) {
    assert.ok(this.selection);
    this.repeat = this.selection.run('install');
  },
);
Then(
  'it reports no required delivery mutation and retains one active framework authority',
  { timeout: 120_000 },
  function (this: SelectionWorld) {
    assert.ok(this.selection && this.installed);
    assert.equal(this.repeat?.changed, false);
    assert.equal(this.repeat.state, 'healthy');
    const directory = path.join(this.selection.profile, OPENCODE_V2_PLUGIN_LAYOUT.enrollments);
    assert.deepEqual(readdirSync(directory), [this.installed.record]);
    assert.deepEqual(
      readFileSync(path.join(directory, this.installed.record)),
      this.installed.enrollment,
    );
    assert.deepEqual(readFileSync(this.selection.config), this.installed.config);
    const { plugins } = JSON.parse(this.installed.config.toString());
    assert.equal(plugins.filter((entry: unknown) => entry !== 'unrelated').length, 1);
    this.selection.verifyActive();
  },
);

const note = '.project/customer-note.md';
const noteContents = 'Customer knowledge shared by both hosts.\n';

Given(
  'two selected hosts use shared framework resources and project-owned knowledge',
  { timeout: 180_000 },
  async function (this: SelectionWorld) {
    prepareSelection(this);
    const fixture = this.selection;
    assert.ok(fixture);
    mkdirSync(path.join(fixture.project, '.project'), { recursive: true });
    writeFileSync(path.join(fixture.project, note), noteContents);
    assert.equal(fixture.run('install').state, 'changed');
    fixture.verifyActive();
    const descriptor = process.env.SAFEWORD_CODEX_TEST_CONFIG;
    assert.ok(descriptor, 'A prepared Codex binary is required');
    const { binary } = JSON.parse(readFileSync(descriptor, 'utf8'));
    assert.ok(typeof binary === 'string' && path.isAbsolute(binary));
    const executable = path.join(fixture.root, 'bin', 'codex');
    unlinkSync(executable);
    symlinkSync(binary, executable);
    const options = {
      cwd: fixture.project,
      env: fixture.environment(),
      encoding: 'utf8' as const,
      timeout: 60_000,
    };
    execFileSync(
      binary,
      ['plugin', 'marketplace', 'add', path.resolve(import.meta.dirname, '..'), '--json'],
      options,
    );
    const installation = JSON.parse(
      execFileSync(binary, ['plugin', 'add', 'safeword@safeword', '--json'], options),
    ).installedPath;
    const enrolled = fixture.run('install', [], 2, 'codex');
    assert.equal(enrolled.state, 'action_required');
    assert.deepEqual(enrolled.data.selected_agents, ['codex']);
    assert.ok(
      enrolled.findings.some((row: { code: string }) => row.code === 'SETUP_CODEX_PLUGIN_HANDOFF'),
    );
    assert.ok(
      enrolled.findings.some(
        (row: { code: string }) => row.code === 'CODEX_PLUGIN_ENABLED_HOOK_UNPROVEN',
      ),
    );
    const home = path.dirname(fixture.unselectedConfig);
    const response = await discoverCodexResources(
      binary,
      home,
      fixture.project,
      'skills/list',
      options.env,
    );
    const skillPath = realpathSync(path.join(installation, 'skills/explain/SKILL.md'));
    assert.ok(
      response.result.data.some(row =>
        row.skills?.some(skill => skill.enabled && realpathSync(skill.path) === skillPath),
      ),
    );
    this.sibling = { installation, config: readFileSync(fixture.config) };
  },
);

When(
  'Safeword uninstalls one host integration',
  { timeout: 180_000 },
  function (this: SelectionWorld) {
    const fixture = this.selection;
    assert.ok(fixture && this.sibling);
    const plan = fixture.run('uninstall', [], 2, 'codex');
    assert.equal(plan.state, 'action_required');
    assert.ok(plan.data.plan?.id, JSON.stringify(plan));
    const removed = fixture.run('uninstall', ['--yes', '--plan', plan.data.plan.id], 0, 'codex');
    assert.equal(removed.state, 'changed');
    assert.equal(existsSync(this.sibling.installation), false);
  },
);

Then(
  'the remaining host still loads its contracted resources and the project knowledge is preserved',
  { timeout: 120_000 },
  function (this: SelectionWorld) {
    const fixture = this.selection;
    assert.ok(fixture && this.sibling);
    assert.deepEqual(readFileSync(fixture.config), this.sibling.config);
    assert.equal(readFileSync(path.join(fixture.project, note), 'utf8'), noteContents);
    const { data } = fixture.run('conformance');
    assert.equal(data.conformant, true);
    assert.equal(data.capture.native_activation.event, 'pre_tool');
    assert.ok(
      data.capture.registrations.some(
        (row: { id: string; state: string }) =>
          row.id === 'safeword-explain' && row.state === 'active',
      ),
    );
  },
);
