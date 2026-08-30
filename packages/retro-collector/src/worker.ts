interface CollectorClaim {
  acceptedAt: string;
  bodyBase64: string;
  digest: string;
  leaseToken: string;
  requestId: string;
}

export interface RetroTransferOptions {
  collectorCredential: string;
  collectorUrl: string;
  relayCredential: string;
  relayUrl: string;
}

export type RetroTransferResult = 'empty' | 'rejected' | 'retained' | 'transferred';

export interface RetroTransferWorkerDependencies {
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

function authorization(secret: string): { authorization: string } {
  return { authorization: `Bearer ${secret}` };
}

function relayDisposition(
  status: number | undefined,
  state: string | undefined,
): {
  method: 'DELETE' | 'PATCH' | 'PUT';
  result: Exclude<RetroTransferResult, 'empty'>;
} {
  if (status !== undefined && status >= 200 && status < 300) {
    if (state === 'dead-letter' || state === 'rejected') {
      return { method: 'PATCH', result: 'rejected' };
    }
    if (state === undefined) return { method: 'DELETE', result: 'retained' };
    return { method: 'PUT', result: 'transferred' };
  }
  if (status !== undefined && [400, 409, 413, 422].includes(status)) {
    return { method: 'PATCH', result: 'rejected' };
  }
  return { method: 'DELETE', result: 'retained' };
}

export async function transferOneRetro(
  options: RetroTransferOptions,
): Promise<RetroTransferResult> {
  const claimResponse = await fetch(new URL('/v1/private/retro-claims', options.collectorUrl), {
    method: 'POST',
    headers: authorization(options.collectorCredential),
    signal: AbortSignal.timeout(10_000),
  });
  if (claimResponse.status === 204) return 'empty';
  if (!claimResponse.ok) return 'retained';
  const claim = (await claimResponse.json()) as CollectorClaim;
  let relayStatus: number | undefined;
  let relayState: string | undefined;
  try {
    const relayResponse = await fetch(new URL('/v1/collector-retros', options.relayUrl), {
      method: 'POST',
      headers: {
        ...authorization(options.relayCredential),
        'content-type': 'application/json; charset=utf-8',
        'x-safeword-accepted-at': claim.acceptedAt,
        'x-safeword-envelope-digest': claim.digest,
        'x-safeword-request-id': claim.requestId,
      },
      body: Buffer.from(claim.bodyBase64, 'base64'),
      signal: AbortSignal.timeout(10_000),
    });
    relayStatus = relayResponse.status;
    if (relayResponse.ok) {
      const receipt = (await relayResponse.json()) as { state?: unknown };
      if (typeof receipt.state === 'string') relayState = receipt.state;
    }
  } catch {
    // Collector ownership remains durable when the private relay is unavailable.
  }
  const disposition = relayDisposition(relayStatus, relayState);
  const lifecycleResponse = await fetch(
    new URL(`/v1/private/retro-claims/${claim.requestId}`, options.collectorUrl),
    {
      method: disposition.method,
      headers: {
        ...authorization(options.collectorCredential),
        'x-safeword-lease-token': claim.leaseToken,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!lifecycleResponse.ok) return 'retained';
  return disposition.result;
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** Drain continuously; idle and transient failures stay quiet and retry later. */
export async function runRetroTransferWorker(
  options: RetroTransferOptions,
  signal: AbortSignal,
  dependencies: RetroTransferWorkerDependencies = {},
): Promise<void> {
  const pause = dependencies.wait ?? wait;
  while (!signal.aborted) {
    let result: RetroTransferResult = 'retained';
    try {
      result = await transferOneRetro(options);
    } catch {
      // The collector remains authoritative; retry without terminating the service.
    }
    if (result !== 'transferred' && result !== 'rejected') await pause(1000, signal);
  }
}
