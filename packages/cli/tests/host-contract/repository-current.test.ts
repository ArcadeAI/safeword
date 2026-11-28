/* eslint-disable unicorn/name-replacements -- Accepted repository-current proof identity. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import {
  intendedFacetOwner,
  intendedRegistrationIdentity,
  intendedRegistrationOwner,
  intendedRegistrations,
} from '../helpers/intended-contract-graph.js';

interface LaneDisposition {
  id: string;
  applicable: boolean;
  disposition?: string;
  reason: string;
  recovery?: string;
}

const root = nodePath.resolve(import.meta.dirname, '../../../..');
const intended = JSON.parse(
  readFileSync(
    nodePath.join(import.meta.dirname, '../fixtures/host-contract/intended-sources.json'),
    'utf8',
  ),
) as { paths: string[]; additions: string[] };

// Independent accepted runtime/delivery population, not selected by the caller
// or inferred from the implementation's coverage rows.
const lanes = [
  'claude:2.1.319:CLI:native',
  'codex:0.167.0:CLI:native',
  'cursor:2026.11.05-86047df:CLI:native',
  'cursor:3.29.9:IDE:native',
  'cursor:3.29.9:IDE:project-hooks',
  'opencode:2.4.1:CLI:native',
  'opencode:2.4.1:TUI:native',
].toSorted((left, right) => left.localeCompare(right));

function expectLaneDispositions(label: string, rows: LaneDisposition[], implemented = false): void {
  expect(
    rows.map(row => row.id).toSorted((left, right) => left.localeCompare(right)),
    `MISSING_GRAPH_LANE: ${label}`,
  ).toEqual(lanes);
  for (const row of rows) {
    expect(typeof row.applicable, `MISSING_LANE_APPLICABILITY: ${label}/${row.id}`).toBe('boolean');
    expect(row.reason, `MISSING_GRAPH_REASON: ${label}/${row.id}`).toMatch(/\S/u);
    if (implemented) {
      expect(row.applicable, `KNOWN_IMPLEMENTATION_INAPPLICABLE: ${label}/${row.id}`).toBe(true);
      expect(row.disposition, `KNOWN_IMPLEMENTATION_UNMET: ${label}/${row.id}`).toBe(
        'implementation',
      );
    }
    if (row.applicable) {
      expect(
        ['implementation', 'permitted_alternative', 'unmet'],
        `INVALID_GRAPH_DISPOSITION: ${label}/${row.id}`,
      ).toContain(row.disposition);
      if (row.disposition === 'unmet')
        expect(row.recovery, `MISSING_GRAPH_RECOVERY: ${label}/${row.id}`).toMatch(/\S/u);
    } else {
      expect(row.disposition, `INAPPLICABLE_GUARANTEE_CLAIMED: ${label}/${row.id}`).toBeUndefined();
      expect(row.recovery, `INAPPLICABLE_RECOVERY_CLAIMED: ${label}/${row.id}`).toBeUndefined();
    }
  }
}

it('proves repository-current through the actual unmutated public check without a host checklist', () => {
  const result = spawnSync('bun', ['packages/cli/scripts/check-host-contract.ts', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  expect(result.error, `HOST_CONTRACT_PROOF_UNAVAILABLE: ${result.error?.message}`).toBeUndefined();
  expect(
    result.signal ?? undefined,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: checker signalled',
  ).toBeUndefined();
  const report = JSON.parse(result.stdout) as {
    state: string;
    errors: unknown[];
    findings: { code: string }[];
    data: {
      handler_inventory: Parameters<typeof intendedRegistrationIdentity>[0][];
      behavior_adoptions: {
        behavior_id: string;
        owner: string;
        host: string;
        source_family?: string;
        guarantees: string[];
      }[];
      inventory_complete: boolean;
      admission_eligible: boolean;
      ownership_graph: {
        lanes: { id: string }[];
        facets: {
          path: string;
          owner: string;
          lanes: LaneDisposition[];
        }[];
        handler_facets: { id: string; owner: string; lanes: LaneDisposition[] }[];
        registrations: { identity: string; owner: string; facets: string[] }[];
      };
    };
  };
  expect(report.errors, 'HOST_CONTRACT_PROOF_UNAVAILABLE: checker errors').toEqual([]);
  const expectedIdentities = intendedRegistrations()
    .map(intendedRegistrationIdentity)
    .toSorted((left, right) => left.localeCompare(right));
  expect(new Set(expectedIdentities).size).toBe(expectedIdentities.length);
  expect(
    report.data.handler_inventory
      .map(intendedRegistrationIdentity)
      .toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(expectedIdentities);
  const expectedScopes = new Map(
    intendedRegistrations().map(row => [
      intendedRegistrationIdentity(row),
      lanes.filter(
        lane =>
          lane.startsWith(`${row.host}:`) &&
          (row.host !== 'cursor' ||
            lane.endsWith(row.source_family === 'cursor-native' ? ':native' : ':project-hooks')),
      ),
    ]),
  );
  const expectedOwners = new Map(
    intendedRegistrations().map(row => [
      intendedRegistrationIdentity(row),
      intendedRegistrationOwner(row),
    ]),
  );
  for (const source of [...intended.paths, ...intended.additions]) {
    const owner = intendedFacetOwner(source);
    expect(
      existsSync(nodePath.join(root, owner)),
      `INDEPENDENT_OWNER_SOURCE_MISSING: ${source}`,
    ).toBe(true);
  }
  for (const owner of expectedOwners.values())
    expect(
      existsSync(nodePath.join(root, owner)),
      `INDEPENDENT_OWNER_SOURCE_MISSING: ${owner}`,
    ).toBe(true);
  expect(result.status, `REPOSITORY_CURRENT_NOT_COMPLETE: ${JSON.stringify(report.findings)}`).toBe(
    0,
  );
  expect(report.state).toBe('healthy');
  expect(report.data.inventory_complete).toBe(true);
  expect(report.data.admission_eligible, 'Source coverage cannot grant admission').toBe(false);
  const targets = JSON.parse(
    readFileSync(
      nodePath.join(import.meta.dirname, '../fixtures/host-contract/targets.json'),
      'utf8',
    ),
  ) as {
    targets: { agent: string; version: string; runtimes: string[]; delivery_variants?: string[] }[];
  };
  expect(
    targets.targets
      .flatMap(row =>
        row.runtimes.flatMap(runtime =>
          (row.delivery_variants ?? ['native']).map(
            delivery => `${row.agent}:${row.version}:${runtime}:${delivery}`,
          ),
        ),
      )
      .toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(lanes);
  const graph = report.data.ownership_graph;
  expect(
    graph.lanes.map(row => row.id).toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(lanes);
  expect(
    graph.facets.map(row => row.path).toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(
    [...intended.paths, ...intended.additions].toSorted((left, right) => left.localeCompare(right)),
  );
  for (const facet of graph.facets) {
    expect(facet.owner, `WRONG_FACET_OWNER: ${facet.path}`).toBe(intendedFacetOwner(facet.path));
    expectLaneDispositions(
      facet.path,
      facet.lanes,
      [
        'packages/cli/templates/SAFEWORD.md',
        'packages/cli/templates/skills/debug/SKILL.md',
        'packages/cli/templates/hooks/pre-tool-quality.ts',
      ].includes(facet.path),
    );
  }
  expect(
    graph.registrations
      .map(row => row.identity)
      .toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(expectedIdentities);
  expect(Array.isArray(graph.handler_facets)).toBe(true);
  const nodes = [
    ...graph.facets.map(facet => ({ id: facet.path, ...facet })),
    ...graph.handler_facets,
  ];
  for (const registration of graph.registrations) {
    expect(registration.owner, `WRONG_REGISTRATION_OWNER: ${registration.identity}`).toBe(
      expectedOwners.get(registration.identity),
    );
    expect(
      registration.facets.length,
      `MISSING_REGISTRATION_FACETS: ${registration.identity}`,
    ).toBeGreaterThan(0);
    expect(new Set(registration.facets).size).toBe(registration.facets.length);
    const resolved = registration.facets.map(id => {
      const matches = nodes.filter(node => node.id === id);
      expect(matches, `REGISTRATION_FACET_UNRESOLVED: ${registration.identity}/${id}`).toHaveLength(
        1,
      );
      const node = matches[0];
      if (!node) throw new Error(`REGISTRATION_FACET_UNRESOLVED: ${id}`);
      expectLaneDispositions(`${registration.identity}/${id}`, node.lanes);
      const applicable = expectedScopes.get(registration.identity) ?? [];
      expect(applicable.length).toBeGreaterThan(0);
      for (const lane of applicable)
        expect(
          node.lanes.find(row => row.id === lane)?.applicable,
          `REGISTRATION_REQUIRED_LANE_INAPPLICABLE: ${registration.identity}/${id}/${lane}`,
        ).toBe(true);
      return node;
    });
    expect(
      resolved.some(node => node.owner === registration.owner),
      `REGISTRATION_OWNER_DISCONNECTED: ${registration.identity}`,
    ).toBe(true);
    if (registration.owner === 'packages/cli/templates/hooks/pre-tool-quality.ts')
      expect(
        registration.facets,
        `QUALITY_CANONICAL_FACET_MISSING: ${registration.identity}`,
      ).toContain(registration.owner);
  }
  for (const [host, family] of [
    ['claude', 'claude-native'],
    ['cursor', 'cursor-native'],
    ['codex', 'codex-native'],
    ['opencode', 'opencode-v2'],
  ]) {
    const quality = report.data.behavior_adoptions.filter(
      row =>
        row.behavior_id === 'quality.pre-tool' && row.host === host && row.source_family === family,
    );
    expect(quality.length, `KNOWN_QUALITY_ROUTE_UNMET: ${host}/${family}`).toBeGreaterThan(0);
    for (const row of quality) {
      expect(row.owner).toBe('hooks/pre-tool-quality.ts');
      expect(row.guarantees).toEqual(['reject_action']);
    }
  }
}, 150_000);
