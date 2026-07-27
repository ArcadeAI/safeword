export interface RelayDraftRequest {
  body: string;
  canonicalKey: string;
  installationId: number;
  labels: string[];
  legacySignature: string;
  repository: string;
  requestId: string;
  title: string;
}

export interface RelayClaim {
  bytes: Buffer;
  path: string;
  requestId: string;
}

export interface RelayReceipt {
  issueNumber?: number;
  receiptId: string;
  requestId: string;
  state: string;
}

export function createRelayRequest(
  _input: Omit<RelayDraftRequest, 'requestId'>,
  _dependencies: { randomUUID: () => string },
): RelayDraftRequest {
  throw new Error('RED: relay request creation is not implemented');
}

export function persistRelayRequest(
  _projectDirectory: string,
  _request: RelayDraftRequest,
): Promise<{ bytes: Buffer; path: string }> {
  throw new Error('RED: relay persistence is not implemented');
}

export function claimRelayRequest(
  _projectDirectory: string,
  _options: { claimId: string; leaseMs: number; now: number },
): Promise<RelayClaim | undefined> {
  throw new Error('RED: relay claims are not implemented');
}

export function acknowledgeRelayClaim(
  _claim: RelayClaim,
  _receipt: RelayReceipt,
  _options: { faultAfterAck?: () => Promise<void> } = {},
): Promise<boolean> {
  throw new Error('RED: relay acknowledgement is not implemented');
}

export function recoverRelaySpool(_projectDirectory: string, _now: number): Promise<void> {
  throw new Error('RED: relay recovery is not implemented');
}

export function listRelayRequests(
  _projectDirectory: string,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  throw new Error('RED: relay discovery is not implemented');
}

export function deliverRelayRequests(
  _projectDirectory: string,
  _options: {
    credential: string;
    deadlineMs: number;
    fetch: typeof fetch;
    nativeFallback: () => unknown;
    now: () => number;
    relayUrl: string;
  },
): Promise<{ accepted: number; retryable: number }> {
  throw new Error('RED: relay delivery is not implemented');
}
