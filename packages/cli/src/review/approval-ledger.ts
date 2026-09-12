import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import nodePath from 'node:path';

export type DesignDecision = 'approved' | 'declined';

interface DecisionIdentity {
  readonly authorityRef: string;
  readonly decision: DesignDecision;
  readonly planDigest: string;
  readonly ticket: string;
}

interface DecisionEvent extends DecisionIdentity {
  readonly appendPosition: number;
  readonly fencingGeneration: number;
  readonly idempotencyKey: string;
  readonly kind: 'design-decision';
  readonly phase: 'plan-implementation';
  readonly timestamp: string;
}

interface LockOwner {
  readonly generation?: number;
  readonly leaseExpiresAt: number;
  readonly pid: number;
  readonly token: string;
}

export interface AppendDecisionResult {
  readonly status: 'existing' | 'pending' | 'written';
}

const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 2000;
const LOCK_LEASE_MS = 10_000;
const waiter = new Int32Array(new SharedArrayBuffer(4));

function lockTimeoutMs(): number {
  const configured = Number(process.env.SAFEWORD_APPROVAL_LOCK_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1 && configured <= 30_000
    ? configured
    : LOCK_TIMEOUT_MS;
}

const decisionLinePattern =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) cli design-decision:(\{.*\})$/u;

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isDecisionEvent(event: DecisionEvent): boolean {
  const decisionIsKnown = event.decision === 'approved' || event.decision === 'declined';
  const identityIsComplete =
    typeof event.ticket === 'string' &&
    typeof event.planDigest === 'string' &&
    typeof event.authorityRef === 'string' &&
    typeof event.idempotencyKey === 'string';
  return (
    event.kind === 'design-decision' &&
    event.phase === 'plan-implementation' &&
    decisionIsKnown &&
    identityIsComplete &&
    isPositiveInteger(event.appendPosition) &&
    isPositiveInteger(event.fencingGeneration)
  );
}

function parseDecisionEvent(line: string): DecisionEvent | undefined {
  const match = decisionLinePattern.exec(line);
  if (match === null) return undefined;
  try {
    const event = JSON.parse(match[2] ?? '') as DecisionEvent;
    return isDecisionEvent(event) && event.timestamp === match[1] ? event : undefined;
  } catch {
    return undefined;
  }
}

function decisionEvents(ledger: string): DecisionEvent[] {
  return ledger
    .split('\n')
    .map(line => parseDecisionEvent(line))
    .filter((event): event is DecisionEvent => event !== undefined);
}

function idempotencyKey(identity: DecisionIdentity, supersedesPosition: number): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        identity.ticket,
        identity.planDigest,
        identity.decision,
        identity.authorityRef,
        supersedesPosition,
      ]),
    )
    .digest('hex');
}

function matchingDecisionState(
  events: readonly DecisionEvent[],
  ticket: string,
  planDigest: string,
): { readonly current?: DecisionEvent; readonly highestPosition: number } {
  const matching = events.filter(
    event => event.ticket === ticket && event.planDigest === planDigest,
  );
  const highestPosition = Math.max(0, ...matching.map(event => event.appendPosition));
  const current = matching.filter(event => event.appendPosition === highestPosition);
  return { current: current.length === 1 ? current[0] : undefined, highestPosition };
}

function matchesCurrentIdentity(
  current: DecisionEvent | undefined,
  identity: DecisionIdentity,
): boolean {
  return current?.decision === identity.decision && current.authorityRef === identity.authorityRef;
}

function processIsAlive(pid: number): boolean | undefined {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error)) return undefined;
    if (error.code === 'ESRCH') return false;
    return undefined;
  }
}

function readOwner(path: string): LockOwner | undefined {
  try {
    const owner = JSON.parse(readFileSync(path, 'utf8')) as LockOwner;
    return typeof owner.token === 'string' &&
      Number.isSafeInteger(owner.pid) &&
      Number.isFinite(owner.leaseExpiresAt)
      ? owner
      : undefined;
  } catch {
    return undefined;
  }
}

function publishNewFile(path: string, content: string): void {
  const descriptor = openSync(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  try {
    writeSync(descriptor, content);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function atomicReplace(path: string, content: string, token: string): void {
  const temporary = `${path}.${token}.tmp`;
  try {
    publishNewFile(temporary, content);
    renameSync(temporary, path);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      // The temporary file may not have been created.
    }
    throw error;
  }
}

function tryReclaim(lockPath: string, owner: LockOwner | undefined): void {
  if (owner === undefined || owner.leaseExpiresAt >= Date.now()) return;
  if (processIsAlive(owner.pid) !== false) return;
  const abandoned = `${lockPath}.abandoned.${randomUUID()}`;
  try {
    renameSync(lockPath, abandoned);
    unlinkSync(abandoned);
  } catch {
    // Another contender won reclamation or the lock is not safely reclaimable.
  }
}

function acquireLock(lockPath: string): LockOwner | undefined {
  const deadline = Date.now() + lockTimeoutMs();
  while (Date.now() <= deadline) {
    const owner: LockOwner = {
      leaseExpiresAt: Date.now() + LOCK_LEASE_MS,
      pid: process.pid,
      token: randomUUID(),
    };
    try {
      publishNewFile(lockPath, `${JSON.stringify(owner)}\n`);
      return owner;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') {
        return undefined;
      }
      tryReclaim(lockPath, readOwner(lockPath));
      Atomics.wait(waiter, 0, 0, LOCK_RETRY_MS);
    }
  }
  return undefined;
}

function releaseLock(lockPath: string, owner: LockOwner): void {
  if (readOwner(lockPath)?.token !== owner.token) return;
  try {
    unlinkSync(lockPath);
  } catch {
    // A failed release leaves a lease that a later writer can safely inspect.
  }
}

function readGeneration(fencePath: string, events: readonly DecisionEvent[]): number | undefined {
  const highestEventGeneration = Math.max(0, ...events.map(event => event.fencingGeneration));
  if (!existsSync(fencePath)) return highestEventGeneration === 0 ? 0 : undefined;
  try {
    const generation = Number(readFileSync(fencePath, 'utf8').trim());
    return Number.isSafeInteger(generation) &&
      generation >= highestEventGeneration &&
      generation > 0
      ? generation
      : undefined;
  } catch {
    return undefined;
  }
}

function publishGeneration(fencePath: string, generation: number, token: string): void {
  const content = `${generation}\n`;
  if (generation === 1 && !existsSync(fencePath)) publishNewFile(fencePath, content);
  else atomicReplace(fencePath, content, token);
}

function lockStillOwned(lockPath: string, fencePath: string, owner: LockOwner): boolean {
  const current = readOwner(lockPath);
  if (current?.token !== owner.token || current.generation !== owner.generation) return false;
  try {
    return Number(readFileSync(fencePath, 'utf8').trim()) === owner.generation;
  } catch {
    return false;
  }
}

function staleFenceForTest(fencePath: string, generation: number): void {
  if (process.env.NODE_ENV === 'test' && process.env.SAFEWORD_APPROVAL_TEST_STALE_FENCE === '1') {
    writeFileSync(fencePath, `${generation + 1}\n`, { mode: 0o600 });
  }
}

export function appendDesignDecision(
  ledgerPath: string,
  identity: DecisionIdentity,
): AppendDecisionResult {
  mkdirSync(nodePath.dirname(ledgerPath), { recursive: true });
  const lockPath = `${ledgerPath}.approval-lock`;
  const fencePath = `${ledgerPath}.approval-fence`;
  const owner = acquireLock(lockPath);
  if (owner === undefined) return { status: 'pending' };
  try {
    const ledger = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
    const events = decisionEvents(ledger);
    const matching = matchingDecisionState(events, identity.ticket, identity.planDigest);
    if (matchesCurrentIdentity(matching.current, identity)) return { status: 'existing' };
    const key = idempotencyKey(identity, matching.highestPosition);
    const currentGeneration = readGeneration(fencePath, events);
    if (currentGeneration === undefined) return { status: 'pending' };
    const generation = currentGeneration + 1;
    publishGeneration(fencePath, generation, owner.token);
    const owned: LockOwner = { ...owner, generation };
    writeFileSync(lockPath, `${JSON.stringify(owned)}\n`, { mode: 0o600 });
    staleFenceForTest(fencePath, generation);
    if (!lockStillOwned(lockPath, fencePath, owned)) return { status: 'pending' };
    const appendPosition = Math.max(0, ...events.map(event => event.appendPosition)) + 1;
    const timestamp = new Date().toISOString();
    const event: DecisionEvent = {
      ...identity,
      appendPosition,
      fencingGeneration: generation,
      idempotencyKey: key,
      kind: 'design-decision',
      phase: 'plan-implementation',
      timestamp,
    };
    const receipt = `${timestamp} cli human-approval:${identity.decision} ${JSON.stringify({
      ticket: identity.ticket,
      phase: 'plan-implementation',
      planDigest: identity.planDigest,
    })}`;
    const separator = ledger === '' || ledger.endsWith('\n') ? '' : '\n';
    atomicReplace(
      ledgerPath,
      `${ledger}${separator}${timestamp} cli design-decision:${JSON.stringify(event)}\n${receipt}\n`,
      owner.token,
    );
    return { status: 'written' };
  } catch {
    return { status: 'pending' };
  } finally {
    releaseLock(lockPath, owner);
  }
}

export function currentDesignDecision(
  ledgerPath: string,
  ticket: string,
  planDigest: string,
): DesignDecision | undefined {
  if (!existsSync(ledgerPath)) return undefined;
  let events: DecisionEvent[];
  try {
    events = decisionEvents(readFileSync(ledgerPath, 'utf8'));
  } catch {
    return undefined;
  }
  return matchingDecisionState(events, ticket, planDigest).current?.decision;
}
