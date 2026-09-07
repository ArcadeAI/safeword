import { describe, expect, it, vi } from 'vitest';

import { localRetroProductionVerificationOptions } from '../../scripts/verify-local-retro-production-readiness.js';

describe('local retro production verification entrypoint', () => {
  it('maps the protected release environment to the production verifier contract', async () => {
    const transport = vi.fn<typeof fetch>();
    const isAncestor = vi.fn(() => Promise.resolve(true));
    const environment = {
      GITHUB_TOKEN: 'github-token',
      SAFEWORD_RETRO_COLLECTOR_OPERATOR_CREDENTIAL: 'collector-secret',
      SAFEWORD_RETRO_COLLECTOR_ORIGIN: 'https://collector.example',
      SAFEWORD_RETRO_FAULT_DIGESTS_JSON: JSON.stringify({ workerOutage: 'fault-digest' }),
      SAFEWORD_RETRO_HARNESS_EVIDENCE_JSON: JSON.stringify({
        codex: { lifecycle: 'codex-desktop' },
      }),
      SAFEWORD_RETRO_RELAY_INSTALLATION_ID: '12345',
      SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL: 'relay-secret',
      SAFEWORD_RETRO_RELAY_ORIGIN: 'https://relay.example',
      SAFEWORD_RETRO_RELAY_REPOSITORY: 'ArcadeAI/safeword',
      SAFEWORD_RETRO_RELAY_TENANT_ID: 'production',
    };

    const options = localRetroProductionVerificationOptions(environment, transport, {
      buildCommit: () => 'a'.repeat(40),
      isAncestor,
    });

    expect(options).toMatchObject({
      buildCommit: 'a'.repeat(40),
      collectorCredential: 'collector-secret',
      collectorOrigin: 'https://collector.example',
      faultDigests: { workerOutage: 'fault-digest' },
      githubToken: 'github-token',
      harnessEvidence: { codex: { lifecycle: 'codex-desktop' } },
      installationId: 12_345,
      relayCredential: 'relay-secret',
      relayOrigin: 'https://relay.example',
      repository: 'ArcadeAI/safeword',
      tenantId: 'production',
    });
    expect(options.fetch).toBe(transport);
    await expect(options.isAncestor('parent', 'child')).resolves.toBe(true);
    expect(isAncestor).toHaveBeenCalledWith('parent', 'child');
  });
});
