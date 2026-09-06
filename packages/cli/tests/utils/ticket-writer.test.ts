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
import {
  createTemporaryDirectory,
  PRODUCT_PLAN_SECTIONS,
  removeTemporaryDirectory,
} from '../helpers.js';

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
    const ticket = readFileSync(nodePath.join(folderPath, 'ticket.md'), 'utf8');
    const spec = readFileSync(nodePath.join(folderPath, 'spec.md'), 'utf8');
    expect(ticket).toContain('product_plan_contract: v1');
    expect(ticket).not.toContain('inspiration_contract');
    expect(spec).toContain('<!-- safeword:product-plan-contract:v1 -->');
    expect(specHeaders(spec)).toEqual([...PRODUCT_PLAN_SECTIONS]);
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

  it('has the section headers in canonical order', () => {
    expect(specHeaders(template)).toEqual([...PRODUCT_PLAN_SECTIONS]);
  });

  it('contains no comms or launch planning section', () => {
    expect(template).not.toMatch(/^## .*\b(comms|launch)\b/im);
  });

  it('carries a JTBD and numbered Rule scaffold in canonical form', () => {
    const jtbdSection = template.slice(
      template.indexOf('## Jobs To Be Done'),
      template.indexOf('## Shape'),
    );
    expect(jtbdSection).toMatch(/### <slug>\.<persona-code>1/);
    expect(jtbdSection).toContain('**Persona:**');
    expect(jtbdSection).toMatch(/When I .+, I want .+, so I can .+/);
    expect(jtbdSection).toMatch(/#### <slug>\.<persona-code>1\.R1/);
  });

  it('scaffolds a delta-only child spec with stable references', () => {
    const temporaryDirectory = createTemporaryDirectory();
    try {
      const { folderPath, ticketPath } = createTicket(temporaryDirectory, fixedMinter('CHILD1'), {
        slug: 'child-flow',
        type: 'feature',
        parent: 'EPIC01',
        milestone: 'M1',
        parentJob: 'epic.NTB1',
      });
      const ticket = readFileSync(ticketPath, 'utf8');
      const spec = readFileSync(nodePath.join(folderPath, 'spec.md'), 'utf8');
      expect(ticket).toContain('parent_job: epic.NTB1');
      expect(ticket).toContain('milestone: M1');
      expect(specHeaders(spec)).toEqual(['Parent References', 'Contribution', 'Rules', 'Surfaces']);
      expect(spec).toContain('#### epic.NTB1.CHILD1.R1');
      // A child declares its own Surfaces — its implementation reaches contexts the
      // parent never did — so Surfaces is absent from this exclusion list.
      expect(spec).not.toMatch(/^## (Product Bet|Jobs To Be Done|Shape|Killer Demo)$/m);
      // A scaffold must declare no skip. Commented examples are not declarations:
      // the Surfaces and Killer Demo guidance both document the skip form inside
      // HTML comments, which every parser here strips, so strip them before
      // asserting rather than banning the substring the guidance has to show.
      const declared = spec.replaceAll(/<!--[\s\S]*?-->/gu, '');
      expect(declared).not.toContain('skip:');
    } finally {
      removeTemporaryDirectory(temporaryDirectory);
    }
  });
});
