import { describe, expect, it } from 'vitest';

import {
  evaluateImplementationInspiration,
  evaluateInspirationActivation,
  evaluateProductInspiration,
} from '../../templates/hooks/lib/inspiration.js';

const SPEC_MARKER = '<!-- safeword:inspiration-contract:v1 -->';

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

  it('treats deliberate removal of all activation signals as legacy opt-out', () => {
    expect(
      evaluateInspirationActivation({
        ticketContent: ticket(),
        specContent: spec(),
      }),
    ).toEqual({ ok: true, activated: false });
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
});
