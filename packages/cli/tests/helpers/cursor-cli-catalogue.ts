import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { createCursorCatalogueProbe, type CursorCatalogueProbe } from './cursor-catalogue-probe.js';
import { observedHelperProgram, requireNativeHelperExecution } from './cursor-cli-observations.js';
import { command } from './cursor-native-window.js';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');

const resourceDigest = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

/** Native CLI skill discovery plus observed packaged helper output. */
export class CursorCliCatalogueActor {
  private readonly root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-cli-catalogue-'));
  private readonly workspace = nodePath.join(this.root, 'workspace');
  private readonly extension = nodePath.join(this.root, 'native-extension');
  private probe?: CursorCatalogueProbe;
  private stdout = '';
  private readonly expectedResources = new Map<string, string>();

  constructor(private readonly executable: string) {}

  private environment(): NodeJS.ProcessEnv {
    return {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([name]) => !name.startsWith('CLAUDE_') && !name.startsWith('SAFEWORD_'),
        ),
      ),
      CURSOR_CONFIG_DIR: nodePath.join(this.root, 'profile'),
      CLAUDE_CONFIG_DIR: nodePath.join(this.root, 'foreign-claude'),
    };
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    assert.equal(host, 'Cursor');
    assert.equal(runtime, 'CLI');
    assert.ok(nodePath.isAbsolute(this.executable));
    const actualVersion = await command(this.executable, ['--version']);
    assert.equal(
      actualVersion.trim(),
      version,
      'CURSOR_CLI_UNAVAILABLE: catalogue exact version mismatch',
    );
    for (const directory of ['.cursor', '.safeword', '.host-contract'])
      mkdirSync(nodePath.join(this.workspace, directory), { recursive: true });
    writeFileSync(
      nodePath.join(this.workspace, '.safeword/SAFEWORD.md'),
      'Synthetic enrolled project.\n',
    );
    writeFileSync(
      nodePath.join(this.workspace, '.safeword/config.json'),
      JSON.stringify({
        autoUpgrade: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    this.probe = await createCursorCatalogueProbe(this.root);
    await command(
      'bun',
      [nodePath.join(cliRoot, 'scripts/generate-cursor-plugin.ts'), '--output', this.extension],
      {
        timeout: 120_000,
      },
    );
    writeFileSync(
      nodePath.join(this.workspace, '.cursor/cli.json'),
      JSON.stringify({
        permissions: {
          allow: [
            'Shell(bun)',
            'Shell(cd)',
            'Shell(export)',
            'Read(**)',
            `Read(${this.probe.packageRoot}/**)`,
          ],
          deny: [],
        },
      }),
    );
    // A valid supplied helper is a Given prerequisite, never a replacement When.
    await command(
      'bun',
      [
        nodePath.join(this.probe.packageRoot, 'runtime/cli.js'),
        'project',
        'runtime',
        'audit-principle-trace',
        this.workspace,
      ],
      {
        cwd: this.workspace,
        env: this.environment(),
      },
    );
    const artifact = nodePath.join(this.workspace, '.host-contract/native-helper.json');
    assert.equal(JSON.parse(readFileSync(artifact, 'utf8')).marker, this.probe.helperMarker);
    rmSync(artifact);
    assert.equal(existsSync(nodePath.join(this.workspace, '.cursor/hooks.json')), false);
    writeFileSync(
      nodePath.join(this.root, 'fixture.json'),
      JSON.stringify({
        host,
        version,
        runtime,
        workspace: this.workspace,
        extension: this.extension,
        core: this.probe.packageRoot,
      }),
    );
    for (const relative of [
      'runtime/cli.js',
      'skills/explain/SKILL.md',
      'skills/explain/references/HOST_CONTRACT_GUIDE.md',
      'templates/hooks/audit-principle-trace.ts',
    ]) {
      const file = nodePath.join(this.probe.packageRoot, relative);
      this.expectedResources.set(file, resourceDigest(file));
    }
  }

  confirmCanonicalProbe(): void {
    assert.ok(this.probe);
    assert.ok(
      readFileSync(
        nodePath.join(this.probe.packageRoot, 'skills/explain/SKILL.md'),
        'utf8',
      ).includes(this.probe.workflowMarker),
    );
    assert.equal(
      existsSync(nodePath.join(this.workspace, '.host-contract/native-helper.json')),
      false,
    );
  }

  async invokeWorkflow(): Promise<void> {
    assert.ok(this.probe);
    const args = [
      '--workspace',
      this.workspace,
      '--plugin-dir',
      this.probe.packageRoot,
      '--plugin-dir',
      this.extension,
      '--trust',
      '--print',
      '--output-format',
      'stream-json',
    ];
    if (process.env.SAFEWORD_CURSOR_CLI_MODEL)
      args.push('--model', process.env.SAFEWORD_CURSOR_CLI_MODEL);
    args.push(
      'Use the installed explain skill for the Safeword contract catalogue probe. Follow its packaged guide and helper instructions, then report the required markers. Do no other work.',
    );
    this.stdout = await command(this.executable, args, {
      cwd: this.workspace,
      env: this.environment(),
      timeout: 240_000,
    });
    writeFileSync(nodePath.join(this.root, 'stdout.jsonl'), this.stdout);
    console.log(`Cursor CLI catalogue evidence: ${this.root}`);
    requireNativeHelperExecution(this.stdout);
    for (const [file, digest] of this.expectedResources) {
      assert.ok(
        existsSync(file),
        'CURSOR_CLI_UNAVAILABLE: agent removed an installed probe resource',
      );
      assert.equal(
        resourceDigest(file),
        digest,
        'CURSOR_CLI_UNAVAILABLE: agent changed installed probe content',
      );
    }
  }

  assertPackagedResult(): void {
    assert.ok(this.probe);
    const probe = this.probe;
    assert.ok(
      this.stdout.includes(this.probe.workflowMarker),
      'NATIVE_CATALOGUE_MISSING: workflow marker absent',
    );
    assert.ok(
      this.stdout.includes(this.probe.guideMarker),
      'NATIVE_CATALOGUE_MISSING: packaged guide marker absent',
    );
    const shells = requireNativeHelperExecution(this.stdout);
    const runtime = realpathSync(nodePath.join(probe.packageRoot, 'runtime/cli.js'));
    assert.ok(
      shells.some(shell => {
        const program = observedHelperProgram(shell.args.command);
        return (
          program &&
          existsSync(program) &&
          realpathSync(program) === runtime &&
          shell.result?.success?.exitCode === 0 &&
          shell.result.success.stdout?.includes(probe.helperMarker)
        );
      }),
      'NATIVE_HELPER_ORIGIN_MISMATCH: exact packaged helper command and marker must share an actual Shell result',
    );
    const artifact = nodePath.join(this.workspace, '.host-contract/native-helper.json');
    assert.ok(existsSync(artifact), 'NATIVE_HELPER_ORIGIN_MISMATCH: helper artifact absent');
    const record = JSON.parse(readFileSync(artifact, 'utf8')) as {
      marker: string;
      origin: string;
      runtime?: string;
    };
    assert.equal(
      record.marker,
      this.probe.helperMarker,
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper marker changed',
    );
    assert.ok(
      record.runtime && existsSync(record.runtime),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper was not dispatched by the package runtime',
    );
    assert.equal(
      realpathSync(record.runtime),
      realpathSync(nodePath.join(probe.packageRoot, 'runtime/cli.js')),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper reentry runtime changed',
    );
    assert.ok(
      record.origin && existsSync(record.origin),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper origin missing',
    );
    assert.equal(
      realpathSync(record.origin),
      realpathSync(
        nodePath.join(this.probe.packageRoot, 'templates/hooks/audit-principle-trace.ts'),
      ),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper came from another package',
    );
  }
}
