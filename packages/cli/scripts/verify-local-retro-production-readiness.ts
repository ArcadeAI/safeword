import process from 'node:process';

import checkedInAttestation from '../src/retro/local-retro-production-attestation.json' with { type: 'json' };
import {
  type LocalRetroProductionAttestation,
  type LocalRetroReadinessManifest,
} from '../src/retro/local-retro-readiness.js';
import checkedInManifest from '../src/retro/local-retro-readiness-manifest.json' with { type: 'json' };
import { verifyLocalRetroProductionReadiness } from './lib/local-retro-production-verifier.js';

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (value === undefined || value === '') throw new Error(`missing ${name}`);
  return value;
}

function productionFaultDigests(
  environment: NodeJS.ProcessEnv,
): LocalRetroReadinessManifest['recoveredFaults'] {
  return JSON.parse(
    required(environment, 'SAFEWORD_RETRO_FAULT_DIGESTS_JSON'),
  ) as LocalRetroReadinessManifest['recoveredFaults'];
}

function productionHarnessEvidence(
  environment: NodeJS.ProcessEnv,
): Parameters<typeof verifyLocalRetroProductionReadiness>[2]['harnessEvidence'] {
  return JSON.parse(required(environment, 'SAFEWORD_RETRO_HARNESS_EVIDENCE_JSON')) as Parameters<
    typeof verifyLocalRetroProductionReadiness
  >[2]['harnessEvidence'];
}

export async function verifyCheckedInLocalRetroProductionReadiness(
  environment: NodeJS.ProcessEnv,
  transport: typeof fetch = fetch,
): Promise<boolean> {
  if (!checkedInManifest.enabled || !checkedInAttestation.enabled) return false;
  return verifyLocalRetroProductionReadiness(
    checkedInManifest as LocalRetroReadinessManifest,
    checkedInAttestation as LocalRetroProductionAttestation,
    {
      collectorCredential: required(environment, 'SAFEWORD_RETRO_COLLECTOR_OPERATOR_CREDENTIAL'),
      collectorOrigin: required(environment, 'SAFEWORD_RETRO_COLLECTOR_ORIGIN'),
      faultDigests: productionFaultDigests(environment),
      fetch: transport,
      githubToken: environment.GITHUB_TOKEN,
      harnessEvidence: productionHarnessEvidence(environment),
      installationId: Number(required(environment, 'SAFEWORD_RETRO_RELAY_INSTALLATION_ID')),
      relayCredential: required(environment, 'SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL'),
      relayOrigin: required(environment, 'SAFEWORD_RETRO_RELAY_ORIGIN'),
      repository: required(environment, 'SAFEWORD_RETRO_RELAY_REPOSITORY'),
      tenantId: required(environment, 'SAFEWORD_RETRO_RELAY_TENANT_ID'),
    },
  );
}

if (import.meta.main) {
  try {
    if (!(await verifyCheckedInLocalRetroProductionReadiness(process.env))) {
      throw new Error('local retro production readiness is not verified');
    }
    process.stdout.write('Local retro production readiness verified.\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'verification failed'}\n`);
    process.exitCode = 1;
  }
}
