import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { provisionIsolatedGrade } from '../helpers/codex-isolated-project.js';

vi.mock('node:fs', { spy: true });

it('removes only the child credential when securing its copied file fails', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'isolated-credential-control-'));
  const source = path.join(root, 'source');
  const original = path.join(source, 'auth.json');
  const contents = 'disposable test data';
  let copy = '';
  try {
    mkdirSync(source);
    writeFileSync(original, contents);
    vi.mocked(chmodSync).mockImplementationOnce(file => {
      copy = String(file);
      expect(path.basename(copy)).toBe('auth.json');
      expect(copy).not.toBe(original);
      expect(readFileSync(copy, 'utf8')).toBe(contents);
      throw new Error('controlled mode-change error');
    });
    expect(() => provisionIsolatedGrade(root, source)).toThrow('controlled mode-change error');
    expect(existsSync(copy)).toBe(false);
    expect(readFileSync(original, 'utf8')).toBe(contents);
  } finally {
    vi.mocked(chmodSync).mockRestore();
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
