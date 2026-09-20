export interface DeliverySurface {
  readonly assets: Readonly<Record<string, string>>;
  readonly planningSourcePath: string;
}

export interface DataArchitectureDeliveryInput {
  readonly canonicalGuide: string;
  readonly installedGuide: string;
  readonly managedGuidePaths: readonly string[];
  readonly claude: DeliverySurface;
  readonly codex: DeliverySurface;
  readonly cursor: DeliverySurface;
  readonly openCode: Omit<DeliverySurface, 'planningSourcePath'>;
}

export interface DeliveryVerificationResult {
  readonly accepted: boolean;
  readonly diagnostics: readonly string[];
}

export function verifyDataArchitectureDelivery(
  _input: DataArchitectureDeliveryInput,
): DeliveryVerificationResult {
  return {
    accepted: false,
    diagnostics: ['Data architecture delivery verification is not implemented.'],
  };
}
