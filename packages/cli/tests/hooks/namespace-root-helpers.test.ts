/**
 * Hook-side namespace-root lib behavior (ticket TAGWZ8). The differential
 * test pins resolveNamespaceRoot against the CLI copy; this file covers the
 * hook-only helper isNamespacePath.
 */

import { describe, expect, it } from 'vitest';

import { isNamespacePath } from '../../templates/hooks/lib/namespace-root.js';

describe('isNamespacePath (TAGWZ8)', () => {
  it('matches the default root, absolute and relative', () => {
    expect(isNamespacePath('/repo/.project/tickets/T/ticket.md', 'tickets/')).toBe(true);
    expect(isNamespacePath('.project/tickets/T/ticket.md', 'tickets/')).toBe(true);
  });

  it('matches the legacy root', () => {
    expect(isNamespacePath('.safeword-project/tickets/T/ticket.md', 'tickets/')).toBe(true);
    expect(isNamespacePath('/repo/.safeword-project/learnings/foo.md', 'learnings/')).toBe(true);
  });

  it('rejects roots that merely end with the namespace name', () => {
    // foo.project/ is NOT the namespace root — boundary must be a path
    // separator or string start.
    expect(isNamespacePath('foo.project/tickets/T/ticket.md', 'tickets/')).toBe(false);
    expect(isNamespacePath('/repo/my.safeword-project/tickets/T/ticket.md', 'tickets/')).toBe(
      false,
    );
  });

  it('rejects paths outside the requested subpath', () => {
    expect(isNamespacePath('.project/learnings/foo.md', 'tickets/')).toBe(false);
  });
});
