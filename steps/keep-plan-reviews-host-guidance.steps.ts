import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const packageRoot = path.resolve(import.meta.dirname, '../packages/cli');
interface HostGuidanceState {
  root: string;
  agent: 'codex' | 'claude' | 'opencode';
  surface: string;
  guidance?: string;
}
const states = new WeakMap<SafewordWorld, HostGuidanceState>();

function assertAdvisory(guidance: string, surface: string): void {
  assert.ok(
    guidance
      .split(/[.!?]\s/u)
      .some(sentence => sentence.includes(surface) && /\badvisory\b/u.test(sentence)),
    guidance,
  );
  assert.match(guidance, /Do not claim[^.]{0,100}planning review or approval[^.]{0,80}there/su);
  for (const sentence of guidance.split(/[.!?]\s/u)) {
    if (sentence.includes(surface)) {
      if (!/Do not claim/u.test(sentence)) {
        assert.doesNotMatch(
          sentence,
          /\b(?:enforc\w*|authoritativ\w*|approv\w*|gated|review(?:s|ed)?)\b/iu,
        );
      }
    }
  }
}

function setup(world: SafewordWorld, surface: string, agent: HostGuidanceState['agent']): void {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-planning-host-guidance-'));
  mkdirSync(path.join(root, 'project'));
  writeFileSync(
    path.join(root, 'project/package.json'),
    '{"name":"host-guidance","private":true}\n',
  );
  states.set(world, { root, agent, surface });
}

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) rmSync(state.root, { recursive: true, force: true });
  states.delete(this);
});

Given(
  'repository instructions are generated for use by local Codex and may be read by Codex Cloud',
  function (this: SafewordWorld) {
    setup(this, 'Codex Cloud', 'codex');
  },
);

Given(
  'the OpenCode profile plugin is read from Desktop where native lifecycle hooks are unavailable',
  function (this: SafewordWorld) {
    setup(this, 'OpenCode Desktop', 'opencode');
  },
);

Given(
  /^planning guidance is generated for (local Claude Code|OpenCode CLI)$/,
  function (this: SafewordWorld, surface: string) {
    setup(this, surface, surface === 'local Claude Code' ? 'claude' : 'opencode');
  },
);

When(
  /^the Safeword CLI reconciles (?:the installed repository guidance|the installed OpenCode profile guidance|that installed guidance) through real project configuration$/,
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    const project = path.join(state.root, 'project');
    const environment = {
      ...process.env,
      CODEX_HOME: path.join(state.root, 'codex'),
      OPENCODE_CONFIG_DIR: path.join(state.root, 'opencode'),
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_SKIP_SKILLS: '1',
    };
    if (state.agent === 'codex') {
      mkdirSync(environment.CODEX_HOME);
      for (const args of [
        ['plugin', 'marketplace', 'add', path.resolve(packageRoot, '../..'), '--json'],
        ['plugin', 'add', 'safeword@safeword', '--json'],
      ]) {
        const enrolled = spawnSync('codex', args, {
          encoding: 'utf8',
          timeout: 60_000,
          env: environment,
        });
        assert.equal(enrolled.status, 0, `${enrolled.stdout}\n${enrolled.stderr}`);
      }
    }
    const result = spawnSync(
      'bun',
      [
        path.join(packageRoot, 'src/cli.ts'),
        'install',
        `--agents=${state.agent}`,
        '--no-input',
        '--no-modify',
        ...(state.agent === 'opencode' ? ['--offline'] : []),
        '--json',
        '--cwd',
        project,
      ],
      {
        cwd: project,
        encoding: 'utf8',
        timeout: 60_000,
        env: environment,
      },
    );
    const output = JSON.parse(result.stdout) as { errors: unknown[]; changed: boolean };
    assert.deepEqual(output.errors, [], `${result.stdout}\n${result.stderr}`);
    assert.equal(output.changed, true);
    const entry =
      state.agent === 'opencode'
        ? path.join(state.root, 'opencode/skills/safeword-bdd/SKILL.md')
        : path.join(project, '.safeword/SAFEWORD.md');
    state.guidance = readFileSync(entry, 'utf8');
  },
);

Then(
  'it labels Codex Cloud execution advisory, claims neither review nor approval there, and directs authoritative planning to a supported gated surface',
  function (this: SafewordWorld) {
    const guidance = states.get(this)?.guidance ?? '';
    assertAdvisory(guidance, 'Codex Cloud');
    assert.throws(() =>
      assertAdvisory(
        `${guidance}\nCodex Cloud approves plans through the planning review gate.`,
        'Codex Cloud',
      ),
    );
    assert.match(guidance, /authoritative planning[^.]{0,100}supported gated surface/su);
  },
);

Then(
  'it labels Desktop execution advisory, claims neither review nor approval there, and names both OpenCode CLI and TUI as authoritative planning entry points',
  function (this: SafewordWorld) {
    const guidance = states.get(this)?.guidance ?? '';
    assertAdvisory(guidance, 'OpenCode Desktop');
    assert.throws(() =>
      assertAdvisory(
        `${guidance}\nPlanning approval is granted in OpenCode Desktop.`,
        'OpenCode Desktop',
      ),
    );
    assert.match(
      guidance,
      /planning review and approval are enforced[^.]{0,150}OpenCode CLI and TUI/su,
    );
  },
);

Then(
  'it states that planning review and approval are enforced there and does not label that surface advisory',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.guidance);
    const surface =
      state.surface === 'local Claude Code' ? 'local Claude Code' : 'OpenCode CLI and TUI';
    const enforced = /planning review and approval are enforced[^.]{0,200}/su.exec(
      state.guidance,
    )?.[0];
    assert.ok(enforced?.includes(surface), state.guidance);
    assert.doesNotMatch(enforced, /advisory/u);
    for (const sentence of state.guidance.split(/[.!?]\s/u)) {
      if (sentence.includes(surface)) assert.doesNotMatch(sentence, /\badvisory\b/u);
    }
  },
);
