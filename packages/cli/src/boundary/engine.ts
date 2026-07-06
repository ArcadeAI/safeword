/**
 * Boundary reconciliation engine (ticket CDRJTW, #810 slice 1-2).
 *
 * Pure composition of safeword's existing evidence checks over the ticket
 * artifacts present in a change. The command layer discovers the change and
 * supplies prior/proposed/at-rest content; this module owns which checks run
 * and how verdicts are shaped. Warn-and-record: verdicts never carry a
 * blocking signal in this slice — hard-block tiers are the server-side child
 * of #810.
 */

import { checkVerifyArtifact } from '../../templates/hooks/lib/done-gate.js';
import { parseFrontmatter } from '../../templates/hooks/lib/hierarchy.js';
import { parseImplPlan } from '../../templates/hooks/lib/impl-plan.js';
import { type ShaResolver, validateLedger } from '../../templates/hooks/lib/ledger-validation.js';
import {
  detectUnanchoredPhaseTransition,
  evaluateTicketWrite,
} from '../../templates/hooks/lib/phase-provenance.js';

/** Ticket-artifact basenames the engine knows how to reconcile. */
export const TICKET_ARTIFACTS = new Set([
  'ticket.md',
  'test-definitions.md',
  'verify.md',
  'impl-plan.md',
  'spec.md',
]);

export interface ChangedArtifact {
  /** Artifact basename, e.g. `ticket.md`. */
  artifact: string;
  /** Content before the change; undefined = artifact is being created. */
  prior?: string;
  /** Content after the change; undefined = artifact is being deleted. */
  proposed?: string;
}

/** One touched ticket: its changed artifacts plus at-rest context. */
export interface TicketChange {
  /** Ticket folder name, e.g. `BND001-clean`. */
  ticketFolder: string;
  artifacts: ChangedArtifact[];
  /** ticket.md as it stands after the change (staged version, else on-disk). */
  ticketCurrent?: string;
  /** Whether a test-definitions.md exists for this ticket (staged or on disk). */
  hasLedger: boolean;
}

export type Verdict = 'pass' | 'warn' | 'indeterminate';

export interface CheckVerdict {
  check: string;
  verdict: Verdict;
  detail?: string;
}

export interface TicketReconciliation {
  ticket: string;
  checks: CheckVerdict[];
}

/** Phases at which a feature's R/G/R ledger must already exist. */
const LEDGER_REQUIRED_PHASES = new Set(['scenario-gate', 'implement', 'verify', 'done']);

function frontmatterOf(content: string): Record<string, string | string[]> | undefined {
  const match = /^---\n([\s\S]*?)\n---/.exec(content.replaceAll('\r\n', '\n'));
  if (!match) return undefined;
  const parsed = parseFrontmatter(match[1] ?? '');
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function scalar(meta: Record<string, string | string[]>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function hasEntries(meta: Record<string, string | string[]>, key: string): boolean {
  const value = meta[key];
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value !== '';
}

function pass(check: string): CheckVerdict {
  return { check, verdict: 'pass' };
}

function warnVerdict(check: string, detail: string): CheckVerdict {
  return { check, verdict: 'warn', detail };
}

/**
 * The unreachable-anchor warning names both honest and dishonest causes: the
 * same verdict covers a forged SHA and a shallow clone missing history
 * (friction-register constraint — never accuse when the environment explains).
 */
const UNREACHABLE_CAUSES =
  'possible causes: a forged anchor, or a shallow clone missing the history (fetch full history to verify)';

/** Transition checks over a staged/changed ticket.md. */
function ticketFileChecks(ticketFile: ChangedArtifact, resolveSha?: ShaResolver): CheckVerdict[] {
  if (ticketFile.proposed === undefined) return [];
  const checks: CheckVerdict[] = [];

  if (frontmatterOf(ticketFile.proposed) === undefined) {
    checks.push(
      warnVerdict(
        'classify',
        'ticket.md cannot be classified — its frontmatter is missing or unparseable',
      ),
    );
  }

  const legality = evaluateTicketWrite(ticketFile.prior, ticketFile.proposed);
  checks.push(
    legality.ok ? pass('phase-legality') : warnVerdict('phase-legality', legality.reason),
  );

  // A resolver failure (git broken mid-run, shallow-clone fetch error) must
  // degrade to an indeterminate verdict, never a crash — exit-0 is absolute.
  try {
    const anchor = detectUnanchoredPhaseTransition(
      ticketFile.prior,
      ticketFile.proposed,
      resolveSha,
    );
    if (anchor.kind === 'unanchored') {
      const causes = /not reachable/i.test(anchor.reason) ? ` — ${UNREACHABLE_CAUSES}` : '';
      checks.push(warnVerdict('phase-anchor', `${anchor.reason}${causes}`));
    } else {
      checks.push(pass('phase-anchor'));
    }
  } catch {
    checks.push({
      check: 'phase-anchor',
      verdict: 'indeterminate',
      detail: 'SHA resolution failed mid-run — reachability could not be determined',
    });
  }

  return checks;
}

/**
 * Birth legality for a ticket at rest (#675): a feature past intake whose
 * folder is touched, whose ticket.md is NOT part of the change, and which
 * carries no traversal evidence (no phase_anchors) must justify its birth via
 * phase_skips — the same rule the write-time gate applies to creations.
 */
function atRestBirthCheck(change: TicketChange): CheckVerdict[] {
  if (change.artifacts.some(a => a.artifact === 'ticket.md')) return [];
  if (change.ticketCurrent === undefined) return [];
  const meta = frontmatterOf(change.ticketCurrent);
  if (meta === undefined) return [];
  if (scalar(meta, 'type') !== 'feature') return [];
  const phase = scalar(meta, 'phase');
  if (phase === undefined || phase === 'intake') return [];
  if (hasEntries(meta, 'phase_anchors')) return [pass('birth')];

  const birth = evaluateTicketWrite(undefined, change.ticketCurrent);
  return birth.ok
    ? [pass('birth')]
    : [warnVerdict('birth', `ticket at rest looks born past intake: ${birth.reason}`)];
}

/** The phase at which a changed ticket requires a ledger, or undefined. */
function ledgerRequiredPhase(change: TicketChange): string | undefined {
  if (change.ticketCurrent === undefined) return undefined;
  const meta = frontmatterOf(change.ticketCurrent);
  if (meta === undefined || scalar(meta, 'type') !== 'feature') return undefined;
  const phase = scalar(meta, 'phase');
  return phase !== undefined && LEDGER_REQUIRED_PHASES.has(phase) ? phase : undefined;
}

/** Ledger presence + format (content tier — reachability is the push tier's job). */
function ledgerChecks(change: TicketChange, resolveSha?: ShaResolver): CheckVerdict[] {
  const checks: CheckVerdict[] = [];

  const requiredAt = ledgerRequiredPhase(change);
  if (requiredAt !== undefined && !change.hasLedger) {
    checks.push(
      warnVerdict(
        'ledger',
        `feature at phase ${requiredAt} has no test-definitions.md — the R/G/R ledger is missing`,
      ),
    );
  }

  const ledgerFile = change.artifacts.find(a => a.artifact === 'test-definitions.md');
  if (ledgerFile?.proposed !== undefined) {
    // Content tier treats every SHA as resolvable; the push tier injects the
    // real resolver. A resolver failure degrades to indeterminate, never a crash.
    try {
      const result = validateLedger(ledgerFile.proposed, resolveSha ?? (() => true));
      checks.push(
        result.ok
          ? pass('ledger-format')
          : warnVerdict(
              'ledger-format',
              `ledger annotation problems: ${result.errors.join(' | ')}`,
            ),
      );
    } catch {
      checks.push({
        check: 'ledger-format',
        verdict: 'indeterminate',
        detail: 'SHA resolution failed mid-run — ledger reachability could not be determined',
      });
    }
  }

  return checks;
}

/** Shape checks for verify.md and impl-plan.md when they are part of the change. */
function artifactShapeChecks(change: TicketChange): CheckVerdict[] {
  const checks: CheckVerdict[] = [];

  const verifyFile = change.artifacts.find(a => a.artifact === 'verify.md');
  if (verifyFile?.proposed !== undefined) {
    const verdict = checkVerifyArtifact(verifyFile.proposed);
    checks.push(
      verdict.ok
        ? pass('verify-shape')
        : warnVerdict('verify-shape', `verify.md fails its shape check: ${verdict.reason}`),
    );
  }

  const planFile = change.artifacts.find(a => a.artifact === 'impl-plan.md');
  if (planFile?.proposed !== undefined) {
    const parsed = parseImplPlan(planFile.proposed);
    checks.push(
      parsed.errors.length === 0
        ? pass('impl-plan-shape')
        : warnVerdict(
            'impl-plan-shape',
            `impl-plan.md fails its shape check: ${parsed.errors.join(' | ')}`,
          ),
    );
  }

  return checks;
}

/** Checks for one touched ticket. Content-only without a resolver (commit tier);
 * history-backed SHA verification when one is injected (push tier). */
function reconcileTicket(change: TicketChange, resolveSha?: ShaResolver): CheckVerdict[] {
  const ticketFile = change.artifacts.find(a => a.artifact === 'ticket.md');
  return [
    ...(ticketFile ? ticketFileChecks(ticketFile, resolveSha) : []),
    ...atRestBirthCheck(change),
    ...ledgerChecks(change, resolveSha),
    ...artifactShapeChecks(change),
  ];
}

/**
 * Reconcile every ticket touched by a change. Returns one entry per ticket,
 * each carrying its per-check verdicts — pass entries included, so a clean
 * run is a recorded fact, not an absence. `resolveSha` is the push tier's
 * injected history oracle; the commit tier passes none and stays content-only.
 */
export function reconcileChange(
  changes: TicketChange[],
  resolveSha?: ShaResolver,
): TicketReconciliation[] {
  return changes.map(change => ({
    ticket: change.ticketFolder,
    checks: reconcileTicket(change, resolveSha),
  }));
}

/** All findings (non-pass verdicts) across a reconciliation, for warning output. */
export function findings(
  reconciliations: TicketReconciliation[],
): { ticket: string; check: CheckVerdict }[] {
  return reconciliations.flatMap(({ ticket, checks }) =>
    checks.filter(c => c.verdict !== 'pass').map(check => ({ ticket, check })),
  );
}
