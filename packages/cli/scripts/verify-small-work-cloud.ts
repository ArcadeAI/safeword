import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const providers = new Map([
  ['claude-code-cloud', 'claude.ai'],
  ['cursor-cloud-agents', 'cursor.com'],
]);

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(value: unknown): Record<string, unknown> {
  requireValue(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    'Expected an evidence object.',
  );
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, name: string): string {
  requireValue(typeof value === 'string' && value.trim(), `Missing ${name}.`);
  return value;
}

function verifyCase(value: unknown): void {
  const evidence = record(value);
  requireValue(
    evidence.scenario === 'response-contract-promotion',
    'Missing response-contract promotion case.',
  );
  requireValue(
    evidence.dispatch_event === 'preToolUse' || evidence.dispatch_event === 'PreToolUse',
    'Expected a native pre-write event.',
  );
  requireValue(Number.isSafeInteger(evidence.exit_status), 'Missing native dispatch exit status.');
  requireValue(evidence.observed_outcome === 'denied', 'The production write must be denied.');
  const originalId = requiredText(evidence.original_ticket_id, 'original ticket ID');
  requireValue(evidence.final_ticket_id === originalId, 'The original ticket must be retained.');
  requireValue(
    evidence.final_type === 'feature' && evidence.final_phase === 'define-behavior',
    'The ticket must return to feature behavior definition.',
  );
  requireValue(evidence.source_unchanged === true, 'The production source must stay unchanged.');
}

function verifyJob(value: unknown, revision: string, seen: Set<string>): void {
  const job = record(value);
  const provider = requiredText(job.provider, 'provider');
  const domain = providers.get(provider);
  requireValue(domain && !seen.has(provider), `Unexpected or duplicate provider: ${provider}.`);
  const link = new URL(requiredText(job.job_url, 'provider job link'));
  requireValue(
    link.protocol === 'https:' &&
      (link.hostname === domain || link.hostname.endsWith(`.${domain}`)),
    `The job link does not match ${provider}.`,
  );
  const jobId = requiredText(job.job_id, 'provider job ID');
  requireValue(
    link.pathname.split('/').includes(jobId),
    'The provider link must identify the recorded job.',
  );
  requireValue(job.commit_sha === revision, `Wrong candidate commit for ${provider}.`);
  requireValue(
    job.provider_verified === true,
    `Inspect the provider job and record verification for ${provider}.`,
  );
  requiredText(job.host_version, 'host version');
  requiredText(job.safeword_version, 'Safeword version');
  const completedAt = requiredText(job.completed_at, 'job completion time');
  requireValue(Number.isFinite(Date.parse(completedAt)), 'Invalid completion time.');
  requireValue(
    typeof job.runtime_digest === 'string' && /^[a-f0-9]{64}$/u.test(job.runtime_digest),
    'Expected a SHA-256 runtime digest.',
  );
  requireValue(
    Array.isArray(job.cases) && job.cases.length === 1,
    'Expected exactly one response-contract case.',
  );
  verifyCase(job.cases[0]);
  seen.add(provider);
}

function main(): void {
  const { values } = parseArgs({
    options: {
      revision: { type: 'string' },
      evidence: { type: 'string' },
      case: { type: 'string' },
    },
  });
  requireValue(
    values.case === 'response-contract-promotion',
    'Select --case response-contract-promotion. This verifier does not establish the full hosted matrix.',
  );
  const ref = requiredText(values.revision, '--revision');
  const commitSuffix = '^{commit}';
  const revision = execFileSync(
    'git',
    ['rev-parse', '--verify', '--end-of-options', `${ref}${commitSuffix}`],
    { encoding: 'utf8' },
  ).trim();
  const raw = readFileSync(requiredText(values.evidence, '--evidence'));
  const jobs: unknown = JSON.parse(raw.toString('utf8'));
  requireValue(Array.isArray(jobs), 'Evidence must be a list of hosted jobs.');
  const seen = new Set<string>();
  for (const job of jobs) verifyJob(job, revision, seen);
  requireValue(seen.size === providers.size, 'Both hosted providers are required.');
  console.log(
    JSON.stringify({
      case: values.case,
      revision,
      evidence_sha256: createHash('sha256').update(raw).digest('hex'),
      providers: [...seen],
    }),
  );
}

main();
