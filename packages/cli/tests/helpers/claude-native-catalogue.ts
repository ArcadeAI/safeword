import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

import {
  sealClaudePluginCatalogue,
  writeClaudePluginCatalogue,
} from '../../src/claude-plugin/catalogue.js';
import { VERSION } from '../../src/version.js';
import { ClaudeNativeContractActor, type ClaudeNativeFixture } from './claude-native-contract.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { createCanonicalCatalogueInputs } from './native-catalogue-probe.js';

/** Canonical input variation through the real Claude renderer and native Skill/Read/Bash tools. */
export async function proveClaudeNativeCatalogue(fixture: ClaudeNativeFixture): Promise<void> {
  const actor = new ClaudeNativeContractActor(fixture);
  await actor.prepare();
  const inputs = createCanonicalCatalogueInputs(actor.directory);
  const candidate = nodePath.join(actor.directory, 'candidate');
  writeClaudePluginCatalogue(
    {
      cliBundle: readFileSync(nodePath.join(fixture.runtimePath, 'runtime/cli.js'), 'utf8'),
      sourceRoot: nodePath.resolve(import.meta.dirname, '../../src'),
      templatesRoot: inputs.canonicalRoot,
      version: VERSION,
    },
    candidate,
  );
  sealClaudePluginCatalogue(candidate, VERSION);
  const backups = [fixture.runtimePath, fixture.installedPath].map((path, index) => {
    const backup = nodePath.join(actor.directory, `package-before-${index}`);
    cpSync(path, backup, { recursive: true });
    return { path, backup };
  });
  try {
    for (const { path } of backups) {
      rmSync(path, { recursive: true });
      cpSync(candidate, path, { recursive: true });
    }
    await actor.prepare(candidate);
    mkdirSync(nodePath.join(actor.project, '.host-contract'));
    const helper = nodePath.join(fixture.runtimePath, 'runtime/hooks/audit-principle-trace.ts');
    const receipt = nodePath.join(actor.project, '.host-contract/native-helper.json');
    const preflight = execFileSync('bun', [helper, actor.project], {
      cwd: actor.project,
      encoding: 'utf8',
    });
    assert.equal(preflight.trim(), inputs.helperMarker);
    rmSync(receipt);
    await actor.turn(
      'Invoke /safeword:explain using its discovered Skill tool. Follow that skill’s packaged guide and runtime helper instructions, then report the actual markers. Do no other work or write receipts yourself.',
      'Skill,Read,Bash',
      'catalogue',
    );
    const events = actor.events('catalogue');
    const calls = events
      .flatMap(event => (event.type === 'assistant' ? (event.message?.content ?? []) : []))
      .filter(content => content.type === 'tool_use');
    assert.ok(
      calls.some(call => call.name === 'Skill' && call.input?.skill === 'safeword:explain'),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native model did not invoke Skill',
    );
    const guide = nodePath.join(fixture.runtimePath, 'skills/explain/HOST_CONTRACT_GUIDE.md');
    assert.ok(
      calls.some(
        call =>
          call.name === 'Read' &&
          call.input?.file_path &&
          realpathSync(call.input.file_path) === realpathSync(guide),
      ),
      'NATIVE_CLAUDE_CATALOGUE_MISSING: packaged guide was not read',
    );
    const output = readFileSync(nodePath.join(actor.directory, 'catalogue-events.jsonl'), 'utf8');
    for (const marker of [inputs.workflowMarker, inputs.guideMarker, inputs.helperMarker])
      assert.ok(
        output.includes(marker),
        'NATIVE_CLAUDE_CATALOGUE_MISSING: canonical marker not observed',
      );
    const result = JSON.parse(readFileSync(receipt, 'utf8')) as { marker: string; origin: string };
    assert.equal(result.marker, inputs.helperMarker, 'NATIVE_HELPER_ORIGIN_MISMATCH');
    assert.equal(
      realpathSync(result.origin),
      realpathSync(helper),
      'NATIVE_HELPER_ORIGIN_MISMATCH',
    );
    const helperCall = calls.find(
      call => call.name === 'Bash' && call.input?.command?.includes(helper),
    );
    assert.ok(
      helperCall?.id,
      'NATIVE_HELPER_ORIGIN_MISMATCH: native Bash did not invoke the packaged helper',
    );
    const toolOutput = events
      .flatMap(event => (event.type === 'user' ? (event.message?.content ?? []) : []))
      .filter(
        content =>
          content.type === 'tool_result' &&
          !content.is_error &&
          content.tool_use_id === helperCall.id,
      );
    assert.ok(
      toolOutput.some(content => content.content?.includes(inputs.helperMarker)),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper output did not reach the native host',
    );
  } finally {
    for (const { path, backup } of backups) {
      rmSync(path, { recursive: true });
      cpSync(backup, path, { recursive: true });
    }
    assertMatchingTree(
      nodePath.resolve(import.meta.dirname, '../../../../plugin'),
      fixture.runtimePath,
    );
    assertMatchingTree(fixture.runtimePath, fixture.installedPath);
  }
}
