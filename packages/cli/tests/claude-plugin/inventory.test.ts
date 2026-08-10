import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { claudeNativePayloadFiles } from '../../src/claude-plugin/inventory.js';
import { createTemporaryDirectory } from '../helpers.js';

describe('Claude native plugin inventory', () => {
  it('ignores Claude host lease markers only at the payload root', () => {
    const root = createTemporaryDirectory();
    mkdirSync(nodePath.join(root, '.in_use'));
    writeFileSync(nodePath.join(root, '.in_use/12345'), '');
    mkdirSync(nodePath.join(root, 'skills/.in_use'), { recursive: true });
    writeFileSync(nodePath.join(root, 'skills/.in_use/unlisted'), 'untrusted\n');

    expect(claudeNativePayloadFiles(root)).toEqual(['skills/.in_use/unlisted']);
  });
});
