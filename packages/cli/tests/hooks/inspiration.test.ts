import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  evaluateImplementationInspiration,
  evaluateInspirationActivation,
  evaluateProductInspiration,
} from '../../templates/hooks/lib/inspiration.js';
import { INSPIRATION_SPEC_MARKER as SPEC_MARKER } from '../fixtures/inspiration.js';

function ticket(signals: string[] = []): string {
  return ['---', 'id: EXAMPLE', 'type: feature', ...signals, '---', ''].join('\n');
}

function spec(marker = ''): string {
  return ['# Spec: Example', marker, '', '## Intent', 'Example'].join('\n');
}

describe('inspiration contract activation', () => {
  it('grandfathers a signal-free pre-v1 artifact regardless of creation date', () => {
    expect(
      evaluateInspirationActivation({
        ticketContent: ticket(['created: 2099-01-01T00:00:00.000Z']),
        specContent: spec(),
      }),
    ).toEqual({ ok: true, activated: false });
  });

  it('accepts the exact ticket marker, scaffold sentinel, and spec marker together', () => {
    expect(
      evaluateInspirationActivation({
        ticketContent: ticket(['inspiration_contract: v1', 'inspiration_contract_scaffold: v1']),
        specContent: spec(SPEC_MARKER),
      }),
    ).toEqual({ ok: true, activated: true });
  });

  it.each([
    {
      name: 'ticket marker only',
      ticketSignals: ['inspiration_contract: v1'],
      marker: '',
    },
    {
      name: 'spec marker only',
      ticketSignals: [],
      marker: SPEC_MARKER,
    },
    {
      name: 'scaffold sentinel after both version markers were deleted',
      ticketSignals: ['inspiration_contract_scaffold: v1'],
      marker: '',
    },
  ])('rejects an activated artifact with missing companions: $name', fixture => {
    const result = evaluateInspirationActivation({
      ticketContent: ticket(fixture.ticketSignals),
      specContent: spec(fixture.marker),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('all three');
  });

  it.each([
    ['altered ticket key case', ['Inspiration_Contract: v1'], SPEC_MARKER],
    ['unsupported sentinel', ['inspiration_contract_scaffold: v2'], SPEC_MARKER],
    [
      'altered spec whitespace',
      ['inspiration_contract: v1', 'inspiration_contract_scaffold: v1'],
      '<!-- safeword: inspiration-contract:v1 -->',
    ],
  ])('fails closed for a candidate with %s', (_name, ticketSignals, marker) => {
    expect(
      evaluateInspirationActivation({
        ticketContent: ticket(ticketSignals),
        specContent: spec(marker),
      }).ok,
    ).toBe(false);
  });

  it.each([
    [
      'duplicate ticket marker',
      ticket([
        'inspiration_contract: v1',
        'inspiration_contract: v1',
        'inspiration_contract_scaffold: v1',
      ]),
      spec(SPEC_MARKER),
    ],
    [
      'non-scalar ticket marker',
      ticket(['inspiration_contract:', '  version: v1', 'inspiration_contract_scaffold: v1']),
      spec(SPEC_MARKER),
    ],
    [
      'marker after a level-two heading',
      ticket(['inspiration_contract: v1', 'inspiration_contract_scaffold: v1']),
      ['# Spec', '', '## Intent', '', SPEC_MARKER].join('\n'),
    ],
    [
      'multiple marker candidates',
      ticket(['inspiration_contract: v1', 'inspiration_contract_scaffold: v1']),
      spec(`${SPEC_MARKER}\n<!-- safeword:inspiration-contract:v2 -->`),
    ],
    ['missing frontmatter delimiters', 'inspiration_contract: v1', spec(SPEC_MARKER)],
  ])('fails closed for %s', (_name, ticketContent, specContent) => {
    expect(evaluateInspirationActivation({ ticketContent, specContent }).ok).toBe(false);
  });

  it('accepts exact activation signals in CRLF artifacts', () => {
    const result = evaluateInspirationActivation({
      ticketContent: ticket([
        'inspiration_contract: v1',
        'inspiration_contract_scaffold: v1',
      ]).replaceAll('\n', '\r\n'),
      specContent: spec(SPEC_MARKER).replaceAll('\n', '\r\n'),
    });

    expect(result).toEqual({ ok: true, activated: true });
  });

  it('ignores marker candidates and headings inside fenced examples', () => {
    const ticketContent = ticket(['inspiration_contract: v1', 'inspiration_contract_scaffold: v1']);
    const specContent = [
      '# Spec',
      '````md',
      '<!-- safeword:inspiration-contract:v2 -->',
      '## Example heading',
      '```',
      '````',
      SPEC_MARKER,
      '## Intent',
    ].join('\n');

    expect(evaluateInspirationActivation({ ticketContent, specContent })).toEqual({
      ok: true,
      activated: true,
    });
  });

  it('ignores level-two headings inside HTML comments when locating the preamble', () => {
    const ticketContent = ticket(['inspiration_contract: v1', 'inspiration_contract_scaffold: v1']);
    const specContent = [
      '# Spec',
      '<!--',
      '## Historical example',
      '-->',
      SPEC_MARKER,
      '## Intent',
    ].join('\n');

    expect(evaluateInspirationActivation({ ticketContent, specContent })).toEqual({
      ok: true,
      activated: true,
    });
  });

  it('does not activate from a marker shown only inside fenced code', () => {
    expect(
      evaluateInspirationActivation({
        ticketContent: ticket(),
        specContent: ['# Spec', '```md', SPEC_MARKER, '```', '## Intent'].join('\n'),
      }),
    ).toEqual({ ok: true, activated: false });
  });

  it('fails closed for an unterminated marker-like comment', () => {
    const result = evaluateInspirationActivation({
      ticketContent: ticket(),
      specContent: '# Spec\n<!-- safeword:inspiration-contract:v1\n',
    });

    expect(result.ok).toBe(false);
  });

  it('treats signal-free artifacts without activation provenance as legacy', () => {
    expect(
      evaluateInspirationActivation({
        ticketContent: ticket(),
        specContent: spec(),
      }),
    ).toEqual({ ok: true, activated: false });
  });

  it('rejects removal of all signals after activation is present in durable provenance', () => {
    const result = evaluateInspirationActivation({
      ticketContent: ticket(),
      specContent: spec(),
      activationProvenance: 'activated',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('previously activated');
  });

  it('fails closed when a signal-free artifact has unavailable activation provenance', () => {
    const result = evaluateInspirationActivation({
      ticketContent: ticket(),
      specContent: spec(),
      activationProvenance: 'unavailable',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('could not be verified');
  });
});

const SIGNALS = ['inspiration_contract: v1', 'inspiration_contract_scaffold: v1'];

function activatedTicket(created = '2026-08-09T00:00:00.000Z'): string {
  return ticket([...SIGNALS, `created: ${created}`]);
}

function productSpec(body: string): string {
  return [
    '# Spec: Example',
    SPEC_MARKER,
    '',
    '## Product Inspiration',
    '',
    body,
    '',
    '## Jobs To Be Done',
  ].join('\n');
}

const PRODUCT_HEADER =
  '| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |';
const PRODUCT_DELIMITER = '| --- | --- | --- | --- | --- | --- | --- |';

function productTable(row: string): string {
  return [PRODUCT_HEADER, PRODUCT_DELIMITER, row].join('\n');
}

const VALID_PRODUCT_ROW =
  '| https://linear.app/docs/issue-templates | 2026-08-09 | n/a | Customers file faster issues | Default the good practice | Do not copy the UI | retained: evidence supports the direction |';

describe('product inspiration evidence', () => {
  it('keeps the retired inspiration table out of the shipped Product Plan scaffold', () => {
    const templatePath = nodePath.resolve(import.meta.dirname, '../../templates/spec-template.md');
    const lines = readFileSync(templatePath, 'utf8').split('\n');
    const headerLine = lines.indexOf(PRODUCT_HEADER);
    expect(headerLine).toBe(-1);
    expect(lines.join('\n')).toContain('## Product Bet');
  });

  it('accepts a current complete product reference', () => {
    const table = productTable(VALID_PRODUCT_ROW);
    const result = evaluateProductInspiration({
      ticketContent: activatedTicket(),
      specContent: productSpec(table),
      evaluationDate: '2026-08-09',
    });

    expect(result).toEqual({ ok: true, path: 'reference' });
  });

  it.each([
    ['non-HTTPS reference', VALID_PRODUCT_ROW.replace('https://', 'http://')],
    [
      'credential-bearing reference',
      VALID_PRODUCT_ROW.replace('https://linear.app', 'https://user@linear.app'),
    ],
    ['future date', VALID_PRODUCT_ROW.replace('2026-08-09', '2026-08-10')],
    ['date before creation', VALID_PRODUCT_ROW.replace('2026-08-09', '2026-08-08')],
    ['invalid decision impact', VALID_PRODUCT_ROW.replace('retained:', 'unchanged:')],
    ['pipe-bearing cell', VALID_PRODUCT_ROW.replace('Customers file', 'Customers `|` file')],
  ])('rejects a product row with %s', (_name, row) => {
    const table = productTable(row);
    const result = evaluateProductInspiration({
      ticketContent: activatedTicket(),
      specContent: productSpec(table),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
  });

  it('accepts the exact complete product unsuccessful-search path', () => {
    const table = [
      '| Customer job | Framed question | Products attempted | Source categories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| file actionable work | who defaults research well | Linear and GitHub | workflow tools | default research workflow | 2026-08-09 | official docs | no comparable behavior | retained: keep the existing direction |',
    ].join('\n');
    expect(
      evaluateProductInspiration({
        ticketContent: activatedTicket(),
        specContent: productSpec(`### Product Unsuccessful Search\n\n${table}`),
        evaluationDate: '2026-08-09',
      }),
    ).toEqual({ ok: true, path: 'unsuccessful-search' });
  });

  it('rejects mixed product reference and unsuccessful-search paths', () => {
    const search = [
      '### Product Unsuccessful Search',
      '',
      '| Customer job | Framed question | Products attempted | Source categories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| job | question | products | categories | queries | 2026-08-09 | sources | none transfer | retained: keep direction |',
    ].join('\n');
    const result = evaluateProductInspiration({
      ticketContent: activatedTicket(),
      specContent: productSpec(`${productTable(VALID_PRODUCT_ROW)}\n\n${search}`),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a product table inside fenced example content', () => {
    const result = evaluateProductInspiration({
      ticketContent: activatedTicket(),
      specContent: productSpec(`\`\`\`md\n${productTable(VALID_PRODUCT_ROW)}\n\`\`\``),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
  });

  it('keeps evidence hidden when a shorter run appears inside a longer fence', () => {
    const fenced = [
      `\`\`\`\`md`,
      '`'.repeat(3),
      productTable(VALID_PRODUCT_ROW),
      '`'.repeat(4),
    ].join('\n');
    const result = evaluateProductInspiration({
      ticketContent: activatedTicket(),
      specContent: productSpec(fenced),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
  });

  it('keeps product evidence hidden after an unterminated HTML comment', () => {
    const result = evaluateProductInspiration({
      ticketContent: activatedTicket(),
      specContent: productSpec(`<!-- illustrative evidence\n${productTable(VALID_PRODUCT_ROW)}`),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a complete product table inside a terminated HTML comment', () => {
    const result = evaluateProductInspiration({
      ticketContent: activatedTicket(),
      specContent: productSpec(`<!--\n${productTable(VALID_PRODUCT_ROW)}\n-->`),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects an impossible ticket creation timestamp instead of normalizing it', () => {
    const result = evaluateProductInspiration({
      ticketContent: activatedTicket('2026-02-29T00:00:00.000Z'),
      specContent: productSpec(productTable(VALID_PRODUCT_ROW)),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
  });
});

const IMPLEMENTATION_HEADER =
  '| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |';
const IMPLEMENTATION_DELIMITER = '| --- | --- | --- | --- | --- | --- | --- |';
const VALID_IMPLEMENTATION_ROW =
  '| https://spec.commonmark.org/0.31.2/ | 2026-08-09 | 0.31.2 | 0.31.2 | Defines comment blocks | Use an exact marker | Accept only the v1 subset |';

function implementationPlan(body: string, plannedOn = '2026-08-09'): string {
  return [
    '# Impl Plan: Example',
    '',
    '**Status:** planned',
    `**Planned on:** ${plannedOn}`,
    '',
    '## Decisions',
    '',
    '### Implementation Inspiration',
    '',
    body,
    '',
    '### Recorded Decisions',
    '',
    '| Decision | Choice | Alternatives considered | Rejected because |',
    '| --- | --- | --- | --- |',
    '| parser | https://spec.commonmark.org/0.31.2/ | full Markdown | strict subset is clearer |',
    '',
    '## Approach',
    'Proof',
  ].join('\n');
}

describe('implementation inspiration evidence', () => {
  it('accepts a current version-matched implementation reference', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: the evidence supports the strict subset',
      '**Decision informed:** parser',
    ].join('\n');
    const result = evaluateImplementationInspiration({
      ticketContent: activatedTicket(),
      specContent: spec(SPEC_MARKER),
      planContent: implementationPlan(body),
      evaluationDate: '2026-08-09',
    });

    expect(result).toEqual({ ok: true, path: 'reference' });
  });

  it.each([
    [
      'mismatched versions',
      VALID_IMPLEMENTATION_ROW.replace('| 0.31.2 | 0.31.2 |', '| 0.31.2 | 0.30 |'),
    ],
    ['checked before planned-on', VALID_IMPLEMENTATION_ROW.replace('2026-08-09', '2026-08-08')],
  ])('rejects implementation evidence with %s', (_name, row) => {
    const result = evaluateImplementationInspiration({
      ticketContent: activatedTicket(),
      specContent: spec(SPEC_MARKER),
      planContent: implementationPlan(
        [
          IMPLEMENTATION_HEADER,
          IMPLEMENTATION_DELIMITER,
          row,
          '',
          '**Decision impact:** changed: choose this design',
          '**Decision informed:** parser',
        ].join('\n'),
      ),
      evaluationDate: '2026-08-09',
    });
    expect(result.ok).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['malformed', '08/09/2026'],
  ])('rejects a %s planned-on baseline', (_name, plannedOn) => {
    const plan =
      plannedOn === undefined
        ? implementationPlan(VALID_IMPLEMENTATION_ROW).replace('**Planned on:** 2026-08-09\n', '')
        : implementationPlan(VALID_IMPLEMENTATION_ROW, plannedOn);
    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it.each([
    ['missing level-one title', (plan: string) => plan.replace('# Impl Plan: Example\n\n', '')],
    [
      'duplicate level-one title',
      (plan: string) => plan.replace('# Impl Plan: Example', '# Impl Plan: Example\n# Duplicate'),
    ],
    [
      'Planned on before the level-one title',
      (plan: string) =>
        plan
          .replace('# Impl Plan: Example\n\n', '')
          .replace(
            '**Planned on:** 2026-08-09',
            '**Planned on:** 2026-08-09\n# Impl Plan: Example',
          ),
    ],
  ])('rejects a plan with %s', (_name, alter) => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const alteredPlan = alter(implementationPlan(body));
    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: alteredPlan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('accepts the exact complete implementation unsuccessful-search path', () => {
    const body = [
      '#### Implementation Unsuccessful Search',
      '',
      '| Technical question | Decision informed | Constraints | Dependency versions | Source categories | Repositories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| parse strict records | parser | no dependencies | n/a | standards | CommonMark | strict table parser | 2026-08-09 | official specs | no implementation transfers | retained: keep the dependency-free design |',
    ].join('\n');

    const result = evaluateImplementationInspiration({
      ticketContent: activatedTicket(),
      specContent: spec(SPEC_MARKER),
      planContent: implementationPlan(body),
      evaluationDate: '2026-08-09',
    });

    expect(result).toEqual({ ok: true, path: 'unsuccessful-search' });
  });

  it('rejects an implementation unsuccessful search without a recorded decision', () => {
    const body = [
      '#### Implementation Unsuccessful Search',
      '',
      '| Technical question | Decision informed | Constraints | Dependency versions | Source categories | Repositories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| parse strict records | parser | no dependencies | n/a | standards | CommonMark | strict table parser | 2026-08-09 | official specs | no implementation transfers | retained: keep the dependency-free design |',
    ].join('\n');
    const plan = implementationPlan(body).replace(
      '| parser | https://spec.commonmark.org/0.31.2/ | full Markdown | strict subset is clearer |',
      '',
    );

    const result = evaluateImplementationInspiration({
      ticketContent: activatedTicket(),
      specContent: spec(SPEC_MARKER),
      planContent: plan,
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Recorded Decisions');
  });

  it('rejects an implementation unsuccessful search linked to an unrelated decision', () => {
    const body = [
      '#### Implementation Unsuccessful Search',
      '',
      '| Technical question | Decision informed | Constraints | Dependency versions | Source categories | Repositories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| parse strict records | unrelated decision | no dependencies | n/a | standards | CommonMark | strict table parser | 2026-08-09 | official specs | no implementation transfers | retained: keep the dependency-free design |',
    ].join('\n');

    const result = evaluateImplementationInspiration({
      ticketContent: activatedTicket(),
      specContent: spec(SPEC_MARKER),
      planContent: implementationPlan(body),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Decision informed');
  });

  it('rejects duplicate implementation decision impacts', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: first rationale',
      '**Decision impact:** changed: second rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const result = evaluateImplementationInspiration({
      ticketContent: activatedTicket(),
      specContent: spec(SPEC_MARKER),
      planContent: implementationPlan(body),
      evaluationDate: '2026-08-09',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects implementation evidence not cited by an affected decision', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const plan = implementationPlan(body).replace(
      '| parser | https://spec.commonmark.org/0.31.2/ |',
      '| parser | uncited source |',
    );

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('rejects a decoy decision citation outside the explicitly affected row', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const plan = implementationPlan(body)
      .replace('| parser | https://spec.commonmark.org/0.31.2/ |', '| parser | uncited source |')
      .replace(
        '| parser | uncited source | full Markdown | strict subset is clearer |',
        '| parser | uncited source | full Markdown | strict subset is clearer |\n| decoy | https://spec.commonmark.org/0.31.2/ | none | unrelated |',
      );

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('rejects an ambiguous duplicate affected decision identifier', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const plan = implementationPlan(body).replace(
      '| parser | https://spec.commonmark.org/0.31.2/ | full Markdown | strict subset is clearer |',
      '| parser | https://spec.commonmark.org/0.31.2/ | full Markdown | strict subset is clearer |\n| parser | https://spec.commonmark.org/0.31.2/ | none | duplicate identifier |',
    );

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('rejects duplicate Recorded Decisions tables', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const decisionTable = [
      '| Decision | Choice | Alternatives considered | Rejected because |',
      '| --- | --- | --- | --- |',
      '| parser | https://spec.commonmark.org/0.31.2/ | full Markdown | strict subset is clearer |',
    ].join('\n');
    const plan = implementationPlan(body).replace(
      decisionTable,
      () => `${decisionTable}\n${decisionTable}`,
    );

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('rejects duplicate reference text confined to the inspiration subsection', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: https://spec.commonmark.org/0.31.2/ supports it',
      '**Decision informed:** parser',
    ].join('\n');
    const plan = implementationPlan(body).replace(
      '| parser | https://spec.commonmark.org/0.31.2/ |',
      '| parser | uncited source |',
    );

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it.each([
    [
      'a longer URL with the evidence URL as its prefix',
      'https://spec.commonmark.org/0.31.2/appendix',
    ],
    [
      'the evidence URL embedded in a larger prose token',
      'prefixhttps://spec.commonmark.org/0.31.2/',
    ],
  ])('rejects a decision citation that is only %s', (_name, citation) => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const plan = implementationPlan(body).replace(
      '| parser | https://spec.commonmark.org/0.31.2/ |',
      () => `| parser | ${citation} |`,
    );

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('rejects an implementation table inside fenced example content', () => {
    const body = [
      '```md',
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: illustrative only',
      '```',
    ].join('\n');

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: implementationPlan(body),
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('ignores planned-on candidates inside comments and fenced code', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const plan = implementationPlan(body).replace(
      '**Status:** planned',
      '**Status:** planned\n<!-- **Planned on:** 1999-01-01 -->\n```md\n**Planned on:** 1999-01-01\n```',
    );
    const result = evaluateImplementationInspiration({
      ticketContent: activatedTicket(),
      specContent: spec(SPEC_MARKER),
      planContent: plan,
      evaluationDate: '2026-08-09',
    });

    expect(result).toEqual({ ok: true, path: 'reference' });
  });

  it('does not confuse ordinary preamble prose with the Planned on label', () => {
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
    ].join('\n');
    const plan = implementationPlan(body).replace(
      '**Status:** planned',
      '**Status:** planned\nPlanned online rollout: staged after validation',
    );

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }),
    ).toEqual({ ok: true, path: 'reference' });
  });

  it('keeps implementation evidence hidden by a longer tilde fence', () => {
    const body = [
      '~~~~md',
      '~~~',
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: illustrative only',
      '**Decision informed:** parser',
      '~~~~',
    ].join('\n');

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: implementationPlan(body),
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('keeps implementation evidence hidden after an unterminated HTML comment', () => {
    const body = [
      '<!-- illustrative evidence',
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: illustrative only',
      '**Decision informed:** parser',
    ].join('\n');

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: implementationPlan(body),
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('rejects complete implementation evidence inside a terminated HTML comment', () => {
    const body = [
      '<!--',
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: illustrative only',
      '**Decision informed:** parser',
      '-->',
    ].join('\n');

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: implementationPlan(body),
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });

  it('rejects a self-citation from a fake Decisions table inside inspiration', () => {
    const decisionRow =
      '| parser | https://spec.commonmark.org/0.31.2/ | full Markdown | strict subset is clearer |';
    const body = [
      IMPLEMENTATION_HEADER,
      IMPLEMENTATION_DELIMITER,
      VALID_IMPLEMENTATION_ROW,
      '',
      '**Decision impact:** retained: rationale',
      '**Decision informed:** parser',
      '',
      '| Decision | Choice | Alternatives considered | Rejected because |',
      '| --- | --- | --- | --- |',
      decisionRow,
    ].join('\n');
    const original = implementationPlan(body);
    const outerRow = original.lastIndexOf(decisionRow);
    const plan = `${original.slice(0, outerRow)}${decisionRow.replace(
      'https://spec.commonmark.org/0.31.2/',
      'uncited source',
    )}${original.slice(outerRow + decisionRow.length)}`;

    expect(
      evaluateImplementationInspiration({
        ticketContent: activatedTicket(),
        specContent: spec(SPEC_MARKER),
        planContent: plan,
        evaluationDate: '2026-08-09',
      }).ok,
    ).toBe(false);
  });
});
