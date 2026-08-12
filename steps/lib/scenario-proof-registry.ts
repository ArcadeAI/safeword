import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

export type ScenarioProof = {
  packageDirectory: string;
  pattern: string;
  sourcePattern?: string;
  testFile: string;
};

function scenarioNames(featureSource: string): string[] {
  return [...featureSource.matchAll(/^\s*Scenario(?: Outline)?: (.+)$/gmu)]
    .map(match => match[1] as string)
    .toSorted((left, right) => left.localeCompare(right));
}

export function validateScenarioProofRegistry(
  registry: Record<string, ScenarioProof>,
  featureSource: string,
  projectDirectory: string,
): void {
  const expectedNames = scenarioNames(featureSource);
  const registeredNames = Object.keys(registry).toSorted((left, right) =>
    left.localeCompare(right),
  );

  if (JSON.stringify(registeredNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `Scenario proof registry does not match feature scenarios. Expected ${JSON.stringify(expectedNames)}, received ${JSON.stringify(registeredNames)}`,
    );
  }

  const selectors = Object.values(registry).map(proof => proof.pattern);
  if (new Set(selectors).size !== selectors.length) {
    throw new Error('Every scenario proof must use a unique executable test selector');
  }

  for (const [scenarioName, proof] of Object.entries(registry)) {
    const proofPath = nodePath.join(projectDirectory, proof.packageDirectory, proof.testFile);
    if (!existsSync(proofPath)) {
      throw new Error(`Missing Vitest proof for "${scenarioName}": ${proofPath}`);
    }
    const proofSource = readFileSync(proofPath, 'utf8');
    const sourcePattern = proof.sourcePattern ?? proof.pattern;
    if (!new RegExp(sourcePattern, 'u').test(proofSource)) {
      throw new Error(
        `Vitest proof source for "${scenarioName}" was not found in ${proofPath}: ${sourcePattern}`,
      );
    }
  }
}
