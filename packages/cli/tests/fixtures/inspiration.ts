export const INSPIRATION_SPEC_MARKER = '<!-- safeword:inspiration-contract:v1 -->';

export function inspirationActivationLines(date: string): string[] {
  return [
    'inspiration_contract: v1',
    'inspiration_contract_scaffold: v1',
    `created: ${date}T00:00:00.000Z`,
  ];
}

export function validProductInspirationLines(date: string): string[] {
  return [
    '## Product Inspiration',
    '',
    '| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| https://linear.app/docs/issue-templates | ${date} | n/a | Faster issue filing | Default good practice | Do not copy UI | retained: supports direction |`,
    '',
  ];
}

export function validImplementationInspiration(date: string): string {
  return [
    '### Implementation Inspiration',
    '',
    '| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| https://spec.commonmark.org/0.31.2/ | ${date} | 0.31.2 | 0.31.2 | Exact comment grammar | Exact marker | Strict subset only |`,
    '',
    '**Decision impact:** retained: exact markers fit the design',
    '**Decision informed:** gate',
  ].join('\n');
}
