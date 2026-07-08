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
import { parseImplPlan } from '../../templates/hooks/lib/impl-plan.js';
import { type ShaResolver, validateLedger } from '../../templates/hooks/lib/ledger-validation.js';
import {
  type ArtifactReader,
  detectUnanchoredPhaseTransition,
  evaluateTicketWrite,
  frontmatterOf as parseTicketFrontmatter,
  scalar,
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

/** One legality step: a single commit's before/after view of ticket.md. */
export interface LegalityStep {
  prior?: string;
  proposed: string;
  /** Short SHA of the commit this step came from, for warning attribution. */
  commit?: string;
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
  /**
   * Per-commit ticket.md transitions for phase legality (N76NQ0). Supplied by
   * the push tier so a multi-commit range that traversed phases one legal step
   * at a time is judged commit-by-commit, never by its endpoints (the CDRJTW
   * closing-push false positive). Absent at commit tier — the endpoint pair IS
   * the single step there.
   */
  legalitySteps?: LegalityStep[];
}

type Verdict = 'pass' | 'warn' | 'indeterminate';

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

/**
 * Ticket frontmatter, tolerant of CRLF git blobs — the shared parser is
 * LF-only, so normalize before delegating (engine reads raw git content).
 * `scalar` is imported from the same module.
 */
function frontmatterOf(content: string): Record<string, string | string[]> | undefined {
  return parseTicketFrontmatter(content.replaceAll('\r\n', '\n'));
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

/** A check that could not run to a conclusion (oracle failed mid-run) — never a crash. */
function indeterminate(check: string, detail: string): CheckVerdict {
  return { check, verdict: 'indeterminate', detail };
}

/**
 * Phase legality over the change (N76NQ0): judged per commit when the caller
 * supplies legality steps (push tier — each range commit against its parent),
 * else over the endpoint pair (commit tier, where the pair IS the one step).
 * First illegal step wins, attributed to its commit.
 */
function legalityVerdict(
  ticketFile: ChangedArtifact,
  legalitySteps?: LegalityStep[],
): CheckVerdict {
  let steps: LegalityStep[] = [];
  if (legalitySteps && legalitySteps.length > 0) {
    steps = legalitySteps;
  } else if (ticketFile.proposed !== undefined) {
    steps = [{ prior: ticketFile.prior, proposed: ticketFile.proposed }];
  }
  for (const step of steps) {
    const verdict = evaluateTicketWrite(step.prior, step.proposed);
    if (!verdict.ok) {
      const at = step.commit === undefined ? '' : ` (commit ${step.commit})`;
      return warnVerdict('phase-legality', `${verdict.reason}${at}`);
    }
  }
  return pass('phase-legality');
}

/**
 * Anchor check over a ticket.md transition, tree-only via the injected reader
 * (never git history, so both tiers verify fully). A reader failure (git
 * broken mid-run) degrades to an indeterminate verdict, never a crash —
 * exit-0 is absolute.
 */
function phaseAnchorVerdict(
  ticketFile: ChangedArtifact,
  readArtifact?: ArtifactReader,
): CheckVerdict {
  try {
    const anchor = detectUnanchoredPhaseTransition(
      ticketFile.prior,
      ticketFile.proposed ?? '',
      readArtifact,
    );
    return anchor.kind === 'unanchored'
      ? warnVerdict('phase-anchor', anchor.reason)
      : pass('phase-anchor');
  } catch {
    return indeterminate(
      'phase-anchor',
      'artifact read failed mid-run — the anchor could not be determined',
    );
  }
}

/** Transition checks over a staged/changed ticket.md. */
function ticketFileChecks(
  ticketFile: ChangedArtifact,
  readArtifact?: ArtifactReader,
  legalitySteps?: LegalityStep[],
): CheckVerdict[] {
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

  checks.push(
    legalityVerdict(ticketFile, legalitySteps),
    phaseAnchorVerdict(ticketFile, readArtifact),
  );

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
      checks.push(
        indeterminate(
          'ledger-format',
          'SHA resolution failed mid-run — ledger reachability could not be determined',
        ),
      );
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

/** Checks for one touched ticket: anchors verify through the tree reader,
 * ledger SHAs through the history resolver — deliberately separate oracles. */
function reconcileTicket(
  change: TicketChange,
  resolveSha?: ShaResolver,
  readArtifact?: ArtifactReader,
): CheckVerdict[] {
  const ticketFile = change.artifacts.find(a => a.artifact === 'ticket.md');
  return [
    ...(ticketFile ? ticketFileChecks(ticketFile, readArtifact, change.legalitySteps) : []),
    ...atRestBirthCheck(change),
    ...ledgerChecks(change, resolveSha),
    ...artifactShapeChecks(change),
  ];
}

/**
 * Reconcile every ticket touched by a change. Returns one entry per ticket,
 * each carrying its per-check verdicts — pass entries included, so a clean
 * run is a recorded fact, not an absence. `resolveSha` is the LEDGER's
 * history oracle (push tier only — the commit tier stays content-only for
 * SHAs); `readArtifact` is the ANCHOR check's view of the tree being shipped
 * (staged index at commit, HEAD at push) — both tiers verify anchors fully,
 * because a tree read fits the commit tier's sub-second budget.
 */
export function reconcileChange(
  changes: TicketChange[],
  resolveSha?: ShaResolver,
  readArtifact?: ArtifactReader,
): TicketReconciliation[] {
  return changes.map(change => ({
    ticket: change.ticketFolder,
    checks: reconcileTicket(change, resolveSha, readArtifact),
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
