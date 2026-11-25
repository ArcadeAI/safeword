import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(nodePath.dirname(root), { recursive: true, force: true });
});

// Mutate only the disposable graph emitter, independently of its relation inputs.
// A connected graph is insufficient if emitted ownership or links are false.
it.each([
  [
    'extra semantic link',
    'if (owner) links.push(owner);',
    "if (owner) links.push(owner); links.push('behavior:session.quality-state-cleanup');",
    'HOST_CONTRACT_GRAPH_LINK_EXTRA',
  ],
  [
    'wrong emitted owner',
    'return { identity, owner, facets: [...new Set(links)] };',
    "return { identity, owner: 'packages/cli/templates/SAFEWORD.md', facets: [...new Set(links)] };",
    'HOST_CONTRACT_GRAPH_OWNER_MISMATCH',
  ],
  [
    'duplicate registration',
    '  validateGraph(\n',
    '  registrations.push(registrations[0]!);\n  validateGraph(\n',
    'HOST_CONTRACT_GRAPH_REGISTRATION_DUPLICATE',
  ],
  [
    'duplicate canonical node',
    '  validateGraph(\n',
    '  nodes.push(nodes[0]!);\n  validateGraph(\n',
    'HOST_CONTRACT_GRAPH_NODE_DUPLICATE',
  ],
  [
    'inapplicable linked lane',
    '    applicable,\n    reason,',
    '    applicable: false,\n    reason,',
    'HOST_CONTRACT_GRAPH_LANE_LINK_MISSING',
  ],
] as const)(
  'rejects %s and repairs through the public source checker',
  (_name, from, to, code) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/cli/src/host-contract/owner-inventory.ts');
    const original = readFileSync(path, 'utf8');
    expect(original).toContain(from);
    writeFileSync(
      path,
      original.replace(from, () => to),
    );
    const broken = runContractRepoCheck(root);
    expect(broken.status, `GRAPH_INTEGRITY_BYPASS_ACCEPTED: ${code}`).toBe(2);
    expect(JSON.parse(broken.output).findings).toContainEqual(expect.objectContaining({ code }));
    writeFileSync(path, original);
    expect(runContractRepoCheck(root).status).toBe(0);
  },
  120_000,
);
