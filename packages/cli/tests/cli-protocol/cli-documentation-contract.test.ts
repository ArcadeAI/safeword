import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { checkCliTerminology } from '../../scripts/check-cli-terminology.js';
import { renderCliReference } from '../../scripts/generate-cli-reference.js';

describe('shipped CLI documentation contract', () => {
  it('keeps the generated command reference current', () => {
    const path = new URL('../../../website/src/content/docs/reference/cli.mdx', import.meta.url);
    const source = readFileSync(path, 'utf8');
    expect(renderCliReference(source)).toBe(source);
  });

  it('accepts deprecated commands only inside matched compatibility regions', () => {
    expect(
      checkCliTerminology(
        'fixture.md',
        [
          'Use `install`.',
          '<!-- safeword:compatibility:start -->',
          '`setup` remains supported.',
          '<!-- safeword:compatibility:end -->',
          'Use `install` again.',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it.each([
    ['deprecated operative text', 'Run `setup`.', 'CLI_TERMINOLOGY_DEPRECATED_OPERATIVE_TEXT'],
    [
      'unclosed region',
      '<!-- safeword:compatibility:start -->\n`setup`',
      'CLI_TERMINOLOGY_UNCLOSED_COMPATIBILITY',
    ],
    [
      'reversed delimiter',
      '<!-- safeword:compatibility:end -->',
      'CLI_TERMINOLOGY_REVERSED_COMPATIBILITY',
    ],
    [
      'nested delimiter',
      '<!-- safeword:compatibility:start -->\n<!-- safeword:compatibility:start -->',
      'CLI_TERMINOLOGY_NESTED_COMPATIBILITY',
    ],
  ])('rejects %s', (_name, source, code) => {
    expect(checkCliTerminology('fixture.md', source)).toContainEqual(
      expect.objectContaining({ code }),
    );
  });
});
