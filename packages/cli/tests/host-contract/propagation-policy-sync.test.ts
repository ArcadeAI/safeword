import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import {
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
} from '../helpers/native-catalogue-probe.js';
import {
  createPropagationSource,
  generatePropagationPackage,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// Real public generator/bundler seam: mutate canonical source AFTER creating
// its owned package. A rendered skill alone cannot establish runtime currency.
it.each(['portable', 'opencode', 'claude'] as const)(
  'bundles %s with the current canonical policy, not the older owned source snapshot',
  async host => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-policy-sync-'));
    try {
      const inputs = createCanonicalCatalogueInputs(root);
      const sourcePackage = createPropagationSource(root, inputs);
      const marker = 'VERIFICATION_ab-cd';
      requirePropagationVerificationMarker(inputs, marker);
      const current = { ...inputs, sourcePackage };
      let packageRoot: string;
      if (host === 'portable') {
        const probe = await createNativeCatalogueProbe(root, undefined, 'explain', current);
        packageRoot = probe.packageRoot;
      } else {
        packageRoot = nodePath.join(root, 'candidate');
        await generatePropagationPackage(current, packageRoot, host);
      }
      expect(
        readFileSync(nodePath.join(packageRoot, 'runtime/cli.js'), 'utf8'),
        'PROPAGATION_CANONICAL_RUNTIME_NOT_SYNCHRONIZED',
      ).toContain(marker);
      expect(
        readFileSync(nodePath.join(sourcePackage, 'templates/hooks/lib/done-gate.ts'), 'utf8'),
      ).toContain(marker);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000,
);
