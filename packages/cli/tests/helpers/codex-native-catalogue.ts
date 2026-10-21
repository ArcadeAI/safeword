import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { parseShellWords } from '../../templates/hooks/lib/shell-segments.js';
import type { CodexGuardFixture } from './codex-native-continuation.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { observeExactHostVersion } from './host-contract-version.js';
import { observedHelperProgram } from './native-helper-command.js';

/** Resolve only the declared packaged runtime and the installed workflow command. */
export function catalogueHelperRuntime(
  skill: string,
  skillFile: string,
  expectedRuntime: string,
): string {
  const link = /\[the bundled Safeword runtime\]\(([^)]+)\)/u.exec(skill)?.[1];
  assert.ok(link, 'NATIVE_HELPER_ORIGIN_MISMATCH: no declared bundled runtime');
  const runtime = nodePath.resolve(nodePath.dirname(skillFile), link);
  assert.equal(runtime, expectedRuntime, 'NATIVE_HELPER_ORIGIN_MISMATCH: declared runtime changed');
  const script = /```bash\n([\s\S]*?)```/u.exec(skill)?.[1];
  assert.ok(script, 'NATIVE_HELPER_ORIGIN_MISMATCH: no workflow helper block');
  const resolved = observedHelperProgram(`SAFEWORD_PLUGIN_RUNTIME="${runtime}"; ${script}`);
  assert.equal(resolved, runtime, 'NATIVE_HELPER_ORIGIN_MISMATCH: broken workflow command');
  return runtime;
}
import { createNativeCatalogueProbe, type NativeCatalogueProbe } from './native-catalogue-probe.js';

const execute = promisify(execFile);

/** Same canonical catalogue probe as Cursor, installed by the real Codex CLI. */
export class CodexNativeCatalogueActor {
  private readonly root: string;
  private readonly profile: string;
  private readonly project: string;
  private probe?: NativeCatalogueProbe;
  private installed = '';
  private events = '';

  constructor(private readonly fixture: CodexGuardFixture) {
    this.root = mkdtempSync(nodePath.join(fixture.root, 'codex-catalogue-'));
    this.profile = nodePath.join(this.root, 'profile');
    this.project = nodePath.join(this.root, 'project');
  }

  private environment(): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = { ...process.env, CODEX_HOME: this.profile };
    delete environment.SAFEWORD_CLI;
    return environment;
  }

  private async command(args: string[]): Promise<string> {
    const pending = execute(this.fixture.binary, args, {
      cwd: this.project,
      env: this.environment(),
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    pending.child.stdin?.end();
    const result = await pending;
    return result.stdout;
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    assert.equal(host, 'Codex');
    assert.equal(runtime, 'CLI');
    assert.equal(version, '0.160.0');
    mkdirSync(this.profile);
    mkdirSync(this.project);
    assert.equal(
      observeExactHostVersion(version, await this.command(['--version'])).state,
      'verified',
    );
    // Only the explicitly provisioned disposable profile's auth is reused.
    copyFileSync(
      nodePath.join(this.fixture.profile, 'auth.json'),
      nodePath.join(this.profile, 'auth.json'),
    );
    await execute('/bin/chmod', ['600', nodePath.join(this.profile, 'auth.json')]);
    this.probe = await createNativeCatalogueProbe(this.root);
    const registry = nodePath.join(this.root, '.agents/plugins');
    mkdirSync(registry, { recursive: true });
    writeFileSync(
      nodePath.join(registry, 'marketplace.json'),
      JSON.stringify({
        name: 'safeword-contract-test',
        owner: { name: 'Safeword isolated fixture' },
        plugins: [
          {
            name: 'safeword',
            source: { source: 'local', path: './candidate' },
            category: 'Developer Tools',
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
          },
        ],
      }),
    );
    await this.command(['plugin', 'marketplace', 'add', this.root]);
    const installation = JSON.parse(
      await this.command(['plugin', 'add', 'safeword@safeword-contract-test', '--json']),
    ) as { installedPath: string };
    this.installed = realpathSync(installation.installedPath);
    assert.ok(this.installed.startsWith(`${realpathSync(this.profile)}/plugins/cache/`));
    assertMatchingTree(this.probe.packageRoot, this.installed);
    mkdirSync(nodePath.join(this.project, '.host-contract'));
    mkdirSync(nodePath.join(this.project, '.safeword'));
    writeFileSync(
      nodePath.join(this.project, '.safeword/SAFEWORD.md'),
      'Synthetic catalogue probe project.\n',
    );
    // A working helper is a prerequisite, not a replacement native invocation.
    await execute(
      'bun',
      [
        nodePath.join(this.installed, 'runtime/cli.js'),
        'project',
        'runtime',
        'audit-principle-trace',
        this.project,
      ],
      { cwd: this.project, env: this.environment() },
    );
    const artifact = nodePath.join(this.project, '.host-contract/native-helper.json');
    assert.equal(JSON.parse(readFileSync(artifact, 'utf8')).marker, this.probe.helperMarker);
    rmSync(artifact);
    console.log(`Codex native catalogue evidence: ${this.root}`);
  }

  confirmCanonicalProbe(): void {
    assert.ok(this.probe);
    assert.ok(
      readFileSync(nodePath.join(this.installed, 'skills/explain/SKILL.md'), 'utf8').includes(
        this.probe.workflowMarker,
      ),
    );
    assert.equal(
      existsSync(nodePath.join(this.project, '.host-contract/native-helper.json')),
      false,
    );
  }

  async invokeWorkflow(): Promise<void> {
    this.events = await this.command([
      'exec',
      '--json',
      '--ephemeral',
      '--skip-git-repo-check',
      '-s',
      'workspace-write',
      '-c',
      'approval_policy="never"',
      '-m',
      'gpt-5.6-terra',
      '$safeword:explain Use only this installed workflow. Follow its packaged guide and helper instructions and report the requested markers. For native command observation, run the helper in its own shell call: assign SAFEWORD_PLUGIN_RUNTIME to the resolved literal absolute path and PROJECT_DIR="$PWD", then use the workflow helper command unchanged. Do not use command substitutions in that helper call. Do no other work.',
    ]);
    writeFileSync(nodePath.join(this.root, 'host-events.jsonl'), this.events);
  }

  assertPackagedResult(): void {
    assert.ok(this.probe);
    const probe = this.probe;
    const skillFile = nodePath.join(this.installed, 'skills/explain/SKILL.md');
    const declaredRuntime = catalogueHelperRuntime(
      readFileSync(skillFile, 'utf8'),
      skillFile,
      nodePath.join(this.installed, 'runtime/cli.js'),
    );
    const rows = this.events
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            type: string;
            item?: {
              type: string;
              command?: string;
              aggregated_output?: string;
              exit_code?: number;
            };
          },
      );
    assert.equal(rows.at(-1)?.type, 'turn.completed');
    assert.ok(
      this.events.includes(this.probe.workflowMarker),
      'NATIVE_CATALOGUE_MISSING: workflow marker absent',
    );
    assert.ok(
      this.events.includes(this.probe.guideMarker),
      'NATIVE_CATALOGUE_MISSING: guide marker absent',
    );
    const executions = rows.filter(
      row =>
        row.type === 'item.completed' &&
        row.item?.type === 'command_execution' &&
        row.item.exit_code === 0 &&
        row.item.aggregated_output?.includes(probe.helperMarker),
    );
    const programs = executions
      .map(row => observedHelperProgram(parseShellWords(row.item?.command ?? '').at(-1) ?? ''))
      .filter(program => program !== undefined);
    assert.ok(
      programs.length,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no unambiguous native helper command',
    );
    assert.ok(
      programs.includes(declaredRuntime),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper ignored the workflow binding',
    );
    const record = JSON.parse(
      readFileSync(nodePath.join(this.project, '.host-contract/native-helper.json'), 'utf8'),
    ) as { marker: string; origin: string; runtime: string };
    assert.equal(record.marker, this.probe.helperMarker);
    assert.equal(realpathSync(record.runtime), nodePath.join(this.installed, 'runtime/cli.js'));
    assert.equal(
      realpathSync(record.origin),
      nodePath.join(this.installed, 'templates/hooks/audit-principle-trace.ts'),
    );
    assertMatchingTree(this.probe.packageRoot, this.installed);
  }
}
