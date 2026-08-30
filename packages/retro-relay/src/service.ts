/* eslint-disable unicorn/consistent-class-member-order -- Public state-machine operations precede internal transition helpers. */

import { RelayError } from './errors.js';
import { GitHubCreateError, type GitHubRestClient } from './github.js';
import { normalizeRepo, payloadHash, requestMarker } from './identity.js';
import { decryptPayload, encryptPayload, type PayloadKeyring } from './payload.js';
import { type DurableRequest, filingReceipt, type RelayStore } from './store.js';
import type {
  FileRetroDraftRequest,
  FilingReceipt,
  RelayPrincipal,
  RequestScope,
} from './types.js';
import { isResolvedReceiptState } from './types.js';

export interface RelayFaults {
  afterGitHubCreate?: () => void;
}

const REQUEST_ID_MAX_LENGTH = 36;
const RETRY_DEADLINE_MAX_LENGTH = 30;
const REPOSITORY_MAX_LENGTH = 200;
const DEDUPE_KEY_MAX_LENGTH = 256;
const TITLE_MAX_LENGTH = 256;
const BODY_MAX_LENGTH = 256 * 1024;
const LABEL_COUNT_MAX = 20;
const LABEL_MAX_LENGTH = 50;

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

function exactEvidenceMarkers(request: FileRetroDraftRequest): [string, string] {
  return [
    `<!-- safeword-retro-signature: ${request.legacySignature} -->`,
    `<!-- safeword-retro-canonical: ${request.canonicalKey} -->`,
  ];
}

function bodyWithAuthorityMarkers(
  request: FileRetroDraftRequest,
  requestMarkerValue: string,
): string {
  let body = request.body;
  for (const marker of [...exactEvidenceMarkers(request), requestMarkerValue]) {
    if (!body.split(/\r?\n/u).includes(marker)) body += `\n${marker}`;
  }
  return body;
}

function rawEvidenceAgrees(body: string, request: FileRetroDraftRequest): boolean {
  const lines = new Set(body.split(/\r?\n/u));
  return exactEvidenceMarkers(request).every(marker => lines.has(marker));
}

function requireMatchingRawEvidence(
  body: string,
  request: FileRetroDraftRequest,
  onConflict: () => void,
  receiptId: string,
): void {
  if (rawEvidenceAgrees(body, request)) return;
  onConflict();
  throw new RelayError(503, 'raw reconciliation evidence conflicts', {
    receiptId,
    state: 'ambiguous',
    disposition: 'conflict',
  });
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
    !validText(candidate.requestId, REQUEST_ID_MAX_LENGTH) ||
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u.test(
      candidate.requestId,
    ) ||
    !validText(candidate.retryDeadlineAt, RETRY_DEADLINE_MAX_LENGTH) ||
    !Number.isFinite(Date.parse(candidate.retryDeadlineAt)) ||
    new Date(candidate.retryDeadlineAt).toISOString() !== candidate.retryDeadlineAt ||
    !Number.isSafeInteger(candidate.installationId) ||
    (candidate.installationId ?? 0) <= 0 ||
    !validText(candidate.repository, REPOSITORY_MAX_LENGTH) ||
    !/^[\w.-]+\/[\w.-]+$/u.test(candidate.repository) ||
    !validText(candidate.canonicalKey, DEDUPE_KEY_MAX_LENGTH) ||
    !validText(candidate.legacySignature, DEDUPE_KEY_MAX_LENGTH) ||
    !validText(candidate.title, TITLE_MAX_LENGTH) ||
    !validText(candidate.body, BODY_MAX_LENGTH, true) ||
    !Array.isArray(candidate.labels) ||
    candidate.labels.length > LABEL_COUNT_MAX ||
    candidate.labels.some(label => !validText(label, LABEL_MAX_LENGTH))
  ) {
    throw new RelayError(400, 'invalid relay filing request');
  }
}

export class RelayService {
  readonly #github: GitHubRestClient;
  readonly #faults: RelayFaults;
  readonly #now: () => Date;
  readonly #payloadKeyring: PayloadKeyring;
  readonly #store: RelayStore;

  constructor(input: {
    store: RelayStore;
    github: GitHubRestClient;
    payloadKeyring: PayloadKeyring;
    faults?: RelayFaults;
    now?: () => Date;
  }) {
    this.#store = input.store;
    this.#github = input.github;
    this.#payloadKeyring = input.payloadKeyring;
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
    if (isResolvedReceiptState(record.state)) return filingReceipt(record);
    if (record.state !== 'ambiguous') {
      throw new RelayError(409, 'only ambiguous filings can be reconciled');
    }
    if (!this.#store.beginManualRecovery(record.scope, this.#now())) {
      throw new RelayError(409, 'filing reconciliation is already in progress');
    }
    try {
      const durableRequest = decryptPayload(
        record.envelope,
        record.scope,
        record.payloadHash,
        this.#payloadKeyring,
      );
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
      if (scan.matches.length !== 1) {
        const disposition = scan.matches.length === 0 ? 'zero' : 'multiple';
        this.#store.recordReconciliation(
          receiptId,
          principal.subject,
          disposition,
          scan.matches.length,
        );
        throw new RelayError(503, 'raw reconciliation is incomplete or non-unique', {
          receiptId,
          state: 'ambiguous',
          disposition,
        });
      }
      const [match] = scan.matches;
      requireMatchingRawEvidence(
        match.body,
        durableRequest,
        () => {
          this.#store.recordReconciliation(receiptId, principal.subject, 'conflict', 1);
        },
        receiptId,
      );
      this.#store.recordReconciliation(receiptId, principal.subject, 'adopted', 1);
      return this.#store.markReconciledFiled(record.scope, match.issueNumber);
    } catch (error) {
      this.#store.cancelManualRecovery(record.scope);
      throw error;
    }
  }

  // eslint-disable-next-line complexity -- Recovery keeps the raw-scan safety decisions explicit.
  async recover(
    principal: RelayPrincipal,
    receiptId: string,
  ): Promise<{ disposition: 'adopted' | 'manual-created'; receipt: FilingReceipt }> {
    if (!principal.roles.includes('operate')) {
      throw new RelayError(403, 'operate role is required');
    }
    const record = this.#store.loadByReceiptForPrincipal(receiptId, principal);
    if (record === undefined) throw new RelayError(404, 'filing receipt not found');
    if (['filed', 'tombstone'].includes(record.state)) {
      return { disposition: 'adopted', receipt: filingReceipt(record) };
    }
    if (!['ambiguous', 'dead-letter'].includes(record.state)) {
      throw new RelayError(409, 'only ambiguous or dead-letter filings can be manually recovered');
    }
    const recoveryState = record.state;
    if (!this.#store.beginManualRecovery(record.scope, this.#now())) {
      throw new RelayError(409, 'filing recovery is already in progress');
    }
    try {
      const durableRequest = decryptPayload(
        record.envelope,
        record.scope,
        record.payloadHash,
        this.#payloadKeyring,
      );
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
      if (scan.matches.length === 1) {
        const [match] = scan.matches;
        requireMatchingRawEvidence(
          match.body,
          durableRequest,
          () => {
            this.#store.recordReconciliation(receiptId, principal.subject, 'conflict', 1);
          },
          receiptId,
        );
        this.#store.recordReconciliation(receiptId, principal.subject, 'adopted', 1);
        return {
          disposition: 'adopted',
          receipt: this.#store.markReconciledFiled(record.scope, match.issueNumber),
        };
      }
      if (scan.matches.length > 1) {
        this.#store.recordReconciliation(
          receiptId,
          principal.subject,
          'multiple',
          scan.matches.length,
        );
        throw new RelayError(503, 'raw reconciliation is incomplete or non-unique', {
          receiptId,
          state: 'ambiguous',
          disposition: 'multiple',
        });
      }

      const installationToken = await this.#github.installationToken(
        record.scope.installationId,
        record.scope.repository,
      );
      this.#store.recordReconciliation(receiptId, principal.subject, 'manual-create-attempted', 0);
      const issueNumber = await this.#github.createIssue({
        installationId: record.scope.installationId,
        repository: record.scope.repository,
        title: durableRequest.title,
        body: bodyWithAuthorityMarkers(durableRequest, record.requestMarker),
        labels: durableRequest.labels,
        installationToken,
      });
      this.#store.recordReconciliation(receiptId, principal.subject, 'manual-created', 0);
      return {
        disposition: 'manual-created',
        receipt: this.#store.markReconciledFiled(record.scope, issueNumber),
      };
    } catch (error) {
      this.#store.cancelManualRecovery(record.scope);
      if (error instanceof RelayError) throw error;
      throw new RelayError(503, 'manual filing recovery failed', {
        receiptId,
        state: recoveryState,
      });
    }
  }

  status(principal: RelayPrincipal, receiptId: string): FilingReceipt {
    if (!principal.roles.includes('file')) {
      throw new RelayError(403, 'file role is required');
    }
    const record = this.#store.loadByReceiptForPrincipal(receiptId, principal);
    if (record === undefined) {
      throw new RelayError(404, 'filing receipt not found');
    }
    return filingReceipt(record);
  }

  collectorRetryDeadline(principal: RelayPrincipal, requestId: string): string | undefined {
    if (!principal.roles.includes('ingest')) {
      throw new RelayError(403, 'ingest role is required');
    }
    return this.#store.load({
      installationId: principal.installationId,
      repository: principal.repository,
      requestId,
      tenantId: principal.tenantId,
    })?.retryDeadlineAt;
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

  async submit(
    principal: RelayPrincipal,
    request: FileRetroDraftRequest,
    acceptedAt?: string,
  ): Promise<FilingReceipt> {
    const now = this.#now();
    validateRequest(request);
    const scope = authorize(principal, request, 'file');
    const hash = payloadHash(request);
    if (
      this.#store.load(scope) === undefined &&
      Date.parse(request.retryDeadlineAt) <= now.getTime()
    ) {
      throw new RelayError(400, 'invalid relay filing request', {
        reason: 'retry-deadline-elapsed',
      });
    }
    const marker = requestMarker(scope);
    const accepted = this.#store.accept({
      ...(acceptedAt !== undefined && { acceptedAt }),
      scope,
      payloadHash: hash,
      envelope: encryptPayload(request, scope, hash, this.#payloadKeyring),
      requestMarker: marker,
      retryDeadlineAt: request.retryDeadlineAt,
    });
    // eslint-disable-next-line security/detect-possible-timing-attacks -- Both values are non-secret digests.
    if (accepted.record.payloadHash !== hash) {
      throw new RelayError(409, 'request identity was reused with a different payload');
    }
    if (isResolvedReceiptState(accepted.record.state)) return filingReceipt(accepted.record);
    if (accepted.record.state === 'ambiguous') {
      throw new RelayError(503, 'filing outcome is ambiguous', {
        receiptId: accepted.record.receiptId,
        requestId: accepted.record.scope.requestId,
        state: 'ambiguous',
      });
    }
    if (!this.#store.claim(scope, this.#now())) {
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
      durableRequest = decryptPayload(record.envelope, scope, hash, this.#payloadKeyring);
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
        installationId: scope.installationId,
        repository: scope.repository,
        title: durableRequest.title,
        body: bodyWithAuthorityMarkers(durableRequest, record.requestMarker),
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
          const retryAt = this.#now();
          this.#store.markRetryable(scope, retryAt, error.retryNotBefore(retryAt));
          throw new RelayError(503, 'GitHub rejected create; retry scheduled');
        }
      }
      this.#store.markAmbiguous(scope);
      const currentRecord = this.#store.load(scope);
      throw new RelayError(503, 'filing outcome is ambiguous', {
        ...(currentRecord !== undefined && { receiptId: currentRecord.receiptId }),
        requestId: scope.requestId,
        state: 'ambiguous',
      });
    }
  }
}
