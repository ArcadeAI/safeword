import { createHash } from 'node:crypto';

import {
  canonicalizeContractValue,
  parentContractValuesFromSpec,
} from '../utils/product-plan-contract.js';
import { parseTicketMetadata } from '../utils/ticket-metadata.js';

export interface ReviewDispositionContext {
  readonly schema_version: 1;
  readonly current_boundary_digest: string;
  readonly records: readonly {
    readonly version: 1;
    readonly review_kind: string;
    readonly review_id: string;
    readonly finding_fingerprint: string;
    readonly finding_severity: 'info' | 'warning';
    readonly message: string;
    readonly accepted_boundary_digest: string;
    readonly disposition: 'declined';
    readonly reason: string;
    readonly boundary_status: 'current' | 'superseded';
  }[];
}

function acceptedTerms(value: unknown, field: string): readonly string[] {
  const terms = typeof value === 'string' ? [value] : value;
  if (
    !Array.isArray(terms) ||
    terms.length === 0 ||
    terms.some(term => typeof term !== 'string' || term.trim() === '')
  )
    throw new Error(`The ticket must declare ${field}.`);
  return terms as string[];
}

function productBetLines(spec: string): string[] {
  const lines = spec.split('\n');
  const start = lines.findIndex(line => line.trim() === '## Product Bet');
  if (start === -1) throw new Error('The Product Plan must declare a Product Bet.');
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? lines.length : end);
}

function projectNonGoals(spec: string): string {
  const section = productBetLines(spec);
  const index = section.findIndex(line => line.includes('Project non-goals:'));
  if (index === -1) throw new Error('The Product Plan must declare project non-goals.');
  const first =
    section[index]?.split('Project non-goals:', 2)[1]?.replaceAll('**', '').trim() ?? '';
  const continued: string[] = [];
  const remainder = section.slice(index + 1);
  for (const line of remainder) {
    if (line.trim() === '' || line.trimStart().startsWith('- ') || line.startsWith('#')) break;
    continued.push(line.trim());
  }
  const value = [first, ...continued].join(' ').trim();
  if (value === '') throw new Error('The Product Plan must declare project non-goals.');
  return value;
}

/** Digest only accepted scope and the Product Plan boundary, never the decline ledger. */
export function acceptedBoundaryDigest(ticketContent: string, productSpec: string): string {
  const { metadata } = parseTicketMetadata(ticketContent);
  const scope = acceptedTerms(metadata.scope, 'scope');
  const exclusions = acceptedTerms(metadata.out_of_scope, 'out_of_scope');
  let productBoundary: unknown;
  if (metadata.parent === undefined)
    productBoundary = { projectNonGoals: canonicalizeContractValue(projectNonGoals(productSpec)) };
  else {
    if (typeof metadata.parent_job !== 'string' || typeof metadata.milestone !== 'string')
      throw new Error('The ticket must declare its parent job and milestone.');
    const values = parentContractValuesFromSpec(
      productSpec,
      metadata.parent_job,
      metadata.milestone,
    );
    productBoundary = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, canonicalizeContractValue(value)]),
    );
  }
  return createHash('sha256')
    .update(JSON.stringify({ version: 1, scope, exclusions, parent: productBoundary }))
    .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Preserve old declines as history and label their authority against current boundaries. */
export function reviewDispositionContext(
  ticketContent: string,
  productSpec: string,
  reviewKind: string,
): ReviewDispositionContext | undefined {
  const { metadata } = parseTicketMetadata(ticketContent);
  const dispositions = metadata.review_dispositions;
  if (dispositions === undefined) return undefined;
  if (!Array.isArray(dispositions)) throw new Error('The ticket review dispositions are invalid.');
  const current = acceptedBoundaryDigest(ticketContent, productSpec);
  const records = dispositions
    // eslint-disable-next-line complexity -- Validate every persisted authority field before exposing a decline.
    .map((value): ReviewDispositionContext['records'][number] => {
      if (
        !isRecord(value) ||
        value.version !== 1 ||
        typeof value.review_kind !== 'string' ||
        typeof value.review_id !== 'string' ||
        value.disposition !== 'declined' ||
        typeof value.finding_fingerprint !== 'string' ||
        (value.finding_severity !== 'info' && value.finding_severity !== 'warning') ||
        typeof value.finding_message !== 'string' ||
        typeof value.accepted_boundary_digest !== 'string' ||
        typeof value.reason !== 'string'
      )
        throw new Error('The ticket review dispositions are invalid.');
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify({ severity: value.finding_severity, message: value.finding_message }),
        )
        .digest('hex');
      if (value.finding_fingerprint !== fingerprint)
        throw new Error('The ticket review dispositions are invalid.');
      return {
        version: 1 as const,
        review_kind: value.review_kind,
        review_id: value.review_id,
        finding_fingerprint: value.finding_fingerprint,
        finding_severity: value.finding_severity,
        message: value.finding_message,
        accepted_boundary_digest: value.accepted_boundary_digest,
        disposition: 'declined' as const,
        reason: value.reason,
        boundary_status:
          value.accepted_boundary_digest === current
            ? ('current' as const)
            : ('superseded' as const),
      };
    })
    .filter(value => value.review_kind === reviewKind);
  return { schema_version: 1, current_boundary_digest: current, records };
}
