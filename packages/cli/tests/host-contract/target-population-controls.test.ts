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

it.each([
  ['missing runtime', 'HOST_CONTRACT_TARGET_MISSING'],
  ['wrong version', 'HOST_CONTRACT_TARGET_UNDECLARED'],
  ['wrong runtime', 'HOST_CONTRACT_TARGET_UNDECLARED'],
  ['extra host', 'HOST_CONTRACT_TARGET_UNDECLARED'],
  ['duplicate delivery', 'HOST_CONTRACT_GRAPH_LANE_DUPLICATE'],
  ['wrong delivery', 'HOST_CONTRACT_GRAPH_LANE_UNKNOWN'],
] as const)('rejects %s at the public boundary and clears after repair', (mutation, code) => {
  const directory = createContractRepoFixture();
  fixtures.push(directory);
  const file = nodePath.join(directory, 'packages/cli/tests/fixtures/host-contract/targets.json');
  const original = readFileSync(file, 'utf8');
  const matrix = JSON.parse(original) as {
    targets: { agent: string; version: string; runtimes: string[]; delivery_variants?: string[] }[];
  };
  const first = matrix.targets[0];
  const opencode = matrix.targets.find(row => row.agent === 'opencode');
  expect(first).toBeDefined();
  expect(opencode).toBeDefined();
  if (!first || !opencode) throw new Error('Target fixture setup unavailable');
  switch (mutation) {
    case 'missing runtime': {
      opencode.runtimes = ['CLI'];
      break;
    }
    case 'wrong version': {
      first.version = 'unlisted';
      break;
    }
    case 'wrong runtime': {
      first.runtimes = ['TUI'];
      break;
    }
    case 'extra host': {
      matrix.targets.push({ agent: 'unselected', version: 'unlisted', runtimes: ['CLI'] });
      break;
    }
    case 'duplicate delivery': {
      matrix.targets.push(structuredClone(first));
      break;
    }
    case 'wrong delivery': {
      {
        first.delivery_variants = ['unregistered'];
        // No default
      }
      break;
    }
  }
  writeFileSync(file, JSON.stringify(matrix));
  const rejected = runContractRepoCheck(directory);
  const report = JSON.parse(rejected.output.trim()) as {
    findings: { code: string }[];
    data: { inventory_complete: boolean; admission_eligible: boolean };
  };
  expect(rejected.status).toBe(2);
  expect(report.findings.map(row => row.code)).toContain(code);
  expect(report.data.inventory_complete).toBe(false);
  expect(report.data.admission_eligible).toBe(false);
  writeFileSync(file, original);
  const repaired = runContractRepoCheck(directory);
  expect(repaired.status, repaired.output).toBe(0);
});

it('rejects a product pin that disagrees with the independent current snapshot', () => {
  const directory = createContractRepoFixture();
  fixtures.push(directory);
  const baseline = runContractRepoCheck(directory);
  expect(baseline.entrypoint).toBe('packages/cli/scripts/check-host-contract.ts');
  expect(baseline.status, baseline.output).toBe(0);
  expect(JSON.parse(baseline.output).state).toBe('healthy');
  const file = nodePath.join(directory, 'packages/cli/src/lifecycle/host-releases.json');
  const original = readFileSync(file, 'utf8');
  const releases = JSON.parse(original);
  releases.codex.version = 'unlisted';
  writeFileSync(file, JSON.stringify(releases));
  const rejected = runContractRepoCheck(directory);
  expect(rejected.entrypoint).toBe(baseline.entrypoint);
  expect([0, 2], 'PRODUCT_PIN_CHECK_UNAVAILABLE').toContain(rejected.status);
  expect(rejected.status, 'PRODUCT_HOST_PIN_BYPASSED').toBe(2);
  expect(JSON.parse(rejected.output).findings).toContainEqual(
    expect.objectContaining({ code: 'HOST_CONTRACT_TARGET_UNDECLARED' }),
  );
  writeFileSync(file, original);
  const repaired = runContractRepoCheck(directory);
  expect(repaired.entrypoint).toBe(baseline.entrypoint);
  expect(repaired.status, repaired.output).toBe(0);
});
