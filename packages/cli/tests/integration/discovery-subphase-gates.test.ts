/**
 * Ticket B0JZQN — DISCOVERY.md Phase 0 documents a named "Sub-phase gates"
 * convention: present captured artifact → ask the sub-phase's closing
 * question → wait for signoff, with a resume rule and a YOLO note. Lives in
 * BOTH the canonical template and this repo's dogfood copy (canonical-first
 * discipline; dogfood-parity keeps them in sync).
 *
 * Doc-presence test: the agent reads DISCOVERY.md at intake start, so the gate
 * guidance living in the file IS the shipped behavior (v1 is conversational —
 * the enforcement hook is deferred to epic 172). Mirrors
 * discovery-jtbd-substep.test.ts.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const CANONICAL = fileURLToPath(
  new URL('../../templates/skills/bdd/DISCOVERY.md', import.meta.url),
);
const DOGFOOD = fileURLToPath(
  new URL('../../../../.claude/skills/bdd/DISCOVERY.md', import.meta.url),
);

describe.each([
  ['canonical template', CANONICAL],
  ['dogfood copy', DOGFOOD],
])('DISCOVERY.md sub-phase gates — %s', (_label, filePath) => {
  const content = readFileSync(filePath, 'utf8');
  const gatesAt = content.indexOf('## Sub-phase gates');

  it('has a "Sub-phase gates" section', () => {
    expect(gatesAt).toBeGreaterThan(-1);
  });

  it('documents a closing question per sub-phase plus the resume and YOLO rules', () => {
    const section = content.slice(gatesAt);
    expect(section).toMatch(/closing question/i);
    expect(section).toMatch(/resume/i);
    expect(section).toMatch(/yolo/i);
  });
});
