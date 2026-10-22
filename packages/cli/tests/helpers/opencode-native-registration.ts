import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { assertMatchingTree } from './codex-plugin-package.js';
import { type ModelMessage, openCodeScriptedModelFixture } from './opencode-native-driver.js';
import { type OpenCodeNativeFixture, OpenCodeNativeWriteActor } from './opencode-native-write.js';

/** A real SDK schema rejection must not remove an independently usable guard. */
export async function proveOpenCodeOptionalRegistration(
  fixture: OpenCodeNativeFixture,
  runtime: 'CLI' | 'TUI',
): Promise<void> {
  assert.ok(fixture.v2CandidatePackage);
  const root = mkdtempSync(nodePath.join(fixture.runsDirectory, 'opencode-registration-'));
  const source = nodePath.join(root, 'candidate');
  cpSync(fixture.v2CandidatePackage, source, { recursive: true });
  const index = nodePath.join(source, 'catalogue.json');
  const catalogue = JSON.parse(readFileSync(index, 'utf8')) as {
    name: string;
    description: unknown;
  }[];
  const optional = catalogue.find(entry => entry.name === 'explain');
  assert.ok(optional);
  // Deliberately malformed host input. The real public SDK validates it during setup.
  optional.description = 42;
  writeFileSync(index, JSON.stringify(catalogue));
  const actor = new OpenCodeNativeWriteActor({ ...fixture, v2CandidatePackage: source });
  await actor.prepare('OpenCode V2', '2.0.32', runtime);
  let directory = '';
  let project = '';
  let candidate = '';
  let results = '';
  let actualResults: ModelMessage[] = [];
  const relative = '.project/tickets/optional-registration/ticket.md';
  const command = `printf forbidden > ${relative}`;
  await actor.runModelFixture(async paths => {
    ({ directory, project, candidate } = paths);
    mkdirSync(nodePath.dirname(nodePath.join(project, relative)), { recursive: true });
    const model = await openCodeScriptedModelFixture(directory, request => {
      actualResults = request.messages?.filter(message => message.role === 'tool') ?? [];
      if (actualResults.length === 0)
        return { tool: { name: 'skill', input: { id: 'safeword-explain' } } };
      if (actualResults.length === 1)
        return { tool: { name: 'skill', input: { id: 'safeword-cleanup-zombies' } } };
      if (actualResults.length === 2) return { tool: { name: 'shell', input: { command } } };
      return {};
    });
    return {
      ...model,
      close() {
        results = JSON.stringify(actualResults);
        assert.equal(
          model.attempts,
          3,
          'HOST_CONTRACT_PROOF_UNAVAILABLE: incomplete native attempts',
        );
        assert.equal(
          actualResults.length,
          3,
          'HOST_CONTRACT_PROOF_UNAVAILABLE: incomplete native results',
        );
        model.close();
      },
    };
  });
  assertMatchingTree(source, candidate);
  const observations = readFileSync(nodePath.join(directory, 'native-observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(
      line =>
        JSON.parse(line) as {
          tool?: string;
          input?: { command?: string };
          session_id?: string;
          plugins?: { source: { path?: string }; state: { status: string; error?: unknown } }[];
        },
    );
  const attempts = observations.filter(
    row => row.tool === 'shell' && row.input?.command === command,
  );
  assert.equal(
    attempts.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: no unique actual shell dispatch',
  );
  const registration = attempts[0]?.plugins?.find(plugin =>
    plugin.source.path?.startsWith(candidate),
  );
  assert.ok(registration, 'HOST_CONTRACT_PROOF_UNAVAILABLE: candidate registration not observed');
  writeFileSync(
    nodePath.join(directory, 'registration-outcome.json'),
    JSON.stringify({ registration, results }, undefined, 2),
  );
  // A load error must originate in native schema validation, never a missing SDK/import.
  if (registration.state.status !== 'active') {
    const cause = String(registration.state.error);
    assert.match(cause, /Schema validation failed/u);
    assert.match(cause, /"identifier":"Skill.Info"/u);
    assert.match(cause, /"path":\["description"\]/u);
    console.log(
      JSON.stringify({
        runtime,
        native_plugin_state: registration.state.status,
        rejected_schema: 'Skill.Info.description',
      }),
    );
  }
  assert.equal(
    existsSync(nodePath.join(project, relative)),
    false,
    'V2_OPTIONAL_FAILURE_HIDES_GUARD',
  );
  assert.match(results, /Safeword denied|Shell commands can't change/u);
  assert.equal(registration.state.status, 'active', 'V2_OPTIONAL_FAILURE_HIDES_GUARD');
  assert.match(String(actualResults[0]?.content), /Unable to load skill safeword-explain/u);
  assert.match(String(actualResults[1]?.content), /skill_content[\s\S]*cleanup-zombies/u);
  assert.ok(
    String(actualResults[1]?.content).includes(
      `Base directory for this skill: ${candidate}/skills/cleanup-zombies`,
    ),
    'NATIVE_REGISTRATION_RESOURCE_ORIGIN_MISMATCH',
  );
  const dispatches = readFileSync(nodePath.join(directory, 'runtime-observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(
      line =>
        JSON.parse(line) as {
          status: number;
          input: { cwd: string; session_id: string; tool_input: { command: string } };
        },
    );
  const guarded = dispatches.filter(row => row.input.tool_input.command === command);
  assert.equal(guarded.length, 1);
  const dispatch = guarded[0];
  assert.ok(dispatch);
  assert.equal(dispatch.status, 2);
  assert.equal(dispatch.input.cwd, project);
  assert.equal(dispatch.input.session_id, attempts[0]?.session_id);
  assert.equal(dispatch.input.tool_input.command, command);
  console.log(`OpenCode ${runtime} optional registration preserves shared guard: ${directory}`);
}
