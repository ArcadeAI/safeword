export interface DeliverySurface {
  readonly assets: Readonly<Record<string, string>>;
  readonly planningSourcePath: string;
}

export interface DataArchitectureDeliveryInventory {
  readonly canonicalGuidePath: string;
  readonly installedGuidePath: string;
  readonly managedGuidePaths: readonly string[];
  readonly claudeGuidePath: string;
  readonly claudePlanningSourcePath: string;
  readonly claudePlanningTarget: string;
  readonly projectPlanningTarget: string;
  readonly claudePathSubstitution: {
    readonly from: string;
    readonly to: string;
  };
  readonly openCodeRationale: string;
}

export interface DataArchitectureDeliveryInput {
  readonly inventory: DataArchitectureDeliveryInventory;
  readonly canonicalGuide: string;
  readonly installedGuide: string;
  readonly actualManagedGuidePaths: readonly string[];
  readonly claude: DeliverySurface;
  readonly codex: DeliverySurface;
  readonly cursor: DeliverySurface;
  readonly openCode: Omit<DeliverySurface, 'planningSourcePath'>;
  readonly recordedRationale: string;
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
