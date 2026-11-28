import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';
const intended = [
  [
    'codex.session-context',
    'session.standing-context.read',
    'hooks/lib/safeword-context.ts',
    'SessionStart',
  ],
  ['codex.post-context', 'feedback.lint', 'hooks/lib/lint.ts', 'PostToolUse'],
  ['codex.post-context', 'feedback.quality', 'hooks/post-tool-quality.ts', 'PostToolUse'],
  [
    'codex.post-context',
    'feedback.language-skill',
    'hooks/post-tool-skill-nudge.ts',
    'PostToolUse',
  ],
  [
    'codex.prompt-context',
    'retrospective.filing-nudge',
    'hooks/prompt-retro-nudge.ts',
    'UserPromptSubmit',
  ],
  ['codex.prompt-context', 'prompt.timestamp', 'hooks/prompt-timestamp.ts', 'UserPromptSubmit'],
] as const;
type Facet = {
  composition_id: string;
  behavior_id: string;
  owner: string;
  registration_index: number;
  complete: boolean;
  declared_guarantee: string;
};
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(nodePath.dirname(root), { recursive: true, force: true });
});
function report(root: string) {
  const result = runContractRepoCheck(root);
  // The shared fixture helper validates state/exit pairs and rejects unavailable proof.
  return JSON.parse(result.output);
}
function selected(current: ReturnType<typeof report>): Facet[] {
  return current.data.handler_facets.filter((row: Facet) =>
    intended.some(([id]) => id === row.composition_id),
  );
}
it('relates six independently intended Codex context facets without whole-adopting them', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root),
    rows = selected(current);
  expect(rows, 'CODEX_CONTEXT_FACETS_MISSING').toHaveLength(6);
  expect(
    rows.map(row => [
      row.composition_id,
      row.behavior_id,
      row.owner,
      current.data.handler_inventory[row.registration_index].event,
    ]),
  ).toEqual(intended);
  for (const row of rows) {
    expect(row).toMatchObject({ complete: false, declared_guarantee: 'observe' });
    expect(
      current.data.behavior_adoptions.some(
        (item: { registration_index: number }) =>
          item.registration_index === row.registration_index,
      ),
    ).toBe(false);
  }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});
it.each([
  ['missing facet', 'c.facets=[];', 'HOST_CONTRACT_FACET_DISPOSITION_MISSING'],
  ['duplicate facet', 'c.facets.push({...c.facets[0]});', 'HOST_CONTRACT_FACET_DUPLICATE'],
  [
    'wrong owner',
    "c.facets[0].behavior='feedback.language-skill';",
    'HOST_CONTRACT_FACET_SOURCE_MISSING',
  ],
  ['event', "c.event='Stop';", 'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID'],
  ['matcher', "c.matcher='Bash';", 'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID'],
  ['condition', "c.condition='Bash(git *)';", 'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID'],
  ['execution', "c.execution='background';", 'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID'],
  [
    'capability',
    "PRODUCTION_INTEGRATIONS.find(row=>row.id==='codex').capabilities.lifecycle.prompt_submit='unavailable';",
    'HOST_CONTRACT_FACET_DISPOSITION_INVALID',
  ],
  [
    'arguments',
    "c.command=()=>codexPluginHookCommand('user-prompt-submit')+' --other';",
    'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID',
  ],
] as const)('rejects prompt %s drift and restores', (_name, mutation, code) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts'),
    original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst c = PRODUCTION_INTEGRATIONS.find(row=>row.id==='codex')!.handlerCompositions!.find(row=>row.id==='codex.prompt-context') as any;\n${mutation}\n`,
  );
  expect(report(root).findings).toContainEqual(
    expect.objectContaining({
      code,
      metadata: expect.objectContaining({ composition_id: 'codex.prompt-context' }),
    }),
  );
  writeFileSync(path, original);
  expect(selected(report(root))).toHaveLength(6);
});

it.each([
  [
    'src/commands/codex-hook.ts',
    "'codex/post-tool-quality.ts',",
    "'codex/other.ts',",
    'feedback.quality',
  ],
  [
    'templates/hooks/codex/post-tool-quality.ts',
    "'post-tool-quality.ts'",
    "'post-tool-skill-nudge.ts'",
    'feedback.quality',
  ],
  [
    'templates/hooks/codex/post-tool-skill-nudge.ts',
    'runClaudeHookAsCodex(claudeHookPath, translated)',
    'runClaudeHookAsCodex(claudeHookPath, input)',
    'feedback.language-skill',
  ],
  [
    'src/commands/codex-hook.ts',
    "'prompt-timestamp.ts',",
    "'prompt-questions.ts',",
    'prompt.timestamp',
  ],
] as const)(
  'rejects actual relay/owner bypass %s for %s and repairs',
  (relative, before, after, behavior) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/cli', relative),
      original = readFileSync(path, 'utf8');
    expect(original).toContain(before);
    writeFileSync(
      path,
      original.replace(before, () => after),
    );
    const current = report(root);
    expect(current.findings).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_FACET_SOURCE_MISSING',
        metadata: expect.objectContaining({ behavior_id: behavior }),
      }),
    );
    expect(selected(current).some(row => row.behavior_id === behavior)).toBe(false);
    writeFileSync(path, original);
    expect(selected(report(root))).toHaveLength(6);
  },
);
it.each([
  ["'user-prompt-submit': runUserPromptSubmit,", "'user-prompt-submit': runStop,"],
  [
    "runPackagedHook('prompt-retro-nudge.ts', rawInput, projectDirectory)",
    "runPackagedHook('stop-retro.ts', rawInput, projectDirectory)",
  ],
  [
    "runPackagedHook('post-tool-lint.ts', lintInput, projectDirectory)",
    "runPackagedHook('post-tool-lint.ts', rawInput, projectDirectory)",
  ],
] as const)('rejects actual dispatcher/argument bypass %s and repairs', (before, after) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/commands/codex-hook.ts'),
    original = readFileSync(path, 'utf8');
  expect(original).toContain(before);
  writeFileSync(
    path,
    original.replace(before, () => after),
  );
  expect(report(root).findings).toContainEqual(
    expect.objectContaining({ code: 'HOST_CONTRACT_FACET_SOURCE_MISSING' }),
  );
  writeFileSync(path, original);
  expect(selected(report(root))).toHaveLength(6);
});
