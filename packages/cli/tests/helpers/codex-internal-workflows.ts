import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as pollInterval } from 'node:timers/promises';

import { stringify as stringifyToml } from 'smol-toml';
import { parse } from 'yaml';

import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import type { CodexGuardFixture } from './codex-native-continuation.js';
import { assertMatchingTree } from './codex-plugin-package.js';

interface ProvisionedFixture extends CodexGuardFixture {
  hookManifestSha256: string;
  packageManifestSha256: string;
  trustDeadline?: number;
  normalTrustQualification?: boolean;
}
export interface HookObservation {
  eventName: string;
  sourcePath: string;
  enabled: boolean;
  trustStatus: string;
  currentHash?: string;
}
export interface PickerObservation {
  method: 'automated-native-tui';
  queries: { query: string; offered: boolean; output: string }[];
}
const repo = nodePath.resolve(import.meta.dirname, '../../../..');
const digest = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
export function codexWorkflowTemporaryBase(
  platform: NodeJS.Platform = process.platform,
  temporaryDirectory = tmpdir(),
): string {
  return platform === 'darwin' ? '/private/tmp' : realpathSync(temporaryDirectory);
}

export function bundleInventory(root: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() || entry.isSymbolicLink())
      .map(entry => {
        const file = nodePath.join(entry.parentPath, entry.name);
        return [
          nodePath.relative(root, file),
          entry.isSymbolicLink() ? `link:${readlinkSync(file)}` : digest(file),
        ];
      }),
  );
}
const save = (file: string, value: unknown): void => {
  writeFileSync(file, `${JSON.stringify(value, undefined, 2)}\n`);
};

export function nativeWorkflowEnvironment(profile: string): NodeJS.ProcessEnv {
  const environment = {
    ...process.env,
    CODEX_HOME: profile,
    SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(profile, 'review-keys'),
  };
  for (const key of [
    'SAFEWORD_CLI',
    'SAFEWORD_PLUGIN_CLI',
    'SAFEWORD_PLUGIN_RUNTIME',
    'CLAUDE_PLUGIN_ROOT',
    'CLAUDE_PROJECT_DIR',
  ])
    Reflect.deleteProperty(environment, key);
  return environment;
}

/** Require all actual controls before interpreting the product assertion. */
export function assertInternalPicker(observation: PickerObservation): void {
  assert.equal(observation.method, 'automated-native-tui');
  assert.deepEqual(
    observation.queries.map(query => query.query),
    ['$safeword:bdd', '$safeword:explain', '$safeword:testing'],
    'HOST_CONTRACT_PROOF_UNAVAILABLE: public controls must precede internal observation',
  );
  for (const name of ['bdd', 'explain']) {
    const control = observation.queries.find(query => query.query === `$safeword:${name}`);
    assert.ok(control?.offered, `HOST_CONTRACT_PROOF_UNAVAILABLE: missing public ${name}`);
    assert.match(
      control.output,
      name === 'bdd'
        ? /\bbdd\s*\(safeword\)\s*\[Skill\]/u
        : /\bexplain\s*\(safeword\)\s*\[Skill\]/u,
    );
  }
  const testing = observation.queries.find(query => query.query === '$safeword:testing');
  assert.ok(testing);
  if (testing.offered) {
    assert.match(testing.output, /\btesting\s*\(safeword\)\s*\[Skill\]/u);
    assert.fail('INTERNAL_WORKFLOW_VISIBLE: actual native selector offers internal testing');
  }
  assert.match(
    testing.output,
    /no\s*matches/iu,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: no absence observation',
  );
}

export function assertPickerCanonicalSettings(canonicalRoot: string): void {
  const settings = Object.fromEntries(
    ['testing', 'bdd', 'explain'].map(name => {
      const source = readFileSync(nodePath.join(canonicalRoot, name, 'SKILL.md'), 'utf8');
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(source);
      assert.ok(frontmatter, 'HOST_CONTRACT_PROOF_UNAVAILABLE: missing canonical settings');
      const value = parse(frontmatter[1] ?? '') as Record<string, unknown>;
      return [name, value];
    }),
  );
  assert.equal(
    settings.testing?.['user-invocable'],
    false,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: testing is not internal',
  );
  assert.notEqual(
    settings.bdd?.['user-invocable'],
    false,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: BDD is not public',
  );
  assert.notEqual(
    settings.explain?.['user-invocable'],
    false,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: explain is not public',
  );
  assert.equal(
    settings.explain?.['disable-model-invocation'],
    true,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: explain is not manual-only',
  );
}

export async function nativeHooks(binary: string, profile: string, project: string) {
  const child = spawn(
    binary,
    ['--enable', 'hooks', '--enable', 'plugins', 'app-server', '--stdio'],
    {
      cwd: project,
      env: nativeWorkflowEnvironment(profile),
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  child.stderr.resume();
  const timer = setTimeout(() => child.kill(), 30_000);
  const send = (value: unknown): void => {
    child.stdin.write(`${JSON.stringify(value)}\n`);
  };
  try {
    send({
      id: 1,
      method: 'initialize',
      params: {
        clientInfo: { name: 'internal_workflow_proof', version: '0.0.1' },
        capabilities: { experimentalApi: true },
      },
    });
    const lines = createInterface({ input: child.stdout });
    for await (const line of lines) {
      const response = JSON.parse(line) as {
        id?: number;
        error?: unknown;
        result?: { data: { hooks: HookObservation[]; errors: unknown[]; warnings: unknown[] }[] };
      };
      assert.equal(response.error, undefined, 'HOST_CONTRACT_PROOF_UNAVAILABLE: hook discovery');
      if (response.id === 1) {
        send({ method: 'initialized', params: {} });
        send({ id: 2, method: 'hooks/list', params: { cwds: [project] } });
      } else if (response.id === 2) {
        const data = response.result?.data[0];
        assert.ok(data);
        assert.deepEqual(data.errors, []);
        assert.deepEqual(data.warnings, []);
        return data.hooks;
      }
    }
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: incomplete native hooks response');
  } finally {
    clearTimeout(timer);
    child.stdin.end();
    child.kill();
  }
}

function announceNativeTrust(
  fixture: CodexGuardFixture,
  deadline: number | undefined,
  qualificationFile: string | undefined,
): number {
  const effectiveDeadline = qualificationFile ? Date.now() + 300_000 : deadline;
  assert.ok(
    effectiveDeadline && Date.now() < effectiveDeadline,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: exact prepared fixture requires native hook trust',
  );
  const pending = qualificationFile ? { ...fixture, trustDeadline: effectiveDeadline } : fixture;
  console.log(`CODEX_NATIVE_TRUST_PENDING ${JSON.stringify(pending)}`);
  return effectiveDeadline;
}

/** Observe the SAME normally installed package while root arranges native review. */
export async function requireCodexNativeTrust(
  fixture: CodexGuardFixture,
  candidate: string,
  deadline?: number,
  qualificationFile?: string,
): Promise<HookObservation[]> {
  const root = realpathSync(fixture.root);
  assert.equal(
    realpathSync(fixture.profile),
    nodePath.join(root, 'profile'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: prepared profile differs',
  );
  assert.equal(
    realpathSync(fixture.project),
    nodePath.join(root, 'project'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: prepared project differs',
  );
  const installed = realpathSync(fixture.installedPath);
  assert.ok(installed.startsWith(`${realpathSync(fixture.profile)}/plugins/cache/`));
  let announced = false;
  let reviewDeadline = deadline;
  const observations: { hooks: HookObservation[]; ready: boolean }[] = [];
  for (;;) {
    assertMatchingTree(candidate, installed);
    assert.equal(
      existsSync(nodePath.join(installed, 'plugin.json')),
      false,
      'CODEX_NATIVE_CONTAINER_SUPPRESSED',
    );
    const hooks = await nativeHooks(fixture.binary, fixture.profile, fixture.project);
    assert.deepEqual(
      hooks.map(row => row.eventName).toSorted((a, b) => a.localeCompare(b)),
      ['sessionStart', 'userPromptSubmit', 'preToolUse', 'postToolUse', 'stop'].toSorted((a, b) =>
        a.localeCompare(b),
      ),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Codex hook inventory differs',
    );
    for (const hook of hooks)
      assert.equal(
        realpathSync(hook.sourcePath),
        nodePath.join(installed, 'hooks.json'),
        'CODEX_NATIVE_HOOK_SOURCE_MISMATCH',
      );
    assertMatchingTree(candidate, installed);
    const ready = hooks.every(hook => hook.enabled && hook.trustStatus === 'trusted');
    if (qualificationFile) {
      observations.push({ hooks, ready });
      save(qualificationFile, {
        fixture,
        candidate,
        package: bundleInventory(candidate),
        observations,
      });
    }
    if (ready) {
      if (qualificationFile)
        assert.ok(
          observations.some(row => !row.ready && row.hooks.every(hook => hook.enabled)),
          'HOST_CONTRACT_PROOF_UNAVAILABLE: normal trust qualification observed no initial refusal',
        );
      return hooks;
    }
    if (announced) {
      assert.ok(
        reviewDeadline && Date.now() < reviewDeadline,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: exact prepared fixture requires native hook trust',
      );
    } else {
      reviewDeadline = announceNativeTrust(fixture, reviewDeadline, qualificationFile);
      announced = true;
    }
    await pollInterval(1000);
  }
}

/** Test driver only: real native UI; no procedure or permission implementation. */
export class CodexInternalWorkflowActor {
  private readonly originalConfig: string;
  private readonly originalRuntime: string;
  private trustPreparations = 0;
  private readonly originalBundle: Record<string, string>;
  private observation?: PickerObservation;
  protected readonly fixture: ProvisionedFixture;
  protected readonly profile: string;
  protected readonly project: string;
  protected installed = '';
  protected before: HookObservation[] = [];
  readonly artifacts: string;

  constructor(fixtureFile: string, identityFile: string) {
    this.fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as ProvisionedFixture;
    const root = realpathSync(this.fixture.root);
    assert.ok(
      root.startsWith(`${codexWorkflowTemporaryBase()}/`) &&
        nodePath.basename(root).startsWith('codex-guard-'),
    );
    assert.equal(realpathSync(this.fixture.profile), nodePath.join(root, 'profile'));
    assert.ok(
      realpathSync(this.fixture.installedPath).startsWith(`${root}/profile/plugins/cache/`),
    );
    const identity = JSON.parse(readFileSync(identityFile, 'utf8')) as {
      runtimeSha256: string;
      originalManifest: string;
    };
    this.originalRuntime = digest(nodePath.join(this.fixture.installedPath, 'runtime/cli.js'));
    this.originalBundle = bundleInventory(this.fixture.installedPath);
    assert.equal(
      this.originalRuntime,
      identity.runtimeSha256,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: provisioning runtime changed',
    );
    assert.equal(
      digest(nodePath.join(this.fixture.installedPath, 'hooks.json')),
      identity.originalManifest,
    );
    assert.equal(identity.originalManifest, this.fixture.hookManifestSha256);
    assert.equal(
      digest(nodePath.join(this.fixture.installedPath, '.codex-plugin/plugin.json')),
      this.fixture.packageManifestSha256,
    );
    this.originalConfig = readFileSync(nodePath.join(this.fixture.profile, 'config.toml'), 'utf8');
    this.artifacts = mkdtempSync(nodePath.join(root, 'internal-workflows-'));
    this.profile = nodePath.join(this.artifacts, 'profile');
    this.project = nodePath.join(this.artifacts, 'project');
    mkdirSync(this.profile);
    mkdirSync(this.project);
    console.log(`Native workflow artifacts: ${this.artifacts}`);
  }

  protected command(
    program: string,
    args: string[],
    label: string,
    cwd = this.project,
    timeout = 240_000,
  ): string {
    const result = spawnSync(program, args, {
      cwd,
      env: nativeWorkflowEnvironment(this.profile),
      encoding: 'utf8',
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    });
    writeFileSync(nodePath.join(this.artifacts, `${label}.stdout`), result.stdout ?? '');
    writeFileSync(nodePath.join(this.artifacts, `${label}.stderr`), result.stderr ?? '');
    assert.equal(result.error, undefined, `HOST_CONTRACT_PROOF_UNAVAILABLE: ${label} process`);
    assert.equal(
      result.status,
      0,
      `HOST_CONTRACT_PROOF_UNAVAILABLE: ${label} exit ${result.status}`,
    );
    return result.stdout;
  }

  async prepare(canonicalRepo = repo): Promise<void> {
    assertPickerCanonicalSettings(nodePath.join(canonicalRepo, 'packages/cli/templates/skills'));
    // This owned fixture pins its binary; do not allow an update prompt to drive keys.
    writeFileSync(
      nodePath.join(this.profile, 'config.toml'),
      stringifyToml({ check_for_update_on_startup: false }),
    );
    copyFileSync(
      nodePath.join(this.fixture.profile, 'auth.json'),
      nodePath.join(this.profile, 'auth.json'),
    );
    chmodSync(nodePath.join(this.profile, 'auth.json'), 0o600);
    assert.equal(
      this.command(this.fixture.binary, ['--version'], 'version').trim(),
      `codex-cli ${hostReleases.codex.version}`,
    );
    const marketplace = nodePath.join(this.artifacts, 'marketplace');
    const candidate = nodePath.join(marketplace, 'plugin');
    const version = (
      JSON.parse(readFileSync(nodePath.join(repo, 'packages/cli/package.json'), 'utf8')) as {
        version: string;
      }
    ).version;
    this.generateCandidate(canonicalRepo, candidate, version);
    assert.equal(digest(nodePath.join(candidate, 'hooks.json')), this.fixture.hookManifestSha256);
    mkdirSync(nodePath.join(marketplace, '.agents/plugins'), { recursive: true });
    save(nodePath.join(marketplace, '.agents/plugins/marketplace.json'), {
      name: 'safeword-contract-test',
      owner: { name: 'Safeword isolated fixture' },
      plugins: [
        {
          name: 'safeword',
          source: { source: 'local', path: './plugin' },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
          category: 'Developer Tools',
        },
      ],
    });
    this.command(
      this.fixture.binary,
      ['plugin', 'marketplace', 'add', marketplace, '--json'],
      'marketplace',
    );
    this.command(
      this.fixture.binary,
      ['plugin', 'add', 'safeword@safeword-contract-test', '--json'],
      'install',
    );
    this.installed = nodePath.join(
      this.profile,
      'plugins/cache/safeword-contract-test/safeword',
      version,
    );
    assertMatchingTree(candidate, this.installed);
    this.before = await this.requirePreparedTrust(candidate);
    assert.deepEqual(
      this.before.map(hook => hook.eventName).toSorted((a, b) => a.localeCompare(b)),
      ['postToolUse', 'preToolUse', 'sessionStart', 'stop', 'userPromptSubmit'],
    );
    for (const hook of this.before) {
      assert.equal(hook.enabled, true);
      if (!this.bypassesPersistedTrust()) assert.equal(hook.trustStatus, 'trusted');
      assert.equal(
        realpathSync(hook.sourcePath),
        nodePath.join(realpathSync(this.installed), 'hooks.json'),
      );
    }
    save(nodePath.join(this.artifacts, 'identity.json'), {
      binary: realpathSync(this.fixture.binary),
      profile: this.profile,
      project: this.project,
      candidate,
      installed: this.installed,
      runtimeSha256: digest(nodePath.join(this.installed, 'runtime/cli.js')),
      originalRuntimeSha256: this.originalRuntime,
      hooks: this.before,
    });
  }

  protected generateCandidate(canonicalRepo: string, candidate: string, version: string): void {
    this.command(
      nodePath.join(repo, 'scripts/dev'),
      [
        'bun',
        nodePath.join(canonicalRepo, 'packages/cli/scripts/generate-codex-plugin.ts'),
        '--version',
        version,
        '--output',
        candidate,
      ],
      'generate',
    );
  }

  protected bypassesPersistedTrust(): boolean {
    return false;
  }

  protected requirePreparedTrust(candidate: string): Promise<HookObservation[]> {
    const phase = ['A', 'B'][this.trustPreparations++];
    if (this.fixture.normalTrustQualification) {
      assert.ok(phase, 'HOST_CONTRACT_PROOF_UNAVAILABLE: excess normal trust stage');
      assert.equal(
        this.command(this.fixture.binary, ['--version'], `trust-${phase}-version`).trim(),
        `codex-cli ${hostReleases.codex.version}`,
      );
    }
    return requireCodexNativeTrust(
      {
        root: this.artifacts,
        profile: this.profile,
        project: this.project,
        binary: this.fixture.binary,
        installedPath: this.installed,
      },
      candidate,
      this.fixture.trustDeadline,
      this.fixture.normalTrustQualification
        ? nodePath.join(this.artifacts, `normal-trust-${phase}.json`)
        : undefined,
    );
  }

  protected pickerModeArguments(): string[] {
    return [];
  }

  inspectPicker(): void {
    this.command(
      'python3',
      [
        nodePath.join(repo, 'packages/cli/tests/helpers/codex-workflow-picker.py'),
        this.fixture.binary,
        this.artifacts,
        ...this.pickerModeArguments(),
      ],
      'picker',
    );
    this.observation = JSON.parse(
      readFileSync(nodePath.join(this.artifacts, 'picker-observations.json'), 'utf8'),
    ) as PickerObservation;
  }

  assertPicker(): void {
    assert.ok(this.observation, 'HOST_CONTRACT_PROOF_UNAVAILABLE: picker was not observed');
    assertInternalPicker(this.observation);
  }

  async preserve(): Promise<void> {
    const bindings = await this.preservedBindings();
    assert.equal(
      readFileSync(nodePath.join(this.fixture.profile, 'config.toml'), 'utf8'),
      this.originalConfig,
    );
    assert.equal(
      digest(nodePath.join(this.fixture.installedPath, 'runtime/cli.js')),
      this.originalRuntime,
    );
    assert.deepEqual(bundleInventory(this.fixture.installedPath), this.originalBundle);
    assert.equal(
      digest(nodePath.join(this.fixture.installedPath, 'hooks.json')),
      this.fixture.hookManifestSha256,
    );
    save(nodePath.join(this.artifacts, 'preservation.json'), {
      originalConfigUnchanged: true,
      originalRuntimeUnchanged: true,
      originalBundleUnchanged: true,
      ...bindings,
    });
  }

  protected async preservedBindings(expected = this.before): Promise<Record<string, unknown>> {
    assert.deepEqual(await nativeHooks(this.fixture.binary, this.profile, this.project), expected);
    return { fiveTrustedBindingsUnchanged: true };
  }
}
