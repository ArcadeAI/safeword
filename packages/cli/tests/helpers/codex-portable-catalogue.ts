import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';

import { VERSION } from '../../src/version.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { observeExactHostVersion } from './host-contract-version.js';

const executeFile = promisify(execFile);
const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

export interface CodexPortableFixtureConfig {
  binary: string;
  authenticatedFixtureProfile: string;
  runsDirectory: string;
}

/** Native root/extension selection and resource loading, never enforcement evidence. */
export class CodexPortableCatalogueActor {
  private readonly workflowMarker = `WORKFLOW_${randomUUID()}`;
  private readonly guideMarker = `GUIDE_${randomUUID()}`;
  private readonly overlayMarker = `OVERLAY_${randomUUID()}`;
  private expectedInterface: string | undefined;
  private observedInterface: string | undefined;
  private response = '';
  readonly runDirectory: string;

  constructor(private readonly config: CodexPortableFixtureConfig) {
    mkdirSync(config.runsDirectory, { recursive: true });
    this.runDirectory = mkdtempSync(nodePath.join(config.runsDirectory, 'portable-'));
  }

  private get profile(): string {
    return nodePath.join(this.runDirectory, 'profile');
  }
  private get project(): string {
    return nodePath.join(this.runDirectory, 'project');
  }
  private get marketplace(): string {
    return nodePath.join(this.runDirectory, 'marketplace');
  }
  private get environment(): NodeJS.ProcessEnv {
    return { ...process.env, CODEX_HOME: this.profile };
  }

  private async command(args: string[]): Promise<string> {
    const pending = executeFile(this.config.binary, args, {
      cwd: this.project,
      env: this.environment,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    // Codex appends piped stdin to a supplied prompt. Closing the unused pipe
    // is required before a noninteractive turn can start.
    pending.child.stdin?.end();
    const result = await pending;
    return result.stdout;
  }

  private async readNativePlugin(): Promise<string> {
    const child = spawn(this.config.binary, ['app-server', '--stdio'], {
      cwd: this.project,
      env: this.environment,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    const lines = createInterface({ input: child.stdout });
    const timer = setTimeout(() => {
      child.kill();
    }, 30_000);
    try {
      child.stdin.write(
        `${JSON.stringify({
          id: 1,
          method: 'initialize',
          params: {
            clientInfo: { name: 'safeword_contract_proof', version: '0.0.1' },
            capabilities: { experimentalApi: true },
          },
        })}\n`,
      );
      for await (const line of lines) {
        const message = JSON.parse(line) as {
          id?: number;
          error?: unknown;
          result?: { plugin: { summary: { interface: { displayName: string } } } };
        };
        assert.equal(message.error, undefined, 'Native plugin API must accept the request');
        if (message.id === 1) {
          child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
          child.stdin.write(
            `${JSON.stringify({
              id: 2,
              method: 'plugin/read',
              params: {
                marketplacePath: nodePath.join(
                  this.marketplace,
                  '.agents/plugins/marketplace.json',
                ),
                pluginName: 'safeword',
              },
            })}\n`,
          );
        } else if (message.id === 2) {
          assert.ok(message.result);
          return message.result.plugin.summary.interface.displayName;
        }
      }
      throw new Error('CODEX_SETUP_UNAVAILABLE: native plugin API ended without its result');
    } finally {
      clearTimeout(timer);
      lines.close();
      child.stdin.end();
      child.kill();
      writeFileSync(nodePath.join(this.runDirectory, 'app-server-stderr.txt'), stderr);
    }
  }

  async prepare(host: string): Promise<void> {
    assert.equal(host, 'Codex');
    assert.ok(nodePath.isAbsolute(this.config.binary));
    const targets = JSON.parse(
      readFileSync(
        nodePath.join(repoRoot, 'packages/cli/tests/fixtures/host-contract/targets.json'),
        'utf8',
      ),
    ) as {
      targets: { agent: string; version: string }[];
    };
    const target = targets.targets.find(row => row.agent === 'codex');
    assert.ok(target);
    mkdirSync(this.profile);
    mkdirSync(this.project);
    mkdirSync(this.marketplace);
    assert.equal(
      observeExactHostVersion(target.version, await this.command(['--version'])).state,
      'verified',
    );
    // Reuse only an explicitly provisioned test profile's native authentication.
    // Never read, print or include its contents in a review packet.
    copyFileSync(
      nodePath.join(this.config.authenticatedFixtureProfile, 'auth.json'),
      nodePath.join(this.profile, 'auth.json'),
    );
    await executeFile('/bin/chmod', ['600', nodePath.join(this.profile, 'auth.json')]);
    const candidate = nodePath.join(this.marketplace, 'plugin');
    await executeFile(
      nodePath.join(repoRoot, 'scripts/dev'),
      [
        'bun',
        'packages/cli/scripts/generate-codex-plugin.ts',
        '--version',
        VERSION,
        '--output',
        candidate,
        '--portable-core',
      ],
      { cwd: repoRoot, timeout: 180_000 },
    );
    const overlayPath = nodePath.join(candidate, '.codex-plugin/plugin.json');
    const overlay = JSON.parse(readFileSync(overlayPath, 'utf8')) as {
      interface: { displayName: string; developerName: string };
    };
    this.expectedInterface = overlay.interface.displayName;
    // Only the compatibility metadata conflicts. Do not add a root manifest or
    // repair the production generator's format/extension selection in this fixture.
    overlay.interface.displayName = this.overlayMarker;
    overlay.interface.developerName = 'OVERLAY_ONLY';
    writeFileSync(overlayPath, `${JSON.stringify(overlay)}\n`);
    const skill = nodePath.join(candidate, 'skills/explain');
    writeFileSync(
      nodePath.join(skill, 'SKILL.md'),
      [
        '---',
        'name: explain',
        'description: Isolated portable resource control.',
        '---',
        '',
        'Read [the packaged guide](HOST_CONTRACT_GUIDE.md).',
        'Return the workflow marker and actual guide marker. Do not write files or invoke other workflows.',
        `Workflow marker: ${this.workflowMarker}`,
        '',
      ].join('\n'),
    );
    writeFileSync(
      nodePath.join(skill, 'HOST_CONTRACT_GUIDE.md'),
      `Guide marker: ${this.guideMarker}\n`,
    );
    mkdirSync(nodePath.join(this.marketplace, '.agents/plugins'), { recursive: true });
    writeFileSync(
      nodePath.join(this.marketplace, '.agents/plugins/marketplace.json'),
      JSON.stringify({
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
      }),
    );
    await this.command(['plugin', 'marketplace', 'add', this.marketplace]);
    const installation = JSON.parse(
      await this.command(['plugin', 'add', 'safeword@safeword-contract-test', '--json']),
    ) as { installedPath: string };
    assert.equal(typeof installation.installedPath, 'string');
    const cache = realpathSync(installation.installedPath);
    const profile = realpathSync(this.profile);
    assert.ok(
      cache.startsWith(`${profile}${nodePath.sep}plugins${nodePath.sep}cache${nodePath.sep}`),
      'The native install must report its isolated profile cache',
    );
    assertMatchingTree(candidate, cache);
  }

  async load(): Promise<void> {
    this.observedInterface = await this.readNativePlugin();
    const output = nodePath.join(this.runDirectory, 'last-message.txt');
    const events = await this.command([
      'exec',
      '--json',
      '--ephemeral',
      '--skip-git-repo-check',
      '-s',
      'read-only',
      '-c',
      'approval_policy="never"',
      '-m',
      'gpt-5.6-terra',
      '-o',
      output,
      '$safeword:explain Load only this plugin workflow and its referenced guide. Return its requested markers. Do not write files or invoke any other workflow.',
    ]);
    writeFileSync(nodePath.join(this.runDirectory, 'host-events.jsonl'), events);
    this.response = readFileSync(output, 'utf8');
    assert.ok(
      this.response.includes(this.workflowMarker),
      'Native host must load the packaged workflow',
    );
    assert.ok(this.response.includes(this.guideMarker), 'Native host must read the packaged guide');
  }

  assertPortableSelection(): void {
    assert.ok(this.response.includes(this.workflowMarker));
    assert.ok(this.response.includes(this.guideMarker));
    assert.equal(
      this.observedInterface,
      this.expectedInterface,
      'CODEX_COMPATIBILITY_OVERLAY_FALLBACK: native readback selected conflicting compatibility metadata instead of the production portable root OpenAI extension',
    );
  }
}
