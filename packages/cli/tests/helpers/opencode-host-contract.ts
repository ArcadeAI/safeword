export interface OpenCodeHostContractEvidence {
  readonly version: string;
  readonly discovered: readonly ['command', 'agent', 'skill'];
  readonly preToolInputKeys: Readonly<
    Record<'bash' | 'shell' | 'edit' | 'write' | 'patch', string>
  >;
  readonly dispatcher: {
    readonly exitCode: number;
    readonly stdout: string;
    readonly awaitedBeforeDenial: boolean;
  };
  readonly denialSentinelExists: boolean;
}

export function proveOpenCodeHostContract(): Promise<OpenCodeHostContractEvidence> {
  return Promise.reject(new Error('OpenCode host-contract fixture is not implemented'));
}
