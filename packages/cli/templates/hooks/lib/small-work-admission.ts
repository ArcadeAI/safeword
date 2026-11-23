import { readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { atomicWriteFile } from './jsonl-spool.js';
import { askTrustedSafeword } from './safeword-cli.js';
import { smallWorkFootprintDenial, smallWorkThresholds } from './small-work-footprint.js';
import {
  classifySmallWork,
  hasSmallWorkFacts,
  readSmallWorkFacts,
  smallWorkAdmissionPath,
  smallWorkContractDigest,
  type SmallWorkFacts,
} from './small-work-classification.js';

const PENDING_PLAN = 'small_work_pending_phase: plan-implementation';

function taskProofDenial(
  projectRoot: string,
  ticketId: string,
  facts: SmallWorkFacts & { proof?: unknown; evaluation?: unknown },
): string | undefined {
  const { proof } = facts;
  if (typeof proof !== 'object' || proof === null) {
    return facts.changesBehavior
      ? 'Record the observed failing test for this task before editing production code.'
      : 'Record a passing test that protects the agreed behavior before editing production code.';
  }
  const { request, observation, relevance } = proof as {
    request?: Record<string, unknown>;
    observation?: Record<string, unknown>;
    relevance?: Record<string, unknown>;
  };
  const currentDigest = smallWorkContractDigest(facts);
  if (
    request?.ticket !== ticketId ||
    (request.expectation === 'pass') === facts.changesBehavior ||
    request.contractDigest !== currentDigest ||
    typeof observation?.tag !== 'string' ||
    relevance?.observationTag !== observation.tag ||
    relevance.relevant !== true ||
    typeof relevance.explanation !== 'string' ||
    relevance.explanation.trim() === ''
  ) {
    return 'Connect the assertion and existing entry point to the current task and test observation.';
  }
  const admissionPath = smallWorkAdmissionPath(projectRoot, ticketId);
  let previousAdmission: string | undefined;
  if (/^[a-f\d]{64}$/u.test(observation.tag)) {
    try {
      previousAdmission = readFileSync(admissionPath, 'utf8').trim();
    } catch {
      // A fresh task will not have an admission record.
    }
  } else {
    return 'The recorded small-work observation is invalid.';
  }
  const answer = askTrustedSafeword(
    projectRoot,
    [
      'ticket',
      'verify-small-work-proof',
      JSON.stringify(request),
      JSON.stringify(observation),
      ...(previousAdmission === undefined ? [] : [previousAdmission]),
    ],
    run => {
      try {
        const { data } = JSON.parse(run.stdout) as {
          data?: { command?: string; current?: boolean; admissionToken?: string };
        };
        if (
          data?.command === 'ticket verify-small-work-proof' &&
          typeof data.current === 'boolean'
        ) {
          return {
            token: run.status === 0 && data.current ? data.admissionToken : undefined,
          };
        }
      } catch {
        // Only an answer from the matching CLI can establish current proof.
      }
      return undefined;
    },
  );
  if (answer.kind !== 'answered' || typeof answer.value.token !== 'string') {
    return 'Safeword could not verify the current task test observation. Run the declared test again before editing production code.';
  }
  if (answer.value.token !== previousAdmission) {
    try {
      atomicWriteFile(admissionPath, `${answer.value.token}\n`);
    } catch {
      return 'Safeword could not retain task proof admission. Retry before editing production code.';
    }
  }
  return undefined;
}

/** Reconcile a canonical ticket edit without attempting a production write. */
export function promoteSmallWorkAfterTicketEdit(
  projectRoot: string,
  ticketPath: string,
  ticketId: string,
): string | undefined {
  return reconcileSmallWork(projectRoot, ticketPath, ticketId);
}

/** Explicit versioned facts opt a ticket into the new route until matched rollout. */
export function smallWorkRoutingDenial(
  projectRoot: string,
  ticketPath: string,
  ticketId: string,
  proposed: string,
): string | undefined {
  return reconcileSmallWork(projectRoot, ticketPath, ticketId, proposed);
}

function reconcileSmallWork(
  projectRoot: string,
  ticketPath: string,
  ticketId: string,
  proposed?: string,
): string | undefined {
  let ticket: string;
  try {
    ticket = readFileSync(ticketPath, 'utf8');
  } catch {
    return 'Safeword could not read the active small-work ticket. Reopen the ticket and retry.';
  }
  if (!hasSmallWorkFacts(ticket)) return undefined;
  try {
    const relative = nodePath.relative(realpathSync(projectRoot), realpathSync(ticketPath));
    if (
      relative === '..' ||
      relative.startsWith(`..${nodePath.sep}`) ||
      nodePath.isAbsolute(relative)
    ) {
      return 'The active small-work ticket resolves outside the project.';
    }
  } catch {
    return 'The active small-work ticket path could not be verified.';
  }

  const beginning = /^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/.exec(ticket);
  const frontmatter = beginning?.[1];
  if (frontmatter === undefined)
    return 'Safeword could not read the small-work ticket frontmatter.';
  if (
    proposed !== undefined &&
    /^type:[ \t]*feature[ \t]*$/m.test(frontmatter) &&
    /^phase:[ \t]*(?:define-behavior|scenario-gate)[ \t]*$/m.test(frontmatter)
  ) {
    return 'Complete behavior definition and its scenario review before editing production code.';
  }
  const smallWork = /^type:[ \t]*(?:task|patch)[ \t]*$/m.test(frontmatter);
  const featureAtIntake =
    /^type:[ \t]*feature[ \t]*$/m.test(frontmatter) &&
    /^phase:[ \t]*intake[ \t]*$/m.test(frontmatter);
  if (!smallWork && !featureAtIntake) return undefined;

  const facts = readSmallWorkFacts(ticket);
  const decision = classifySmallWork(facts);
  if (decision.status !== 'classified') {
    return proposed === undefined
      ? undefined
      : `Small-work classification ${decision.status}: ${decision.reasons.join(', ')}.`;
  }
  const evaluated = facts as SmallWorkFacts & { evaluation?: unknown };
  if (decision.route !== 'feature' && (proposed === undefined || !smallWork)) {
    return undefined;
  }
  try {
    const thresholds = smallWorkThresholds(projectRoot);
    if (decision.route !== 'feature' && proposed !== undefined) {
      const footprintDenial = smallWorkFootprintDenial(
        projectRoot,
        proposed,
        evaluated.evaluation,
        thresholds,
      );
      if (footprintDenial !== undefined) return footprintDenial;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `Safeword could not evaluate the current small-work footprint: ${reason}`;
  }
  if (decision.route !== 'feature') {
    return decision.route === 'task'
      ? taskProofDenial(projectRoot, ticketId, evaluated)
      : undefined;
  }

  const behaviorDecision =
    evaluated.introducesUserFlow ||
    evaluated.multipleUserFlows ||
    evaluated.decisions.behavior === 'unresolved';
  const publication = frontmatter
    .replace(/^type:[ \t]*(?:task|patch)[ \t]*$/m, 'type: feature')
    .replace(/^phase:[^\r\n]*\r?\n?/m, '')
    .trimEnd();
  const newline = ticket.startsWith('---\r\n') ? '\r\n' : '\n';
  const pending = behaviorDecision ? '' : `${newline}${PENDING_PLAN}`;
  const updated = `---${newline}${publication}${newline}phase: define-behavior${pending}${newline}---${ticket.slice(beginning[0].length)}`;
  try {
    if (readFileSync(ticketPath, 'utf8') !== ticket) {
      return 'The active ticket changed during classification. Reevaluate the current ticket before editing production code.';
    }
    atomicWriteFile(ticketPath, updated);
  } catch {
    return 'Safeword could not record the new feature route. Reevaluate the ticket before editing production code.';
  }
  const message = `The active ticket now needs feature planning: ${decision.reasons.join(', ')}. Continue on the same ticket from behavior definition.`;
  return proposed === undefined ? `${message} Reread the ticket before editing it again.` : message;
}
