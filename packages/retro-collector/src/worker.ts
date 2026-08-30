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
