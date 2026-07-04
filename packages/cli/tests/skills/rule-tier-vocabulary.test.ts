/**
 * SM1.R1 (ticket 1SVCB9): the shipped authoring surfaces present exactly one
 * criteria tier — Rule. Reads the templates a user actually receives and asserts
 * Rule-first scaffolding with no "one criteria kind, never both" doctrine and no
 * Acceptance-Criteria-as-co-equal-tier framing.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const TEMPLATES = nodePath.join(__dirname, '..', '..', 'templates');

function read(relativePath: string): string {
  return readFileSync(nodePath.join(TEMPLATES, relativePath), 'utf8');
}

const specTemplate = read('spec-template.md');
const discovery = read('skills/bdd/DISCOVERY.md');
const scenarios = read('skills/bdd/SCENARIOS.md');

describe('SM1.R1 — one criteria tier (Rule) across authoring surfaces', () => {
  it('the spec template scaffolds a numbered Rule heading as the criteria tier', () => {
    expect(specTemplate).toMatch(/####\s+\S+\.R<n>|####\s+oauth-flow\.PO1\.R1/);
  });

  it('no authoring surface states the one-criteria-kind-never-both doctrine', () => {
    for (const surface of [specTemplate, discovery, scenarios]) {
      expect(surface).not.toMatch(/never both/i);
      expect(surface).not.toMatch(/one criteria kind/i);
    }
  });

  it('no authoring surface offers Acceptance Criteria as a co-equal tier to choose', () => {
    // The pre-convergence framing presented Rules as an "Alternative" to ACs.
    for (const surface of [specTemplate, discovery, scenarios]) {
      expect(surface).not.toMatch(/Alternative(?: tier)?:.*Rules/i);
    }
  });

  it('the lineage scheme is Rule-shaped', () => {
    expect(scenarios).toMatch(/@<jtbd-id>\.R</);
  });
});
