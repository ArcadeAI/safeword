import { describe, expect, it } from 'vitest';

import { parseTicketMetadata } from './ticket-metadata.js';

describe('ticket YAML identifier semantics', () => {
  it.each(['000123', '1E0003', '123456'])(
    'preserves opaque ID and parent spelling %s without changing other scalar types',
    id => {
      const content = `---\nid: ${id}\nparent: ${id}\nversion: 1\nenabled: true\n---\n\n# Ticket body\n`;
      expect(parseTicketMetadata(content)).toEqual({
        metadata: { id, parent: id, version: 1, enabled: true },
        body: '\n# Ticket body\n',
      });
    },
  );
  it('preserves the source ID through a YAML alias', () => {
    const content = '---\nreference: &ticket 000123\nid: *ticket\nparent: *ticket\n---\n';
    expect(parseTicketMetadata(content).metadata).toEqual({
      reference: 123,
      id: '000123',
      parent: '000123',
    });
  });
  it('refuses duplicate metadata keys', () => {
    expect(() => parseTicketMetadata('---\nid: OWN123\nid: OWN456\n---\n')).toThrow(
      'invalid YAML metadata',
    );
  });
  it.each(['- OWN123', '!!set {OWN123}', '!!timestamp 2026-09-27'])(
    'refuses non-record metadata %s',
    root => {
      expect(() => parseTicketMetadata(`---\n${root}\n---\n`)).toThrow('must be a mapping');
    },
  );
});
