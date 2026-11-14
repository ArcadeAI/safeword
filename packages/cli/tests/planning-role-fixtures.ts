import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

export const PLANNING_ROLE_PRODUCT = `# Product Plan

## Product Bet

- **Expected outcome:** Builders retain approval.
- **Persona outcome inventory:** Builder receives approval.
- **Known facts:** Approval is authenticated.
- **Assumptions:** Review is available.
- **Unresolved product decisions:** none
- **Success threshold:** Approval advances.
- **Project non-goals:** No anonymous approval.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

#### approval.BU1.R1 — Preserve approval

Current approval advances.

## Shape

### M1 — Trust approval

- **Outcome:** Current approval advances.
- **Non-goals:** Anonymous approval.
`;

/** Supply phase prerequisites without changing the behavior under test. */
export function writeImplementationRoleInputs(root: string, target: string, feature: string): void {
  mkdirSync(nodePath.join(root, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(root, 'features', feature),
    'Feature: Trust approval\n  Scenario: Current approval\n    Given current evidence\n',
  );
  const path = nodePath.join(root, target);
  writeFileSync(
    path,
    `${readFileSync(path, 'utf8')}\n## Architecture applicability\n\nskip: No durable architecture records apply.\n\n## Data applicability\n\nskip: No product data is stored.\n`,
  );
}
