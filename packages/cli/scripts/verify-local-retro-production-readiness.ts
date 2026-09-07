import { execFileSync } from 'node:child_process';
import process from 'node:process';

import checkedInAttestation from '../src/retro/local-retro-production-attestation.json' with { type: 'json' };
import {
  type LocalRetroProductionAttestation,
  type LocalRetroReadinessManifest,
} from '../src/retro/local-retro-readiness.js';
import checkedInManifest from '../src/retro/local-retro-readiness-manifest.json' with { type: 'json' };
import {
  CHECKED_IN_RELAY_READINESS,
  type RelayBuildAttestation,
  type RelayReadinessManifest,
  SAFEWORD_RELAY_BUILD_ATTESTATION,
  validateBuildAttestedRelayReadiness,
} from '../src/retro/relay-readiness.js';
import {
  type LocalRetroProductionVerificationOptions,
  verifyLocalRetroProductionReadiness,
} from './lib/local-retro-production-verifier.js';

interface GitProof {
  buildCommit: () => string;
  isAncestor: (ancestor: string, descendant: string) => Promise<boolean>;
}

interface VerificationSources {
  attestation: LocalRetroProductionAttestation | { enabled: false; version: 1 };
  git: GitProof;
  manifest: LocalRetroReadinessManifest | { enabled: false; version: 1 };
  relayAttestation: RelayBuildAttestation;
  relayManifest: RelayReadinessManifest | typeof CHECKED_IN_RELAY_READINESS;
}

type RelayReadinessValidator = typeof validateBuildAttestedRelayReadiness;
type VerificationOptions = Omit<LocalRetroProductionVerificationOptions, 'relayReady'>;

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

function gitCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function isGitAncestor(ancestor: string, descendant: string): Promise<boolean> {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant]);
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

const systemGit: GitProof = { buildCommit: gitCommit, isAncestor: isGitAncestor };
const checkedInSources: VerificationSources = {
  attestation: checkedInAttestation as VerificationSources['attestation'],
  git: systemGit,
  manifest: checkedInManifest as VerificationSources['manifest'],
  relayAttestation: SAFEWORD_RELAY_BUILD_ATTESTATION,
  relayManifest: CHECKED_IN_RELAY_READINESS,
};

export function localRetroProductionVerificationOptions(
  environment: NodeJS.ProcessEnv,
  transport: typeof fetch,
  git: GitProof = systemGit,
): VerificationOptions {
  return {
    buildCommit: git.buildCommit(),
    collectorCredential: required(environment, 'SAFEWORD_RETRO_COLLECTOR_OPERATOR_CREDENTIAL'),
    collectorOrigin: required(environment, 'SAFEWORD_RETRO_COLLECTOR_ORIGIN'),
    faultDigests: productionFaultDigests(environment),
    fetch: transport,
    githubToken: environment.GITHUB_TOKEN,
    harnessEvidence: productionHarnessEvidence(environment),
    installationId: Number(required(environment, 'SAFEWORD_RETRO_RELAY_INSTALLATION_ID')),
    isAncestor: git.isAncestor,
    relayCredential: required(environment, 'SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL'),
    relayOrigin: required(environment, 'SAFEWORD_RETRO_RELAY_ORIGIN'),
    repository: required(environment, 'SAFEWORD_RETRO_RELAY_REPOSITORY'),
    tenantId: required(environment, 'SAFEWORD_RETRO_RELAY_TENANT_ID'),
  };
}

export async function verifyCheckedInLocalRetroProductionReadiness(
  environment: NodeJS.ProcessEnv,
  transport: typeof fetch = fetch,
  sources: VerificationSources = checkedInSources,
  validateRelay: RelayReadinessValidator = validateBuildAttestedRelayReadiness,
): Promise<boolean> {
  if (!sources.manifest.enabled || !sources.attestation.enabled) return false;
  const options = localRetroProductionVerificationOptions(environment, transport, sources.git);
  const relayReadiness = await validateRelay(
    sources.relayManifest,
    sources.relayAttestation,
    options.now ?? new Date(),
  );
  return verifyLocalRetroProductionReadiness(sources.manifest, sources.attestation, {
    ...options,
    relayReady: relayReadiness.enabled,
  });
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
