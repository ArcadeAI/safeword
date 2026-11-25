import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { validatedResourceRevision } from '../../src/codex-plugin/resource-revision.js';
import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

const fixtures: string[] = [];
afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});

function document(path: string) {
  const match = /^---\r?\n(?<metadata>[\s\S]*?)\r?\n---\r?\n(?<body>[\s\S]*)$/u.exec(
    readFileSync(path, 'utf8'),
  );
  if (!match?.groups) throw new Error(`Missing skill frontmatter: ${path}`);
  return {
    metadata: parse(match.groups.metadata ?? '') as Record<string, unknown>,
    body: match.groups.body ?? '',
  };
}

function run(directory: string, args: string[]): void {
  const parent = nodePath.dirname(directory);
  const result = spawnSync('bun', args, {
    cwd: directory,
    env: {
      ...process.env,
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_NO_AUTO_UPGRADE: '1',
      CODEX_HOME: nodePath.join(parent, 'codex-profile'),
      CLAUDE_CONFIG_DIR: nodePath.join(parent, 'claude-profile'),
      OPENCODE_CONFIG_DIR: nodePath.join(parent, 'opencode-profile'),
    },
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  expect(
    result.status,
    `HOST_CONTRACT_PROOF_UNAVAILABLE: ${result.error?.message ?? ''}\n${result.stderr}\n${result.stdout}`,
  ).toBe(0);
}

// These are package/settings preservation controls, not host invocation enforcement proof.
const settings = [
  { skill: 'spike', 'disable-model-invocation': true, 'user-invocable': true },
  { skill: 'testing', 'disable-model-invocation': false, 'user-invocable': false },
  { skill: 'bdd' },
] as const;

function internalDelivery(delivery: string, invocation: object): boolean {
  return delivery === 'codex-native' && Reflect.get(invocation, 'user-invocable') === false;
}

function hasInvocationPolicy(delivery: string, invocation: object): boolean {
  return (
    !internalDelivery(delivery, invocation) && Object.hasOwn(invocation, 'disable-model-invocation')
  );
}

describe('canonical skill invocation settings reach delivery', () => {
  it.each(['codex-native', 'portable-core', 'opencode-v2'] as const)(
    'preserves explicit booleans and absent defaults in %s',
    delivery => {
      const directory = createContractRepoFixture();
      fixtures.push(directory);
      cpSync(
        nodePath.resolve(import.meta.dirname, '../../dist'),
        nodePath.join(directory, 'packages/cli/dist'),
        { recursive: true },
      );
      const marker = `Canonical invocation settings: ${randomUUID()}`;
      for (const { skill, ...invocation } of settings) {
        const source = nodePath.join(directory, `packages/cli/templates/skills/${skill}/SKILL.md`);
        const original = document(source);
        delete original.metadata['disable-model-invocation'];
        delete original.metadata['user-invocable'];
        writeFileSync(
          source,
          `---\n${stringify({ ...original.metadata, ...invocation, description: marker })}---\n${original.body}`,
        );
      }
      const output = nodePath.join(nodePath.dirname(directory), 'generated');
      if (delivery === 'opencode-v2') {
        run(directory, ['packages/cli/scripts/generate-opencode-v2-plugin.ts', '--output', output]);
      } else {
        run(directory, [
          'packages/cli/scripts/generate-codex-plugin.ts',
          '--version',
          '1.2.0',
          '--output',
          output,
          ...(delivery === 'portable-core' ? ['--portable-core'] : []),
        ]);
        const index = JSON.parse(
          readFileSync(nodePath.join(output, 'resources/workflow-index.json'), 'utf8'),
        ) as unknown;
        expect(validatedResourceRevision(output, index)).toMatch(/^[a-f\d]{64}$/u);
      }
      for (const { skill, ...invocation } of settings) {
        const layout = internalDelivery(delivery, invocation) ? 'internal' : 'skills';
        const path = nodePath.join(output, `${layout}/${skill}/SKILL.md`);
        const actual = document(path).metadata;
        expect(actual.description).toBe(marker);
        const policyPath = nodePath.join(nodePath.dirname(path), 'agents/openai.yaml');
        const hasNativePolicy = hasInvocationPolicy(delivery, invocation);
        expect(
          existsSync(policyPath),
          `CODEX_INVOCATION_POLICY_NOT_DERIVED: ${delivery}/${skill}`,
        ).toBe(hasNativePolicy);
        if (hasNativePolicy)
          expect(parse(readFileSync(policyPath, 'utf8'))).toEqual({
            policy: {
              allow_implicit_invocation: !Reflect.get(invocation, 'disable-model-invocation'),
            },
          });
        for (const key of ['disable-model-invocation', 'user-invocable']) {
          expect(
            { present: Object.hasOwn(actual, key), value: actual[key] },
            `SKILL_INVOCATION_SETTINGS_DROPPED: ${delivery}/${skill}/${key}`,
          ).toEqual({
            present: Object.hasOwn(invocation, key),
            value: Reflect.get(invocation, key),
          });
        }
      }
    },
    90_000,
  );
});
