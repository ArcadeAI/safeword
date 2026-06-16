/**
 * Unit tests for dual-format active-ticket lookup (ticket 158, slice 4).
 *
 * Covers Rule 5 in test-definitions.md: getTicketInfo must resolve current
 * `{CROCKFORD}-{slug}/` folders, historical `{CROCKFORD}/` folders, and legacy
 * `{numeric}-{slug}/` folders. Duplicate matches surface as an ambiguity
 * (returns empty + stderr) rather than silently picking one.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTicketInfo } from '../../../../.safeword/hooks/lib/active-ticket';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const FRONTMATTER = (id: string): string =>
  `---
id: ${id}
type: feature
phase: intake
status: in_progress
---

# Test ticket
`;

function makeTicket(projectDirectory: string, folder: string, id: string): void {
  const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets', folder);
  mkdirSync(ticketsDirectory, { recursive: true });
  writeFileSync(nodePath.join(ticketsDirectory, 'ticket.md'), FRONTMATTER(id));
}

describe('getTicketInfo — dual-format lookup', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('resolves a legacy numeric-prefix folder', () => {
    makeTicket(projectDirectory, '080-ticket-id-collision', '080');
    const result = getTicketInfo(projectDirectory, '080');
    expect(result.folder).toBe('080-ticket-id-collision');
    expect(result.phase).toBe('intake');
    expect(result.slug).toBe('ticket-id-collision');
  });

  it('resolves a legacy numeric+letter-suffix folder', () => {
    makeTicket(projectDirectory, '102a-gherkin-typescript', '102a');
    const result = getTicketInfo(projectDirectory, '102a');
    expect(result.folder).toBe('102a-gherkin-typescript');
  });

  it('resolves a current Crockford ID + slug folder', () => {
    makeTicket(projectDirectory, '7K9M3P-login-bug', '7K9M3P');
    const result = getTicketInfo(projectDirectory, '7K9M3P');
    expect(result.folder).toBe('7K9M3P-login-bug');
    expect(result.slug).toBe('login-bug');
  });

  it('resolves a historical Crockford ID-only folder', () => {
    makeTicket(projectDirectory, '7K9M3P', '7K9M3P');
    const result = getTicketInfo(projectDirectory, '7K9M3P');
    expect(result.folder).toBe('7K9M3P');
    expect(result.slug).toBeUndefined();
  });

  it('resolves a historical Crockford ID-only folder case-insensitively', () => {
    makeTicket(projectDirectory, '7K9M3P', '7K9M3P');
    const result = getTicketInfo(projectDirectory, '7k9m3p');
    expect(result.folder).toBe('7K9M3P');
  });

  it('returns empty details when no folder matches', () => {
    makeTicket(projectDirectory, '7K9M3P', '7K9M3P');
    const result = getTicketInfo(projectDirectory, 'NOTHIN');
    expect(result.folder).toBeUndefined();
    expect(result.phase).toBeUndefined();
  });

  it('returns empty details (does not silently pick) when two folders match the same ID', () => {
    makeTicket(projectDirectory, '7K9M3P', '7K9M3P');
    makeTicket(projectDirectory, '7K9M3P-spurious', '7K9M3P');
    const result = getTicketInfo(projectDirectory, '7K9M3P');
    expect(result.folder).toBeUndefined();
  });
});
