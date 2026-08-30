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

export type RetroTransferResult = 'empty' | 'retained' | 'transferred';

export interface RetroTransferWorkerDependencies {
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

function authorization(secret: string): { authorization: string } {
  return { authorization: `Bearer ${secret}` };
}

export async function transferOneRetro(
  options: RetroTransferOptions,
): Promise<RetroTransferResult> {
  const claimResponse = await fetch(new URL('/v1/private/retro-claims', options.collectorUrl), {
    method: 'POST',
    headers: authorization(options.collectorCredential),
  });
  if (claimResponse.status === 204) return 'empty';
  if (!claimResponse.ok) return 'retained';
  const claim = (await claimResponse.json()) as CollectorClaim;
  let relayAccepted = false;
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
    });
    relayAccepted = relayResponse.ok;
  } catch {
    // Collector ownership remains durable when the private relay is unavailable.
  }
  const lifecycleResponse = await fetch(
    new URL(`/v1/private/retro-claims/${claim.requestId}`, options.collectorUrl),
    {
      method: relayAccepted ? 'PUT' : 'DELETE',
      headers: {
        ...authorization(options.collectorCredential),
        'x-safeword-lease-token': claim.leaseToken,
      },
    },
  );
  return relayAccepted && lifecycleResponse.ok ? 'transferred' : 'retained';
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
    if (result !== 'transferred') await pause(1000, signal);
  }
}
