import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { assertMatchingTree } from './codex-plugin-package.js';
import type { NativeCatalogueProbe } from './native-catalogue-probe.js';
import { createNativeCatalogueProbe } from './native-catalogue-probe.js';
import { catalogueHelperRuntime } from './native-helper-command.js';
import type {
  ModelMessage,
  NativeModelReply,
  NativeModelRequest,
} from './opencode-native-driver.js';
import { openCodeScriptedModelFixture } from './opencode-native-driver.js';
import type { OpenCodeNativeFixture } from './opencode-native-write.js';
import { OpenCodeNativeWriteActor } from './opencode-native-write.js';

const execute = promisify(execFile);
const repo = nodePath.resolve(import.meta.dirname, '../../../..');

function commandsFromNativeSkill(content: string, packageRoot: string, workflow: string) {
  const base = /^Base directory for this skill: (.+)$/mu.exec(content)?.[1];
  assert.equal(
    base,
    nodePath.join(packageRoot, 'skills', workflow),
    'Native skill base directory differs from its packaged workflow',
  );
  assert.ok(base);
  const runtime = catalogueHelperRuntime(
    content,
    nodePath.join(base, 'SKILL.md'),
    nodePath.join(packageRoot, 'runtime/cli.js'),
  );
  const script = /```bash\n([\s\S]*?)```/u.exec(content)?.[1];
  const guideLink = /\[the packaged guide\]\(([^)]+)\)/u.exec(content)?.[1];
  assert.ok(script && guideLink);
  return {
    guide: nodePath.resolve(base, guideLink),
    helper: `SAFEWORD_PLUGIN_RUNTIME="${runtime}"; ${script}`,
  };
}

/** Same canonical content/guide/helper probe as Codex and Cursor, through the native V2 SDK. */
export class OpenCodeNativeCatalogueActor {
  private readonly source: string;
  private probe?: NativeCatalogueProbe;
  private native?: OpenCodeNativeWriteActor;
  private candidate = '';
  private directory = '';
  private project = '';
  private results: ModelMessage[] = [];
  private bindingFailure = '';
  private loadedWorkflow = '';
  private argumentObserved = false;
  private readonly workflow: string;
  private readonly argument: string;

  constructor(
    private readonly fixture: OpenCodeNativeFixture,
    private readonly entrypoint: 'skill' | 'command' = 'skill',
  ) {
    this.source = mkdtempSync(nodePath.join(fixture.runsDirectory, 'opencode-catalogue-'));
    this.workflow = entrypoint === 'command' ? 'bdd' : 'explain';
    this.argument = `ARGUMENT_${nodePath.basename(this.source)}`;
  }

  private skillReply(
    request: NativeModelRequest,
    candidate: string,
    probe: NativeCatalogueProbe,
  ): NativeModelReply {
    const results = request.messages?.filter(message => message.role === 'tool') ?? [];
    if (results.length === 0) return { tool: { name: 'skill', input: { id: 'safeword-explain' } } };
    const loaded = results[0]?.content;
    if (typeof loaded !== 'string' || !loaded.includes(probe.workflowMarker)) return {};
    try {
      const commands = commandsFromNativeSkill(loaded, candidate, this.workflow);
      if (results.length === 1) return { tool: { name: 'read', input: { path: commands.guide } } };
      if (results.length === 2)
        return { tool: { name: 'shell', input: { command: commands.helper } } };
      return {};
    } catch (error) {
      this.bindingFailure = String(error);
      return {};
    }
  }

  private commandReply(
    request: NativeModelRequest,
    candidate: string,
    probe: NativeCatalogueProbe,
  ): NativeModelReply {
    const results = request.messages?.filter(message => message.role === 'tool') ?? [];
    this.argumentObserved ||= JSON.stringify(request.messages).includes(this.argument);
    const text = request.messages
      ?.filter(message => message.role === 'user')
      .flatMap(message => {
        if (typeof message.content === 'string') return [message.content];
        if (!Array.isArray(message.content)) return [];
        return message.content.flatMap((part: { text?: unknown }) =>
          typeof part.text === 'string' ? [part.text] : [],
        );
      })
      .find(content => content.includes(probe.workflowMarker));
    if (text) this.loadedWorkflow = text;
    if (!text) return {};
    try {
      const commands = commandsFromNativeSkill(text, candidate, this.workflow);
      if (results.length === 0) return { tool: { name: 'read', input: { path: commands.guide } } };
      if (results.length === 1)
        return { tool: { name: 'shell', input: { command: commands.helper } } };
      return {};
    } catch (error) {
      this.bindingFailure = String(error);
      return {};
    }
  }

  private assertCommandSubmission(
    observations: { prompt?: { text?: string } }[],
    apiRegistration: string,
  ): void {
    if (existsSync(apiRegistration)) {
      if (this.loadedWorkflow !== '') {
        const result = JSON.parse(
          readFileSync(nodePath.join(this.directory, 'native-command-result.json'), 'utf8'),
        ) as { missing: boolean };
        assert.equal(result.missing, false, 'NATIVE_COMMAND_DISPATCH_MISSING');
      }
      return;
    }
    if (this.loadedWorkflow !== '') {
      assert.ok(
        observations.some(row => row.prompt?.text === this.argument),
        'NATIVE_COMMAND_DISPATCH_MISSING',
      );
      assert.equal(
        observations.some(row => row.prompt?.text === `/safeword-bdd ${this.argument}`),
        false,
        'NATIVE_COMMAND_DISPATCH_MISSING',
      );
      return;
    }
    assert.ok(
      observations.some(row => row.prompt?.text === `/safeword-bdd ${this.argument}`),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native TUI command submission was not observed',
    );
  }

  private assertCommandOutput(probe: NativeCatalogueProbe): void {
    const messages = nodePath.join(this.directory, 'native-command-messages.json');
    if (existsSync(messages)) {
      const visible = readFileSync(messages, 'utf8');
      for (const marker of [
        probe.workflowMarker,
        probe.guideMarker,
        probe.helperMarker,
        this.argument,
      ])
        assert.ok(
          visible.includes(marker),
          'NATIVE_HELPER_ORIGIN_MISMATCH: native CLI message result omitted canonical command output',
        );
    }
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    this.probe = await createNativeCatalogueProbe(
      this.source,
      output =>
        execute(
          'bun',
          [
            nodePath.join(repo, 'packages/cli/scripts/generate-opencode-v2-plugin.ts'),
            '--output',
            output,
          ],
          { cwd: repo, timeout: 120_000 },
        ),
      this.workflow,
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
      nodePath.join(this.probe.packageRoot, 'skills', this.workflow, 'SKILL.md'),
      'utf8',
    );
    assert.ok(workflow.includes(this.probe.workflowMarker));
    assert.ok(
      readFileSync(
        nodePath.join(
          this.probe.packageRoot,
          'skills',
          this.workflow,
          'references/HOST_CONTRACT_GUIDE.md',
        ),
        'utf8',
      ).includes(this.probe.guideMarker),
    );
  }

  async invokeWorkflow(): Promise<void> {
    assert.ok(this.native);
    assert.ok(this.probe);
    const probe = this.probe;
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
      const skillFile = nodePath.join(paths.candidate, 'skills', this.workflow, 'SKILL.md');
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
      const model = await openCodeScriptedModelFixture(paths.directory, request => {
        if (this.entrypoint === 'command')
          return this.commandReply(request, paths.candidate, probe);
        return this.skillReply(request, paths.candidate, probe);
      });
      this.results = model.results;
      return {
        ...model,
        command: this.entrypoint === 'command' ? 'safeword-bdd' : undefined,
        prompt:
          this.entrypoint === 'command'
            ? this.argument
            : 'Invoke only the installed safeword-explain workflow, its declared guide, and its exact packaged helper.',
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
            prompt?: { text?: string };
            plugins?: { source: { type: string; path?: string }; state: { status: string } }[];
          },
      );
    const invocations = observations.filter(
      row => row.tool === 'skill' && row.input?.id === 'safeword-explain',
    );
    if (this.entrypoint === 'skill')
      assert.equal(
        invocations.length,
        1,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: native skill invocation was not observed',
      );
    const apiRegistration = nodePath.join(this.directory, 'native-command-registration.json');
    let plugins = invocations[0]?.plugins;
    if (this.entrypoint === 'command') {
      plugins = existsSync(apiRegistration)
        ? (JSON.parse(readFileSync(apiRegistration, 'utf8')) as { data: typeof plugins }).data
        : observations.find(row => row.plugins)?.plugins;
    }
    if (this.entrypoint === 'command') this.assertCommandSubmission(observations, apiRegistration);
    assert.ok(
      plugins?.some(
        plugin =>
          plugin.source.type === 'local' &&
          plugin.source.path?.startsWith(this.candidate) &&
          plugin.state.status === 'active',
      ),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native candidate was not active at skill dispatch',
    );
    if (this.entrypoint === 'command')
      assert.ok(
        this.loadedWorkflow.includes(this.probe.workflowMarker),
        'NATIVE_OPENCODE_V2_COMMAND_MISSING',
      );
    if (this.entrypoint === 'command')
      assert.equal(this.argumentObserved, true, 'NATIVE_COMMAND_ARGUMENT_MISSING');
    const result = JSON.stringify({ results: this.results, loadedWorkflow: this.loadedWorkflow });
    assert.ok(
      result.includes(this.probe.workflowMarker),
      `NATIVE_OPENCODE_V2_CATALOGUE_MISSING: native skill did not load the canonical workflow; native result: ${JSON.stringify(this.results[0])}`,
    );
    assert.equal(this.bindingFailure, '', `NATIVE_HELPER_ORIGIN_MISMATCH: ${this.bindingFailure}`);
    assert.ok(
      result.includes(this.probe.guideMarker),
      'NATIVE_HELPER_ORIGIN_MISMATCH: native guide content was not loaded',
    );
    assert.ok(
      result.includes(this.probe.helperMarker),
      'NATIVE_HELPER_ORIGIN_MISMATCH: native helper returned no marker',
    );
    this.assertCommandOutput(this.probe);
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
