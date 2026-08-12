import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

export type ScenarioProof = {
  expectedTests: number;
  outlineCases?: readonly string[];
  packageDirectory: string;
  proofId: string;
  testFile: string;
};

function outlineCases(featureSource: string): Map<string, string[]> {
  const cases = new Map<string, string[]>();
  const blocks = featureSource.split(/^\s*(?=Scenario(?: Outline)?: )/gmu);
  for (const block of blocks) {
    const name = /^Scenario Outline: (.+)$/mu.exec(block)?.[1];
    if (name === undefined) continue;
    const rows = [...block.matchAll(/^\s*\|\s*([^|]+?)\s*\|.*$/gmu)].map(match =>
      (match[1] as string).trim(),
    );
    cases.set(name, rows.slice(1));
  }
  return cases;
}

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
  const expectedOutlineCases = outlineCases(featureSource);

  if (JSON.stringify(registeredNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `Scenario proof registry does not match feature scenarios. Expected ${JSON.stringify(expectedNames)}, received ${JSON.stringify(registeredNames)}`,
    );
  }

  const proofIds = Object.values(registry).map(proof => proof.proofId);
  if (new Set(proofIds).size !== proofIds.length) {
    throw new Error('Every scenario proof must use a unique stable proof ID');
  }

  for (const [scenarioName, proof] of Object.entries(registry)) {
    if (!/^ORR-\d{3}$/u.test(proof.proofId)) {
      throw new Error(`Invalid stable proof ID for "${scenarioName}": ${proof.proofId}`);
    }
    if (!Number.isSafeInteger(proof.expectedTests) || proof.expectedTests < 1) {
      throw new Error(`Invalid expected test count for "${scenarioName}": ${proof.expectedTests}`);
    }
    const expectedCases = expectedOutlineCases.get(scenarioName);
    if (expectedCases !== undefined) {
      if (JSON.stringify(proof.outlineCases) !== JSON.stringify(expectedCases)) {
        throw new Error(
          `Outline proof cases do not match "${scenarioName}". Expected ${JSON.stringify(expectedCases)}, received ${JSON.stringify(proof.outlineCases)}`,
        );
      }
    } else if (proof.outlineCases !== undefined) {
      throw new Error(`Non-outline scenario "${scenarioName}" declares outline cases`);
    }
    const proofPath = nodePath.join(projectDirectory, proof.packageDirectory, proof.testFile);
    if (!existsSync(proofPath)) {
      throw new Error(`Missing Vitest proof for "${scenarioName}": ${proofPath}`);
    }
    const proofSource = readFileSync(proofPath, 'utf8');
    const sourcePattern = proof.proofId;
    if (!proofSource.includes(sourcePattern)) {
      throw new Error(
        `Vitest proof source for "${scenarioName}" was not found in ${proofPath}: ${sourcePattern}`,
      );
    }
  }
}
