import { expect, it } from 'vitest';

import { normalizeOpenCodeTool } from '../../src/opencode/tool-codec.js';

it.each(['v2'] as const)(
  'converts %s file fields without guessing the other protocol',
  protocol => {
    const key = 'path';
    expect(normalizeOpenCodeTool(protocol, 'write', { [key]: 'note.md', content: 'text' })).toEqual(
      { tool_name: 'Write', tool_input: { file_path: 'note.md', content: 'text' } },
    );
    for (const replaceAll of [false, true]) {
      expect(
        normalizeOpenCodeTool(protocol, 'edit', {
          [key]: 'note.md',
          oldString: 'old',
          newString: 'new',
          replaceAll,
        }),
      ).toEqual({
        tool_name: 'Edit',
        tool_input: {
          file_path: 'note.md',
          old_string: 'old',
          new_string: 'new',
          replace_all: replaceAll,
        },
      });
    }
    const wrongKey = 'filePath';
    expect(() =>
      normalizeOpenCodeTool(protocol, 'write', { [wrongKey]: 'note.md', content: 'text' }),
    ).toThrow('Safeword denied this OpenCode tool call.');
    expect(normalizeOpenCodeTool(protocol, 'read', undefined)).toBeUndefined();
  },
);
it('does not claim an unproved V2 Patch codec', () => {
  for (const tool of ['patch', 'apply_patch'])
    expect(normalizeOpenCodeTool('v2', tool, { patchText: 'unproved' })).toBeUndefined();
});
it.each(['v2'] as const)(
  'preserves %s shell commands and rejects malformed covered inputs',
  protocol => {
    expect(
      normalizeOpenCodeTool(protocol, 'shell', { command: 'printf safe', workdir: '/other' }),
    ).toEqual({ tool_name: 'Bash', tool_input: { command: 'printf safe' } });
    for (const input of [undefined, [], { command: '' }])
      expect(() => normalizeOpenCodeTool(protocol, 'shell', input)).toThrow();
  },
);
