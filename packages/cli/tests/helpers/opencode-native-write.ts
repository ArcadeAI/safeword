import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { observeExactHostVersion } from './host-contract-version.js';
import type { openCodeScriptedModelFixture } from './opencode-native-driver.js';
import { openCodeModelFixture, runOpenCodeTurn } from './opencode-native-driver.js';

const execute = promisify(execFile);
const repo = nodePath.resolve(import.meta.dirname, '../../../..');

export interface OpenCodeNativeFixture {
  v1Binary: string;
  v2Binary: string;
  runsDirectory: string;
  v2CandidatePackage?: string;
}

/** Current production V1 delivery and isolated candidate V2 transport on real hosts. */
export class OpenCodeNativeWriteActor {
  private readonly root: string;
  private readonly project: string;
  private readonly profile: string;
  private readonly marker = `NATIVE_${randomUUID()}`;
  private version = '';
  private runtime: 'CLI' | 'TUI' = 'CLI';
  private binary = '';
  private disposition: 'allowed' | 'denied' = 'allowed';
  private target = '';
  private command = '';
  private attempts = 0;
  private toolResults = '';
  private bootstrap = false;
  private candidate = '';
  private readonly realBun = realpathSync(
    execFileSync('which', ['bun'], { encoding: 'utf8' }).trim(),
  );

  constructor(private readonly fixture: OpenCodeNativeFixture) {
    assert.ok(nodePath.isAbsolute(fixture.runsDirectory));
    this.root = realpathSync(mkdtempSync(nodePath.join(fixture.runsDirectory, 'opencode-native-')));
    this.project = nodePath.join(this.root, 'project');
    this.profile = nodePath.join(this.root, 'profile');
  }

  private environment(): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([name]) =>
            !name.startsWith('OPENCODE_') &&
            !name.startsWith('SAFEWORD_') &&
            !/(?:_API_KEY|_AUTH_TOKEN)$/u.test(name),
        ),
      ),
      PWD: this.project,
      INIT_CWD: this.project,
      HOME: nodePath.join(this.root, 'home'),
      OPENCODE_CONFIG_DIR: this.profile,
      XDG_CONFIG_HOME: nodePath.join(this.root, 'config'),
      XDG_DATA_HOME: nodePath.join(this.root, 'data'),
      XDG_CACHE_HOME: nodePath.join(this.root, 'cache'),
      XDG_STATE_HOME: nodePath.join(this.root, 'state'),
      OPENCODE_DISABLE_AUTOUPDATE: 'true',
      PATH: `${nodePath.join(this.root, 'bin')}:${process.env.PATH ?? ''}`,
      SAFEWORD_OBSERVER_REAL_BUN: this.realBun,
      SAFEWORD_OBSERVER_RUNTIME: nodePath.join(this.candidate, 'runtime/dispatch.js'),
      SAFEWORD_OBSERVER_LOG: nodePath.join(this.root, 'runtime-observations.jsonl'),
    };
    delete environment.SAFEWORD_CLI;
    return environment;
  }

  private prepareObserver(): void {
    const bin = nodePath.join(this.root, 'bin');
    mkdirSync(bin);
    const processObserver = nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/native-runtime-observer.mjs',
    );
    writeFileSync(
      nodePath.join(bin, 'bun'),
      `#!/bin/sh\nexec "${process.execPath}" "${processObserver}" "$@"\n`,
      { mode: 0o755 },
    );
    const observer = nodePath.join(this.root, 'observer');
    mkdirSync(observer);
    const log = JSON.stringify(nodePath.join(this.root, 'native-observations.jsonl'));
    writeFileSync(
      nodePath.join(observer, 'index.ts'),
      [
        'import { Plugin } from "@opencode/plugin";',
        'import { appendFileSync } from "node:fs";',
        'export default Plugin.define({id: "safeword-native-observer", async setup(ctx) {',
        String.raw`appendFileSync(${log}, JSON.stringify({setup:true, version:ctx.app.version})+"\n");`,
        String.raw`await ctx.session.hook("prompt", async event => { appendFileSync(${log}, JSON.stringify({prompt:event.prompt,session:await ctx.session.get({sessionID:event.sessionID})})+"\n"); });`,
        String.raw`await ctx.tool.hook("execute.before", async event => { const plugins = await ctx.plugin.list(); appendFileSync(${log}, JSON.stringify({tool:event.tool,input:event.input,session_id:event.sessionID,plugins:plugins.data})+"\n"); });`,
        '}});',
        '',
      ].join('\n'),
    );
  }

  private configureModel(url: string): void {
    const config: Record<string, unknown> = {
      model: 'fixture/model',
      small_model: 'fixture/model',
      enabled_providers: ['fixture'],
      provider: {
        fixture: {
          name: 'Isolated fixture',
          id: 'fixture',
          env: [],
          npm: '@ai-sdk/openai-compatible',
          options: { apiKey: 'synthetic-test-key', baseURL: url },
          models: {
            model: {
              id: 'fixture-model',
              name: 'Fixture Model',
              tool_call: true,
              limit: { context: 100_000, output: 10_000 },
            },
          },
        },
      },
    };
    const file = nodePath.join(this.project, 'opencode.json');
    assert.equal(
      existsSync(file),
      false,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: installer supplied a project config that the fixture must preserve',
    );
    writeFileSync(file, JSON.stringify(config));
  }

  private assertNativeAttempt(): void {
    assert.equal(
      this.attempts,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no unique native tool attempt',
    );
    assert.notEqual(
      this.toolResults,
      '[]',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no native tool result',
    );
    if (this.version === '2.0.32') {
      const observations = readFileSync(
        nodePath.join(this.root, 'native-observations.jsonl'),
        'utf8',
      )
        .trim()
        .split('\n')
        .map(
          line =>
            JSON.parse(line) as {
              setup?: boolean;
              version?: string;
              tool?: string;
              input?: { command?: string };
              plugins?: { source: { type: string; path?: string }; state: { status: string } }[];
            },
        );
      assert.ok(observations.some(row => row.setup && row.version === this.version));
      assert.equal(
        observations.filter(row => row.tool === 'shell' && row.input?.command === this.command)
          .length,
        1,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: no unique native V2 shell dispatch',
      );
      const dispatched = observations.find(row => row.tool === 'shell');
      assert.ok(
        dispatched?.plugins?.some(
          plugin =>
            plugin.source.type === 'local' &&
            plugin.source.path &&
            (plugin.source.path === this.candidate ||
              plugin.source.path.startsWith(`${this.candidate}/`)) &&
            plugin.state.status === 'active',
        ),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: candidate did not load in the native host',
      );
      assert.ok(this.fixture.v2CandidatePackage);
      assertMatchingTree(this.fixture.v2CandidatePackage, this.candidate);
    }
  }

  private assertCandidateDispatch(status: number): void {
    if (this.version !== '2.0.32') return;
    const file = nodePath.join(this.root, 'runtime-observations.jsonl');
    assert.ok(
      existsSync(file),
      'NATIVE_OPENCODE_V2_GUARD_MISSING: candidate did not call its shared runtime',
    );
    const dispatches = readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            args: string[];
            status: number;
            input: {
              cwd: string;
              session_id: string;
              hook_event_name: string;
              tool_name: string;
              tool_input: { command: string };
            };
          },
      );
    assert.equal(
      dispatches.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous shared-runtime dispatch',
    );
    const dispatch = dispatches[0];
    assert.ok(dispatch);
    assert.ok(dispatch.args.includes(nodePath.join(this.candidate, 'runtime/dispatch.js')));
    assert.equal(dispatch.status, status);
    assert.equal(realpathSync(dispatch.input.cwd), this.project);
    assert.equal(dispatch.input.hook_event_name, 'PreToolUse');
    assert.equal(dispatch.input.tool_name, 'Bash');
    assert.equal(dispatch.input.tool_input.command, this.command);
    const native = readFileSync(nodePath.join(this.root, 'native-observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { tool?: string; session_id?: string })
      .find(row => row.tool === 'shell');
    assert.equal(dispatch.input.session_id, native?.session_id);
  }

  async prepare(
    host: string,
    version: string,
    runtime: string,
    enrollment: 'automatic' | 'deferred' = 'automatic',
  ): Promise<void> {
    assert.ok(runtime === 'CLI' || runtime === 'TUI');
    assert.equal(host, version === '1.18.23' ? 'OpenCode V1' : 'OpenCode V2');
    assert.ok(['1.18.23', '2.0.32'].includes(version));
    this.version = version;
    this.runtime = runtime;
    this.binary = version === '1.18.23' ? this.fixture.v1Binary : this.fixture.v2Binary;
    assert.ok(nodePath.isAbsolute(this.binary));
    mkdirSync(this.project);
    mkdirSync(nodePath.join(this.root, 'home'));
    const observed = await execute(this.binary, ['--version'], {
      cwd: this.project,
      env: this.environment(),
    });
    assert.equal(observeExactHostVersion(version, observed.stdout).state, 'verified');
    const installed = await execute(
      'bun',
      [
        nodePath.join(repo, 'packages/cli/src/cli.ts'),
        'install',
        '--agents',
        'opencode',
        '--cwd',
        this.project,
        '--offline',
        '--no-input',
        '--no-modify',
        '--json',
      ],
      { cwd: repo, env: this.environment(), timeout: 120_000 },
    );
    writeFileSync(nodePath.join(this.root, 'installation.json'), installed.stdout);
    assert.equal(JSON.parse(installed.stdout).ok, true);
    const settingsFile = nodePath.join(this.project, '.safeword/config.json');
    const settings = JSON.parse(readFileSync(settingsFile, 'utf8')) as Record<string, unknown>;
    settings.autoUpgrade = false;
    settings.selfReport = { capture: false, surface: false, file: false };
    writeFileSync(settingsFile, JSON.stringify(settings));
    if (version === '2.0.32') {
      const source = this.fixture.v2CandidatePackage;
      assert.ok(
        source && nodePath.isAbsolute(source),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: explicitly built V2 candidate required',
      );
      const manifest = JSON.parse(readFileSync(nodePath.join(source, 'package.json'), 'utf8')) as {
        safewordBootstrap?: boolean;
      };
      this.bootstrap = manifest.safewordBootstrap === true;
      this.candidate = nodePath.join(this.root, 'candidate');
      cpSync(source, this.candidate, { recursive: true });
      assertMatchingTree(source, this.candidate);
      this.prepareObserver();
      if (enrollment === 'automatic') {
        // Register the independent observer first; a denied action cannot reach a
        // later execute.before observer. The real controller appends the candidate.
        writeFileSync(
          nodePath.join(this.profile, 'opencode.jsonc'),
          JSON.stringify({
            plugins: [nodePath.join(this.root, 'observer')],
          }),
        );
        const selected = installOpenCodeProfile(this.profile, {
          nativeV2: {
            projectDirectory: this.project,
            packageDirectory: this.candidate,
            epoch: 'native-contract-probe',
          },
        });
        assert.ok(
          selected.state === 'changed' || selected.state === 'healthy',
          'HOST_CONTRACT_PROOF_UNAVAILABLE: native checkout enrollment failed',
        );
      }
    }
    console.log(`OpenCode ${version} ${runtime} evidence: ${this.root}`);
  }

  setPolicy(disposition: 'allowed' | 'denied'): void {
    this.disposition = disposition;
    const relative =
      disposition === 'denied'
        ? '.project/tickets/sentinel-write/ticket.md'
        : 'allowed-sentinel.txt';
    this.target = nodePath.join(this.project, relative);
    mkdirSync(nodePath.dirname(this.target), { recursive: true });
    assert.equal(existsSync(this.target), false);
    this.command = `printf %s ${this.marker} > ${relative}`;
  }

  /** Share the owned native installation, model setup and process boundary across contract probes. */
  async runModelFixture(
    factory: (paths: {
      directory: string;
      project: string;
      candidate: string;
      profile: string;
      environment: NodeJS.ProcessEnv;
    }) => Promise<
      Awaited<ReturnType<typeof openCodeScriptedModelFixture>> & {
        prompt?: string;
        beforeTurn?: () => void;
      }
    >,
  ): Promise<void> {
    const model = await factory({
      directory: this.root,
      project: this.project,
      candidate: this.candidate,
      profile: this.profile,
      environment: this.environment(),
    });
    try {
      this.configureModel(model.url);
      model.beforeTurn?.();
      await runOpenCodeTurn({
        binary: this.binary,
        version: this.version,
        runtime: this.runtime,
        project: this.project,
        environment: this.environment(),
        finish: model.finish,
        directory: this.root,
        prompt: model.prompt,
      });
      this.attempts = model.attempts;
      this.toolResults = JSON.stringify(model.results);
    } finally {
      model.close();
    }
  }

  async attempt(): Promise<void> {
    await this.runModelFixture(({ directory }) => openCodeModelFixture(this.command, directory));
  }

  /** Setup contrast only; never substitutes for a passing contracted scenario. */
  assertAllowedControl(): void {
    this.assertNativeAttempt();
    assert.equal(this.disposition, 'allowed');
    assert.equal(readFileSync(this.target, 'utf8'), this.marker);
  }

  assertOutcome(): void {
    this.assertNativeAttempt();
    if (this.disposition === 'allowed') {
      assert.equal(
        this.bootstrap,
        false,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: bootstrap carrier cannot certify delivery',
      );
      this.assertCandidateDispatch(0);
      assert.equal(readFileSync(this.target, 'utf8'), this.marker, 'ALLOWED_SIDE_EFFECT_MISSING');
      return;
    }
    const failure =
      this.version === '2.0.32'
        ? 'NATIVE_OPENCODE_V2_GUARD_MISSING'
        : 'LEGACY_OPENCODE_GUARD_MISSING';
    assert.equal(existsSync(this.target), false, `${failure}: denied native write reached disk`);
    assert.equal(
      this.bootstrap,
      false,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: bootstrap carrier cannot certify a guard',
    );
    this.assertCandidateDispatch(2);
    assert.match(
      this.toolResults,
      /Safeword denied|Shell commands can't change/u,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no shared-policy denial result',
    );
  }
}
