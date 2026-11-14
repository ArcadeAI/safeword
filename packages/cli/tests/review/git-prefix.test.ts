import { describe, expect, it } from 'vitest';

import { parseGitProjectPrefix } from '../../src/review/git-prefix.js';

describe('Git project-prefix containment', () => {
  it.each([
    ['\n', ''],
    ['packages/cli/\n', 'packages/cli/'],
    ['space here/\n', 'space here/'],
    ['', undefined],
    ['packages/cli', undefined],
    ['packages/cli\n', undefined],
    ['/absolute/\n', undefined],
    ['../outside/\n', undefined],
    ['inside/../outside/\n', undefined],
  ])('parses %j without permitting traversal', (input, expected) => {
    expect(parseGitProjectPrefix(input ?? '')).toBe(expected);
  });
});
