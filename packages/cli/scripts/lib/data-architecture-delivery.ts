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

function sorted(values: readonly string[]): string[] {
  return values.toSorted((left, right) => left.localeCompare(right));
}

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}

function occurrenceCount(content: string, value: string): number {
  if (value.length === 0) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = content.indexOf(value, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + value.length;
  }
}

function planningReferenceDiagnostic(
  surfaceName: string,
  surface: DeliverySurface,
  expectedTarget: string,
  crossSurfaceTarget?: string,
): string | undefined {
  const source = surface.assets[surface.planningSourcePath];
  if (source === undefined) {
    return `${surfaceName} planning source is missing at ${surface.planningSourcePath}.`;
  }
  if (crossSurfaceTarget !== undefined && source.includes(crossSurfaceTarget)) {
    return `${surfaceName} planning reference crosses surfaces to ${crossSurfaceTarget}.`;
  }
  return occurrenceCount(source, expectedTarget) === 1
    ? undefined
    : `${surfaceName} planning reference does not resolve exactly once to ${expectedTarget}.`;
}

function guideDeliveryDiagnostics(input: DataArchitectureDeliveryInput): string[] {
  const diagnostics: string[] = [];
  const { inventory } = input;
  if (!sameStrings(input.actualManagedGuidePaths, inventory.managedGuidePaths)) {
    const missingPaths = inventory.managedGuidePaths.filter(
      path => !input.actualManagedGuidePaths.includes(path),
    );
    diagnostics.push(
      ...(missingPaths.length > 0
        ? missingPaths.map(path => `Managed guide is missing at ${path}.`)
        : ['Managed data architecture guide path inventory does not match.']),
    );
  }
  if (input.installedGuide !== input.canonicalGuide) {
    diagnostics.push(`Installed guide content differs at ${inventory.installedGuidePath}.`);
  }
  const claudeGuide = input.claude.assets[inventory.claudeGuidePath];
  if (claudeGuide === undefined) {
    diagnostics.push(`Claude guide is missing at ${inventory.claudeGuidePath}.`);
    return diagnostics;
  }
  const expectedClaudeGuide = input.canonicalGuide.replaceAll(
    inventory.claudePathSubstitution.from,
    () => inventory.claudePathSubstitution.to,
  );
  if (claudeGuide !== expectedClaudeGuide) {
    diagnostics.push(`Claude guide content differs at ${inventory.claudeGuidePath}.`);
  }
  return diagnostics;
}

function openCodeDeliveryDiagnostics(input: DataArchitectureDeliveryInput): string[] {
  const diagnostics: string[] = [];
  const openCodeGuidePath = Object.keys(input.openCode.assets).find(path =>
    path.endsWith('/data-architecture-guide.md'),
  );
  if (openCodeGuidePath !== undefined) {
    diagnostics.push(`OpenCode contains an unexpected guide copy at ${openCodeGuidePath}.`);
  }
  const openCodeReferencePath = Object.entries(input.openCode.assets).find(([, content]) =>
    [input.inventory.projectPlanningTarget, input.inventory.claudePlanningTarget].some(target =>
      content.includes(target),
    ),
  )?.[0];
  if (openCodeReferencePath !== undefined) {
    diagnostics.push(
      `OpenCode contains an unexpected guide reference at ${openCodeReferencePath}.`,
    );
  }
  if (!input.recordedRationale.includes(input.inventory.openCodeRationale)) {
    diagnostics.push('OpenCode guide-delivery rationale is not recorded.');
  }
  return diagnostics;
}

export function verifyDataArchitectureDelivery(
  input: DataArchitectureDeliveryInput,
): DeliveryVerificationResult {
  const diagnostics = guideDeliveryDiagnostics(input);
  const { inventory } = input;

  const codexGuidePath = Object.keys(input.codex.assets).find(path =>
    path.endsWith('/data-architecture-guide.md'),
  );
  if (codexGuidePath !== undefined) {
    diagnostics.push(`Codex contains an unexpected guide copy at ${codexGuidePath}.`);
  }

  for (const diagnostic of [
    planningReferenceDiagnostic('Claude', input.claude, inventory.claudePlanningTarget),
    planningReferenceDiagnostic(
      'Codex',
      input.codex,
      inventory.projectPlanningTarget,
      inventory.claudePlanningTarget,
    ),
    planningReferenceDiagnostic('Cursor', input.cursor, inventory.projectPlanningTarget),
  ]) {
    if (diagnostic !== undefined) diagnostics.push(diagnostic);
  }

  if (input.cursor.assets[inventory.installedGuidePath] === undefined) {
    diagnostics.push(`Planning target is missing at ${inventory.installedGuidePath}.`);
  }

  diagnostics.push(...openCodeDeliveryDiagnostics(input));

  return { accepted: diagnostics.length === 0, diagnostics };
}
