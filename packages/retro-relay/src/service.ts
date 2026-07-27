/* eslint-disable unicorn/consistent-class-member-order -- Public state-machine operations precede internal transition helpers. */

import { RelayError } from './errors.js';
import { GitHubCreateError, type GitHubRestClient } from './github.js';
import { normalizeRepo, payloadHash, requestMarker } from './identity.js';
import { decryptPayload, encryptPayload } from './payload.js';
import type { DurableRequest, RelayStore } from './store.js';
import type {
  FileRetroDraftRequest,
  FilingReceipt,
  RelayPrincipal,
  RequestScope,
} from './types.js';

export interface RelayFaults {
  afterGitHubCreate?: () => void;
}

function authorize(
  principal: RelayPrincipal,
  request: FileRetroDraftRequest,
  role: 'file' | 'reconcile',
): RequestScope {
  const repo = normalizeRepo(request.repository);
  if (
    !principal.roles.includes(role) ||
    principal.installationId !== request.installationId ||
    principal.repository !== repo
  ) {
    throw new RelayError(403, 'repository is not authorized');
  }
  return {
    tenantId: principal.tenantId,
    installationId: request.installationId,
    repository: repo,
    requestId: request.requestId,
  };
}

function receiptFromRecord(record: DurableRequest): FilingReceipt {
  return {
    receiptId: record.receiptId,
    requestId: record.scope.requestId,
    state: record.state,
    ...(record.issueNumber !== undefined && { issueNumber: record.issueNumber }),
  };
}

function isFiledResult(record: DurableRequest): boolean {
  return ['filed', 'rejected', 'tombstone'].includes(record.state);
}

function validText(value: unknown, maximum: number, allowEmpty = false): value is string {
  return (
    typeof value === 'string' && value.length <= maximum && (allowEmpty || value.trim().length > 0)
  );
}

// eslint-disable-next-line complexity -- Every externally supplied request field has an explicit bound.
function validateRequest(request: unknown): asserts request is FileRetroDraftRequest {
  if (typeof request !== 'object' || request === null) {
    throw new RelayError(400, 'invalid relay filing request');
  }
  const candidate = request as Partial<FileRetroDraftRequest>;
  const keys = Object.keys(request).toSorted((left, right) => left.localeCompare(right));
  const expectedKeys = [
    'body',
    'canonicalKey',
    'installationId',
    'labels',
    'legacySignature',
    'repository',
    'requestId',
    'retryDeadlineAt',
    'title',
  ];
  if (
    keys.join('\0') !== expectedKeys.join('\0') ||
    !validText(candidate.requestId, 36) ||
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u.test(
      candidate.requestId,
    ) ||
    !validText(candidate.retryDeadlineAt, 30) ||
    !Number.isFinite(Date.parse(candidate.retryDeadlineAt)) ||
    new Date(candidate.retryDeadlineAt).toISOString() !== candidate.retryDeadlineAt ||
    !Number.isSafeInteger(candidate.installationId) ||
    (candidate.installationId ?? 0) <= 0 ||
    !validText(candidate.repository, 200) ||
    !/^[\w.-]+\/[\w.-]+$/u.test(candidate.repository) ||
    !validText(candidate.canonicalKey, 256) ||
    !validText(candidate.legacySignature, 256) ||
    !validText(candidate.title, 256) ||
    !validText(candidate.body, 128 * 1024, true) ||
    !Array.isArray(candidate.labels) ||
    candidate.labels.length > 20 ||
    candidate.labels.some(label => !validText(label, 50))
  ) {
    throw new RelayError(400, 'invalid relay filing request');
  }
}

export class RelayService {
  readonly #github: GitHubRestClient;
  readonly #faults: RelayFaults;
  readonly #now: () => Date;
  readonly #payloadKey: Buffer;
  readonly #store: RelayStore;

  constructor(input: {
    store: RelayStore;
    github: GitHubRestClient;
    payloadKey: Buffer;
    faults?: RelayFaults;
    now?: () => Date;
  }) {
    this.#store = input.store;
    this.#github = input.github;
    this.#payloadKey = input.payloadKey;
    this.#now = input.now ?? (() => new Date());
    this.#faults = { ...input.faults };
  }

  operations(principal: RelayPrincipal): ReturnType<RelayStore['operations']> {
    if (!principal.roles.includes('operate')) {
      throw new RelayError(403, 'operate role is required');
    }
    return this.#store.operations();
  }

  async reconcile(principal: RelayPrincipal, receiptId: string): Promise<FilingReceipt> {
    if (!principal.roles.includes('reconcile')) {
      throw new RelayError(403, 'reconcile role is required');
    }
    const record = this.#store.loadByReceiptForPrincipal(receiptId, principal);
    if (record === undefined) {
      throw new RelayError(404, 'filing receipt not found');
    }
    if (isFiledResult(record)) return receiptFromRecord(record);
    if (record.state !== 'ambiguous') {
      throw new RelayError(409, 'only ambiguous filings can be reconciled');
    }
    const scan = await this.#github.scanExactMarker({
      installationId: record.scope.installationId,
      repository: record.scope.repository,
      marker: record.requestMarker,
    });
    if (!scan.complete) {
      this.#store.recordReconciliation(receiptId, principal.subject, 'incomplete', 0);
      throw new RelayError(503, 'raw reconciliation is incomplete or non-unique', {
        receiptId,
        state: 'ambiguous',
        disposition: 'incomplete',
      });
    }
    if (scan.issueNumbers.length !== 1) {
      const disposition = scan.issueNumbers.length === 0 ? 'zero' : 'multiple';
      this.#store.recordReconciliation(
        receiptId,
        principal.subject,
        disposition,
        scan.issueNumbers.length,
      );
      throw new RelayError(503, 'raw reconciliation is incomplete or non-unique', {
        receiptId,
        state: 'ambiguous',
        disposition,
      });
    }
    this.#store.recordReconciliation(receiptId, principal.subject, 'adopted', 1);
    return this.#store.markReconciledFiled(record.scope, scan.issueNumbers[0]);
  }

  status(principal: RelayPrincipal, receiptId: string): FilingReceipt {
    if (!principal.roles.includes('file')) {
      throw new RelayError(403, 'file role is required');
    }
    const record = this.#store.loadByReceiptForPrincipal(receiptId, principal);
    if (record === undefined) {
      throw new RelayError(404, 'filing receipt not found');
    }
    return receiptFromRecord(record);
  }

  async maintain(now = new Date()): Promise<{
    alerts: ReturnType<RelayStore['maintain']>['alerts'];
    attempted: number;
  }> {
    const due = this.#store.claimDueRetries(now);
    for (const record of due) {
      try {
        await this.#processClaimed(record);
      } catch {
        // The durable state records retryable/ambiguous outcomes per request.
        // One poisoned request must not prevent the rest of the sweep.
      }
    }
    return { attempted: due.length, ...this.#store.maintain(now) };
  }

  async submit(principal: RelayPrincipal, request: FileRetroDraftRequest): Promise<FilingReceipt> {
    validateRequest(request);
    const scope = authorize(principal, request, 'file');
    const hash = payloadHash(request);
    const marker = requestMarker(scope);
    const accepted = this.#store.accept({
      scope,
      payloadHash: hash,
      envelope: encryptPayload(request, scope, hash, this.#payloadKey),
      requestMarker: marker,
      retryDeadlineAt: request.retryDeadlineAt,
    });
    // eslint-disable-next-line security/detect-possible-timing-attacks -- Both values are non-secret digests.
    if (accepted.record.payloadHash !== hash) {
      throw new RelayError(409, 'request identity was reused with a different payload');
    }
    if (isFiledResult(accepted.record)) return receiptFromRecord(accepted.record);
    if (accepted.record.state === 'ambiguous') {
      throw new RelayError(503, 'filing outcome is ambiguous', {
        receiptId: accepted.record.receiptId,
        state: 'ambiguous',
      });
    }
    if (!this.#store.claim(scope)) {
      const current = this.#store.receipt(scope);
      if (current === undefined) throw new RelayError(404, 'filing receipt not found');
      return current;
    }
    const claimed = this.#store.load(scope);
    if (claimed === undefined) throw new RelayError(404, 'filing receipt not found');
    return this.#processClaimed(claimed);
  }

  // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Preparation, dispatch, and ambiguity branches are the durable retry state machine.
  async #processClaimed(record: DurableRequest): Promise<FilingReceipt> {
    const { scope } = record;
    const hash = record.payloadHash;
    let durableRequest: FileRetroDraftRequest;
    let installationToken: string;
    try {
      durableRequest = decryptPayload(record.envelope, scope, hash, this.#payloadKey);
      installationToken = await this.#github.installationToken(
        scope.installationId,
        scope.repository,
      );
    } catch (error) {
      this.#store.markRetryable(scope, this.#now());
      if (error instanceof RelayError) throw error;
      throw new RelayError(503, 'filing preparation failed before dispatch');
    }
    const dispatchAt = this.#now();
    if (!this.#store.beginDispatch(scope, dispatchAt)) {
      this.#store.maintain(dispatchAt);
      const current = this.#store.receipt(scope);
      if (current === undefined) throw new RelayError(404, 'filing receipt not found');
      return current;
    }
    try {
      const issueNumber = await this.#github.createIssue({
        repository: scope.repository,
        title: durableRequest.title,
        body: `${durableRequest.body}\n\n${record.requestMarker}`,
        labels: durableRequest.labels,
        installationToken,
      });
      this.#faults.afterGitHubCreate?.();
      return this.#store.markFiled(scope, issueNumber, this.#now());
    } catch (error) {
      if (error instanceof RelayError) throw error;
      if (error instanceof GitHubCreateError) {
        if (error.outcome === 'rejected') {
          return this.#store.markRejected(scope, this.#now());
        }
        if (error.outcome === 'retryable') {
          this.#store.markRetryable(scope, this.#now());
          throw new RelayError(503, 'GitHub rejected create; retry scheduled');
        }
      }
      this.#store.markAmbiguous(scope);
      const currentRecord = this.#store.load(scope);
      throw new RelayError(503, 'filing outcome is ambiguous', {
        ...(currentRecord !== undefined && { receiptId: currentRecord.receiptId }),
        state: 'ambiguous',
      });
    }
  }
}
