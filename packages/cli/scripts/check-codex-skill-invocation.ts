import assert from 'node:assert/strict';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'yaml';

import hostReleases from '../src/lifecycle/host-releases.json' with { type: 'json' };
import type { CodexGuardFixture } from '../tests/helpers/codex-native-continuation.js';
import { CodexNativeWriteActor } from '../tests/helpers/codex-native-write.js';

function readNativeContext(
  profile: string,
  thread: string,
): { context: string[]; rollout: string } {
  const sessions = nodePath.join(profile, 'sessions');
  const rollouts = readdirSync(sessions, { recursive: true, encoding: 'utf8' }).filter(name =>
    name.endsWith(`-${thread}.jsonl`),
  );
  assert.equal(rollouts.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: no unique native rollout');
  const rollout = nodePath.join(sessions, rollouts[0] ?? '');
  const context: string[] = [];
  const lines = readFileSync(rollout, 'utf8').trim().split('\n');
  for (const line of lines) {
    const entry = JSON.parse(line) as {
      type: string;
      payload?: { role?: string; content?: { text?: string }[] };
    };
    if (entry.type === 'response_item' && entry.payload?.role === 'developer') {
      const parts = entry.payload.content ?? [];
      for (const part of parts) if (typeof part.text === 'string') context.push(part.text);
    }
  }
  return { context, rollout };
}

function installedInvocationSettings(skillsRoot: string): {
  manual: string[];
  automatic: string[];
} {
  const manual: string[] = [];
  const automatic: string[] = [];
  for (const name of readdirSync(skillsRoot)) {
    const source = readFileSync(nodePath.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    const frontmatter = /^---\r?\n(?<metadata>[\s\S]*?)\r?\n---/u.exec(source)?.groups?.metadata;
    assert.ok(frontmatter, 'HOST_CONTRACT_PROOF_UNAVAILABLE: no installed skill settings');
    const metadata = parse(frontmatter) as Record<string, unknown>;
    (metadata['disable-model-invocation'] === true ? manual : automatic).push(name);
  }
  return { manual, automatic };
}

/** Actual installed-host context observation; never a replacement for all-host propagation. */
async function check(fixtureFile: string): Promise<void> {
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as CodexGuardFixture;
  const before = new Set(readdirSync(fixture.root));
  const actor = new CodexNativeWriteActor(fixture);
  await actor.prepare('Codex', hostReleases.codex.version, 'CLI');
  actor.setPolicy('allowed');
  await actor.attempt();
  actor.assertOutcome();
  const created = readdirSync(fixture.root).filter(
    name => name.startsWith('guard-run-') && !before.has(name),
  );
  assert.equal(created.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous native run');
  const artifacts = nodePath.join(fixture.root, created[0] ?? '');
  const events = readFileSync(nodePath.join(artifacts, 'allowed-events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as { type: string; thread_id?: string });
  const thread = events.find(event => event.type === 'thread.started')?.thread_id;
  assert.ok(
    thread && /^[\da-f-]{36}$/u.test(thread),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: no native thread',
  );
  const { context, rollout } = readNativeContext(fixture.profile, thread);
  const skillsRoot = realpathSync(nodePath.join(fixture.installedPath, 'skills'));
  assert.ok(
    context.some(text => text.includes(`= \`${skillsRoot}\``)),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: context does not identify the installed package root',
  );
  const manifest = JSON.parse(
    readFileSync(nodePath.join(fixture.installedPath, '.codex-plugin/plugin.json'), 'utf8'),
  ) as { name: string };
  const prefix = `- ${manifest.name}:`;
  const observed = new Set(
    context
      .flatMap(text => text.split('\n'))
      .filter(line => line.startsWith(prefix))
      .map(line => line.slice(prefix.length).split(':', 1)[0]),
  );
  const { manual, automatic } = installedInvocationSettings(skillsRoot);
  assert.ok(
    manual.length > 0 && automatic.length > 0,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: no paired controls',
  );
  assert.ok(
    automatic.every(name => observed.has(name)),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: automatic skill controls missing from native context',
  );
  const leaked = manual.filter(name => observed.has(name));
  assert.equal(leaked.length, 0, `NATIVE_CODEX_IMPLICIT_POLICY_MISSING: ${leaked.join(', ')}`);
  console.log(
    JSON.stringify({
      status: 'passed',
      version: hostReleases.codex.version,
      rollout,
      artifacts,
      manual,
      automatic,
    }),
  );
}

async function main(): Promise<number> {
  try {
    const fixtureFile = process.argv[2] ?? process.env.SAFEWORD_CODEX_GUARD_FIXTURE;
    assert.ok(fixtureFile, 'Use check-codex-skill-invocation.ts <owned guard fixture.json>');
    await check(fixtureFile);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return message.includes('NATIVE_CODEX_IMPLICIT_POLICY_MISSING') ? 2 : 3;
  }
}

process.exitCode = await main();
