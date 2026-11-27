import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const fixtures: string[] = [];
afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});

// Independent invalid lane relationships; expected findings are not derived from the join.
it.each([
  [
    'unknown host',
    'HOST_CONTRACT_GRAPH_LANE_UNKNOWN',
    (matrix: Matrix) => {
      matrix.targets.push({ agent: 'unknown-host', version: '1', runtimes: ['CLI'] });
    },
  ],
  [
    'missing native delivery',
    'HOST_CONTRACT_TARGET_MISSING',
    (matrix: Matrix) => {
      const target = matrix.targets.find(
        row => row.agent === 'cursor' && row.runtimes.includes('IDE'),
      );
      if (!target?.delivery_variants?.includes('native'))
        throw new Error('Missing Cursor IDE fixture');
      target.delivery_variants = target.delivery_variants.filter(delivery => delivery !== 'native');
      return `cursor:${target.version}:IDE:native`;
    },
  ],
  [
    'duplicate lane',
    'HOST_CONTRACT_GRAPH_LANE_DUPLICATE',
    (matrix: Matrix) => {
      const target = matrix.targets[0];
      if (!target) throw new Error('Missing independent fixture target');
      matrix.targets.push(target);
    },
  ],
] as const)(
  'rejects %s and repairs through the same public checker',
  (_name, finding, mutate) => {
    const directory = createContractRepoFixture();
    fixtures.push(directory);
    const path = nodePath.join(directory, 'packages/cli/tests/fixtures/host-contract/targets.json');
    const original = readFileSync(path, 'utf8');
    const matrix = JSON.parse(original) as Matrix;
    const missingTarget = mutate(matrix);
    writeFileSync(path, JSON.stringify(matrix));
    const result = runContractRepoCheck(directory);
    expect(result.status, `MISSING_GRAPH_RELATION_REJECTION: ${finding}`).toBe(2);
    expect(JSON.parse(result.output).findings).toContainEqual(
      expect.objectContaining({
        code: finding,
        ...(missingTarget && { metadata: { id: missingTarget } }),
      }),
    );
    writeFileSync(path, original);
    expect(runContractRepoCheck(directory).status).toBe(0);
  },
  120_000,
);

interface Matrix {
  targets: { agent: string; version: string; runtimes: string[]; delivery_variants?: string[] }[];
}

it('keeps actual host-specific adapter facets inapplicable on foreign lanes', () => {
  const directory = createContractRepoFixture();
  fixtures.push(directory);
  const report = JSON.parse(runContractRepoCheck(directory).output);
  for (const [source, host] of [
    ['hooks/codex/stop.ts', 'codex'],
    ['hooks/cursor/stop.ts', 'cursor'],
    ['cursor/rules/safeword-core.mdc', 'cursor'],
  ]) {
    const node = report.data.ownership_graph.facets.find(
      (row: { path: string }) => row.path === `packages/cli/templates/${source}`,
    );
    for (const lane of node.lanes) {
      expect(lane.applicable, `${source}/${lane.id}`).toBe(lane.id.startsWith(`${host}:`));
      if (!lane.applicable) expect(lane.disposition).toBeUndefined();
    }
  }
}, 120_000);

it('rejects a graph-emission bypass that drops required semantic links despite a connected outer owner', () => {
  const directory = createContractRepoFixture();
  fixtures.push(directory);
  const path = nodePath.join(directory, 'packages/cli/src/host-contract/owner-inventory.ts');
  const original = readFileSync(path, 'utf8');
  const anchor = 'behaviors.map(row => `behavior:${row.behavior_id}`)';
  expect(original).toContain(anchor);
  writeFileSync(path, original.replace(anchor, '[]'));
  const result = runContractRepoCheck(directory);
  expect(result.status, 'REQUIRED_BEHAVIOR_LINK_BYPASS_ACCEPTED').toBe(2);
  expect(JSON.parse(result.output).findings).toContainEqual(
    expect.objectContaining({ code: 'HOST_CONTRACT_GRAPH_LINK_MISSING' }),
  );
  writeFileSync(path, original);
  const repaired = runContractRepoCheck(directory);
  expect(repaired.status).toBe(0);
  const rows = JSON.parse(repaired.output).data.ownership_graph.registrations;
  const quality = rows.find((row: { identity: string }) => {
    const [host, family, event] = JSON.parse(row.identity);
    return host === 'codex' && family === 'codex-native' && event === 'PreToolUse';
  });
  expect(quality.facets).toContain('behavior:quality.pre-tool');
}, 120_000);

it('does not invent a semantic owner when an unknown command gains schema registration', () => {
  const directory = createContractRepoFixture();
  fixtures.push(directory);
  const command = 'packages/cli/templates/commands/unowned-command.md';
  const schema = nodePath.join(directory, 'packages/cli/src/schema.ts');
  const original = readFileSync(schema, 'utf8');
  writeFileSync(nodePath.join(directory, command), 'Invoke an absent canonical workflow.\n');
  writeFileSync(
    schema,
    `${original}\nSAFEWORD_SCHEMA.ownedFiles['.safeword/commands/unowned-command.md'] = { template: 'commands/unowned-command.md' };\n`,
  );
  const result = runContractRepoCheck(directory);
  expect(result.status).toBe(2);
  const report = JSON.parse(result.output);
  expect(report.findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_GRAPH_OWNER_MISSING',
      metadata: { id: command },
    }),
  );
  expect(
    report.data.ownership_graph.facets.find((row: { path: string }) => row.path === command).owner,
  ).toBe('');
  writeFileSync(schema, original);
  rmSync(nodePath.join(directory, command));
  expect(runContractRepoCheck(directory).status).toBe(0);
}, 120_000);
