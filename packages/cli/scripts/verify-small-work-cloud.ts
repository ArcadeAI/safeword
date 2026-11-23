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

type HostedCase = 'response-contract-promotion' | 'response-contract-ticket-edit-promotion';

function verifyCase(value: unknown, scenario: HostedCase): void {
  const evidence = record(value);
  requireValue(evidence.scenario === scenario, `Expected case ${scenario}.`);
  if (scenario === 'response-contract-ticket-edit-promotion') {
    requireValue(evidence.dispatch_event === 'PostToolUse', 'Expected a native post-edit event.');
    requireValue(
      evidence.tool_name === 'Edit' || evidence.tool_name === 'Write',
      'Expected a native ticket edit tool.',
    );
    requireValue(evidence.exit_status === 0, 'The post-edit hook must complete successfully.');
    requireValue(
      evidence.observed_outcome === 'promoted',
      'Expected promotion on the ticket edit.',
    );
    requireValue(
      evidence.original_type === 'task' && evidence.original_phase === 'intake',
      'The ticket must start as a task in intake.',
    );
    requireValue(
      evidence.production_write_attempted === false,
      'The ticket must advance before a production write is attempted.',
    );
    requiredText(evidence.native_event_ref, 'native ticket-edit event reference');
  } else {
    requireValue(
      evidence.dispatch_event === 'preToolUse' || evidence.dispatch_event === 'PreToolUse',
      'Expected a native pre-write event.',
    );
    requireValue(
      Number.isSafeInteger(evidence.exit_status),
      'Missing native dispatch exit status.',
    );
    requireValue(evidence.observed_outcome === 'denied', 'The production write must be denied.');
  }
  const originalId = requiredText(evidence.original_ticket_id, 'original ticket ID');
  requireValue(evidence.final_ticket_id === originalId, 'The original ticket must be retained.');
  requireValue(
    evidence.final_type === 'feature' && evidence.final_phase === 'define-behavior',
    'The ticket must return to feature behavior definition.',
  );
  requireValue(evidence.source_unchanged === true, 'The production source must stay unchanged.');
}

function verifyJob(
  value: unknown,
  revision: string,
  scenario: HostedCase,
  seen: Set<string>,
): void {
  const job = record(value);
  const provider = requiredText(job.provider, 'provider');
  const domain = providers.get(provider);
  requireValue(
    scenario !== 'response-contract-ticket-edit-promotion' || provider === 'claude-code-cloud',
    'The ticket-edit promotion case currently requires Claude Code Cloud.',
  );
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
  verifyCase(job.cases[0], scenario);
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
  const scenario = values.case;
  requireValue(
    scenario === 'response-contract-promotion' ||
      scenario === 'response-contract-ticket-edit-promotion',
    'Select --case response-contract-promotion or response-contract-ticket-edit-promotion.',
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
  for (const job of jobs) verifyJob(job, revision, scenario, seen);
  if (scenario === 'response-contract-ticket-edit-promotion') {
    requireValue(seen.has('claude-code-cloud'), 'A Claude Code Cloud record is required.');
  } else {
    requireValue(seen.size === providers.size, 'Both hosted providers are required.');
  }
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
