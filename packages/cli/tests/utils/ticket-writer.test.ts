/**
 * Unit tests for ticket-writer spec.md scaffolding + type-aware ticket.md
 * body (ticket Y2HCNJ, slices A + B). Covers test-definitions.md Rules 1-3:
 * features get a spec.md sibling, tasks/patches don't; the ticket.md body
 * shape is type-aware; the spec template is well-formed.
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTemplatesDirectory } from '../../src/utils/fs.js';
import type { IdMinter } from '../../src/utils/id-minter.js';
import { createTicket } from '../../src/utils/ticket-writer.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function fixedMinter(id: string): IdMinter {
  return { mint: () => id };
}

function specHeaders(content: string): string[] {
  return content
    .split('\n')
    .filter(line => line.startsWith('## '))
    .map(line => line.replace(/^##\s+/, '').trim());
}

describe('ticket-writer — spec.md scaffold by type (Rule 1)', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('feature scaffolds spec.md alongside ticket.md', () => {
    const { folderPath } = createTicket(cwd, fixedMinter('FEAT01'), {
      slug: 'oauth-flow',
      type: 'feature',
    });
    expect(existsSync(nodePath.join(folderPath, 'ticket.md'))).toBe(true);
    expect(existsSync(nodePath.join(folderPath, 'spec.md'))).toBe(true);
  });

  it('task does not scaffold spec.md', () => {
    const { folderPath } = createTicket(cwd, fixedMinter('TASK01'), {
      slug: 'add-flag',
      type: 'task',
    });
    expect(existsSync(nodePath.join(folderPath, 'ticket.md'))).toBe(true);
    expect(existsSync(nodePath.join(folderPath, 'spec.md'))).toBe(false);
  });

  it('patch does not scaffold spec.md', () => {
    const { folderPath } = createTicket(cwd, fixedMinter('PTCH01'), {
      slug: 'fix-typo',
      type: 'patch',
    });
    expect(existsSync(nodePath.join(folderPath, 'spec.md'))).toBe(false);
  });

  it('omitted type defaults to task and scaffolds no spec.md', () => {
    const { folderPath, ticketPath } = createTicket(cwd, fixedMinter('MISC01'), {
      slug: 'misc',
    });
    expect(readFileSync(ticketPath, 'utf8')).toMatch(/^type:\s*task$/m);
    expect(existsSync(nodePath.join(folderPath, 'spec.md'))).toBe(false);
  });

  it('scaffolded spec.md equals the template with {title} substituted', () => {
    const { folderPath } = createTicket(cwd, fixedMinter('FEAT02'), {
      slug: 'oauth-flow',
      type: 'feature',
      title: 'OAuth credential rotation',
    });
    const template = readFileSync(
      nodePath.join(getTemplatesDirectory(), 'spec-template.md'),
      'utf8',
    );
    const expected = template.replace('{title}', 'OAuth credential rotation');
    expect(readFileSync(nodePath.join(folderPath, 'spec.md'), 'utf8')).toBe(expected);
  });
});

describe('ticket-writer — type-aware ticket.md body (Rule 2)', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('feature ticket.md has Goal + See pointer and no Why', () => {
    const { ticketPath } = createTicket(cwd, fixedMinter('FEAT03'), {
      slug: 'oauth-flow',
      type: 'feature',
    });
    const body = readFileSync(ticketPath, 'utf8');
    expect(body).toContain('**Goal:**');
    expect(body).toContain('**See:**');
    expect(body).toContain('spec.md');
    expect(body).not.toContain('**Why:**');
  });

  it('task ticket.md keeps Goal + Why and has no spec pointer', () => {
    const { ticketPath } = createTicket(cwd, fixedMinter('TASK02'), {
      slug: 'add-flag',
      type: 'task',
    });
    const body = readFileSync(ticketPath, 'utf8');
    expect(body).toContain('**Goal:**');
    expect(body).toContain('**Why:**');
    expect(body).not.toContain('**See:**');
  });

  it('patch ticket.md keeps Goal + Why and has no spec pointer', () => {
    const { ticketPath } = createTicket(cwd, fixedMinter('PTCH02'), {
      slug: 'fix-typo',
      type: 'patch',
    });
    const body = readFileSync(ticketPath, 'utf8');
    expect(body).toContain('**Goal:**');
    expect(body).toContain('**Why:**');
    expect(body).not.toContain('**See:**');
  });
});

describe('spec-template.md is well-formed (Rule 3)', () => {
  const template = readFileSync(nodePath.join(getTemplatesDirectory(), 'spec-template.md'), 'utf8');

  it('has the nine section headers in canonical order', () => {
    expect(specHeaders(template)).toEqual([
      'Intent',
      'Intake Brief',
      'References',
      'Personas',
      'Vocabulary',
      'Jobs To Be Done',
      'Rave Moment',
      'Outcomes',
      'Open Questions',
    ]);
  });

  it('carries an HTML-commented worked JTBD example in canonical form', () => {
    const jtbdSection = template.slice(
      template.indexOf('## Jobs To Be Done'),
      template.indexOf('## Outcomes'),
    );
    // The example heading + persona + statement live inside an HTML comment,
    // so a freshly scaffolded spec.md parses to zero real JTBD entries.
    const commentOpen = jtbdSection.indexOf('<!--');
    const commentClose = jtbdSection.indexOf('-->');
    const example = jtbdSection.slice(commentOpen, commentClose);
    expect(example).toMatch(/### \S+\.\w+\d/); // <slug>.<persona-code><n> id
    expect(example).toContain('**Persona:**');
    expect(example).toMatch(/When I .+, I want .+, so I can .+/);
  });
});
