import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { assertMatchingTree } from './codex-plugin-package.js';
import type { NativeCatalogueProbe } from './native-catalogue-probe.js';
import { createNativeCatalogueProbe } from './native-catalogue-probe.js';
import { catalogueHelperRuntime } from './native-helper-command.js';
import type { ModelMessage } from './opencode-native-driver.js';
import { openCodeScriptedModelFixture } from './opencode-native-driver.js';
import type { OpenCodeNativeFixture } from './opencode-native-write.js';
import { OpenCodeNativeWriteActor } from './opencode-native-write.js';

const execute = promisify(execFile);
const repo = nodePath.resolve(import.meta.dirname, '../../../..');

/** Same canonical content/guide/helper probe as Codex and Cursor, through the native V2 SDK. */
export class OpenCodeNativeCatalogueActor {
  private readonly source: string;
  private probe?: NativeCatalogueProbe;
  private native?: OpenCodeNativeWriteActor;
  private candidate = '';
  private directory = '';
  private project = '';
  private results: ModelMessage[] = [];

  constructor(private readonly fixture: OpenCodeNativeFixture) {
    this.source = mkdtempSync(nodePath.join(fixture.runsDirectory, 'opencode-catalogue-'));
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    this.probe = await createNativeCatalogueProbe(this.source, output =>
      execute(
        'bun',
        [
          nodePath.join(repo, 'packages/cli/scripts/generate-opencode-v2-plugin.ts'),
          '--output',
          output,
        ],
        { cwd: repo, timeout: 120_000 },
      ),
    );
    this.native = new OpenCodeNativeWriteActor({
      ...this.fixture,
      v2CandidatePackage: this.probe.packageRoot,
    });
    await this.native.prepare(host, version, runtime);
  }

  confirmCanonicalProbe(): void {
    assert.ok(this.probe);
    const workflow = readFileSync(
      nodePath.join(this.probe.packageRoot, 'skills/explain/SKILL.md'),
      'utf8',
    );
    assert.ok(workflow.includes(this.probe.workflowMarker));
    assert.ok(
      readFileSync(
        nodePath.join(this.probe.packageRoot, 'skills/explain/references/HOST_CONTRACT_GUIDE.md'),
        'utf8',
      ).includes(this.probe.guideMarker),
    );
  }

  async invokeWorkflow(): Promise<void> {
    assert.ok(this.native);
    assert.ok(this.probe);
    await this.native.runModelFixture(async paths => {
      this.candidate = paths.candidate;
      this.directory = paths.directory;
      this.project = paths.project;
      mkdirSync(nodePath.join(paths.project, '.host-contract'));
      // This newly owned synthetic profile has no user assets. Remove legacy delivery
      // so a project helper or copied profile skill cannot satisfy native package proof.
      for (const directory of ['hooks', 'skills', 'guides'])
        rmSync(nodePath.join(paths.project, '.safeword', directory), {
          recursive: true,
          force: true,
        });
      for (const directory of ['skills', 'commands', 'agents'])
        rmSync(nodePath.join(paths.directory, 'profile', directory), {
          recursive: true,
          force: true,
        });
      const skillFile = nodePath.join(paths.candidate, 'skills/explain/SKILL.md');
      const workflow = readFileSync(skillFile, 'utf8');
      const runtime = catalogueHelperRuntime(
        workflow,
        skillFile,
        nodePath.join(paths.candidate, 'runtime/cli.js'),
      );
      // Prerequisite only: remove this artifact before the actual native helper call.
      await execute(
        'bun',
        [runtime, 'project', 'runtime', 'audit-principle-trace', paths.project],
        {
          cwd: paths.project,
          env: { ...process.env, SAFEWORD_CLI: undefined, SAFEWORD_PLUGIN_CLI: runtime },
        },
      );
      const artifact = nodePath.join(paths.project, '.host-contract/native-helper.json');
      assert.equal(JSON.parse(readFileSync(artifact, 'utf8')).marker, this.probe?.helperMarker);
      rmSync(artifact);
      const script = /```bash\n([\s\S]*?)```/u.exec(workflow)?.[1];
      assert.ok(script);
      const guideLink = /\[the packaged guide\]\(([^)]+)\)/u.exec(workflow)?.[1];
      assert.ok(guideLink);
      const guide = nodePath.resolve(nodePath.dirname(skillFile), guideLink);
      const model = await openCodeScriptedModelFixture(paths.directory, request => {
        const results = request.messages?.filter(message => message.role === 'tool') ?? [];
        if (results.length === 0)
          return { tool: { name: 'skill', input: { id: 'safeword-explain' } } };
        if (results.length === 1) return { tool: { name: 'read', input: { path: guide } } };
        if (results.length === 2)
          return {
            tool: {
              name: 'shell',
              input: { command: `SAFEWORD_PLUGIN_RUNTIME="${runtime}"; ${script}` },
            },
          };
        return {};
      });
      this.results = model.results;
      return {
        ...model,
        prompt:
          'Invoke only the installed safeword-explain workflow, its declared guide, and its exact packaged helper.',
      };
    });
  }

  assertPackagedResult(): void {
    assert.ok(this.probe);
    assertMatchingTree(this.probe.packageRoot, this.candidate);
    const observations = readFileSync(
      nodePath.join(this.directory, 'native-observations.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            tool?: string;
            input?: { id?: string };
            plugins?: { source: { type: string; path?: string }; state: { status: string } }[];
          },
      );
    const invocations = observations.filter(
      row => row.tool === 'skill' && row.input?.id === 'safeword-explain',
    );
    assert.equal(
      invocations.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native skill invocation was not observed',
    );
    assert.ok(
      invocations[0]?.plugins?.some(
        plugin =>
          plugin.source.type === 'local' &&
          plugin.source.path?.startsWith(this.candidate) &&
          plugin.state.status === 'active',
      ),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native candidate was not active at skill dispatch',
    );
    const result = JSON.stringify(this.results);
    assert.ok(
      result.includes(this.probe.workflowMarker),
      'NATIVE_OPENCODE_V2_CATALOGUE_MISSING: native skill did not load the canonical workflow',
    );
    assert.ok(
      result.includes(this.probe.guideMarker),
      'NATIVE_HELPER_ORIGIN_MISMATCH: native guide content was not loaded',
    );
    assert.ok(
      result.includes(this.probe.helperMarker),
      'NATIVE_HELPER_ORIGIN_MISMATCH: native helper returned no marker',
    );
    const receiptFile = nodePath.join(this.project, '.host-contract/native-helper.json');
    assert.ok(
      existsSync(receiptFile),
      'NATIVE_HELPER_ORIGIN_MISMATCH: no actual helper side effect',
    );
    const receipt = JSON.parse(readFileSync(receiptFile, 'utf8')) as {
      marker: string;
      origin: string;
      runtime: string;
    };
    assert.equal(receipt.marker, this.probe.helperMarker);
    assert.equal(
      receipt.origin,
      nodePath.join(this.candidate, 'templates/hooks/audit-principle-trace.ts'),
    );
    assert.equal(receipt.runtime, nodePath.join(this.candidate, 'runtime/cli.js'));
  }
}
