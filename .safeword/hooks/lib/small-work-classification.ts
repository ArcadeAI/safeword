import { createHash } from 'node:crypto';
import nodePath from 'node:path';

const FACTS_HEADING = '## Safeword small-work facts';
export function hasSmallWorkFacts(ticket: string): boolean {
  return ticket.split(/\r?\n/u).includes(FACTS_HEADING);
}

const FACTS_BLOCK =
  /^(## Safeword small-work facts\r?\n\r?\n```json\r?\n)([\s\S]*?)(\r?\n```[ \t]*)$/gm;

export function readSmallWorkFacts(ticket: string): unknown {
  const blocks = [...ticket.matchAll(FACTS_BLOCK)];
  if (blocks.length !== 1) return undefined;
  try {
    return JSON.parse(blocks[0]?.[2] ?? '') as unknown;
  } catch {
    return undefined;
  }
}

export function smallWorkContractDigest(facts: { proof?: unknown; evaluation?: unknown }): string {
  const { proof: _proof, evaluation: _evaluation, ...contract } = facts;
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

export function replaceSmallWorkFacts(ticket: string, facts: unknown): string {
  return ticket.replace(
    FACTS_BLOCK,
    (_block, start: string, _json: string, end: string) => start + JSON.stringify(facts) + end,
  );
}

export function smallWorkAdmissionPath(projectRoot: string, ticketId: string): string {
  const key = createHash('sha256').update(ticketId).digest('hex');
  return nodePath.join(projectRoot, '.safeword', 'state', 'small-work', `${key}.token`);
}

export const consequentialDecisions = [
  'behavior',
  'shared-contract',
  'architecture',
  'data-ownership',
  'retention',
  'migration',
  'compatibility',
  'proof-boundary',
] as const;

export type ConsequentialDecision = (typeof consequentialDecisions)[number];

export interface SmallWorkFacts {
  readonly schemaVersion: 1;
  readonly scope: string;
  readonly outcome: string;
  readonly decisions: Readonly<Record<ConsequentialDecision, 'settled' | 'unresolved'>>;
  readonly introducesUserFlow: boolean;
  readonly multipleUserFlows: boolean;
  readonly newPersistentState: boolean;
  readonly changesSharedContract: boolean;
  readonly changesBehavior: boolean;
  readonly verification: 'existing' | 'targeted' | 'new-regression';
  readonly pendingScopeDecision?: string;
}

export type SmallWorkClassification =
  | {
      readonly status: 'classified';
      readonly route: 'patch' | 'task' | 'feature';
      readonly reasons: readonly string[];
    }
  | { readonly status: 'action_required' | 'failed'; readonly reasons: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const booleanFacts = [
  'introducesUserFlow',
  'multipleUserFlows',
  'newPersistentState',
  'changesSharedContract',
  'changesBehavior',
] as const;

function featureReasons(facts: SmallWorkFacts): string[] {
  const reasons: string[] = consequentialDecisions
    .filter(decision => facts.decisions[decision] === 'unresolved')
    .map(decision => `unresolved ${decision}`);
  if (facts.introducesUserFlow) reasons.push('new user flow');
  if (facts.multipleUserFlows) reasons.push('multiple user flows');
  if (facts.newPersistentState) reasons.push('new persistent state');
  if (facts.changesSharedContract) reasons.push('shared public contract changes');
  return reasons;
}

/** Classify evidence supplied by a workflow. Ticket type and change size confer no precedence. */
export function classifySmallWork(input: unknown): SmallWorkClassification {
  if (!isRecord(input) || input.schemaVersion !== 1) {
    return { status: 'failed', reasons: ['Expected small-work facts with schemaVersion 1.'] };
  }

  const decisions = input.decisions;
  if (decisions !== undefined && !isRecord(decisions)) {
    return { status: 'failed', reasons: ['Expected a record of consequential decisions.'] };
  }

  const fields = ['scope', 'outcome', ...booleanFacts, 'verification'] as const;
  const missing = fields.filter(field => input[field] === undefined);
  const missingDecisions = consequentialDecisions.filter(
    decision => decisions?.[decision] === undefined,
  );
  if (missing.length > 0 || missingDecisions.length > 0) {
    return {
      status: 'action_required',
      reasons: [...missing, ...missingDecisions.map(decision => `decisions.${decision}`)],
    };
  }

  if (
    typeof input.scope !== 'string' ||
    input.scope.trim() === '' ||
    typeof input.outcome !== 'string' ||
    input.outcome.trim() === '' ||
    booleanFacts.some(field => typeof input[field] !== 'boolean') ||
    (input.verification !== 'existing' &&
      input.verification !== 'targeted' &&
      input.verification !== 'new-regression') ||
    consequentialDecisions.some(
      decision => decisions?.[decision] !== 'settled' && decisions?.[decision] !== 'unresolved',
    ) ||
    (input.pendingScopeDecision !== undefined &&
      (typeof input.pendingScopeDecision !== 'string' || input.pendingScopeDecision.trim() === ''))
  ) {
    return { status: 'failed', reasons: ['Small-work facts contain an invalid value.'] };
  }

  const facts = input as unknown as SmallWorkFacts;
  if (facts.pendingScopeDecision !== undefined) {
    return { status: 'action_required', reasons: [facts.pendingScopeDecision] };
  }
  const reasons = featureReasons(facts);
  if (reasons.length > 0) return { status: 'classified', route: 'feature', reasons };
  if (!facts.changesBehavior && facts.verification !== 'new-regression') {
    return {
      status: 'classified',
      route: 'patch',
      reasons: ['established outcome with focused verification'],
    };
  }
  return { status: 'classified', route: 'task', reasons: ['bounded work with no feature trigger'] };
}

export function renderSmallWorkFacts(facts: unknown): string {
  return '\n## Safeword small-work facts\n\n```json\n' + JSON.stringify(facts) + '\n```\n';
}
