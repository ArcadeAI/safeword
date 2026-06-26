import { join } from 'node:path';

import { loadRustTaskManifest, repositoriesBySplit } from '../src/dataset';

const repoRoot = join(import.meta.dirname, '../../../..');
const pilotManifestPath = join(repoRoot, 'experiments/gepa-language-skills/rust/tasks/pilot.json');

describe('Rust pilot manifest', () => {
  it('loads the seven-repository split with pinned refs', () => {
    const tasks = loadRustTaskManifest(pilotManifestPath);

    expect(repositoriesBySplit(tasks)).toEqual({
      train: ['sharkdp/fd', 'clap-rs/clap', 'tokio-rs/tokio'],
      validation: ['BurntSushi/ripgrep', 'rustls/rustls'],
      heldout: ['rust-lang/cargo', 'rust-lang/rust-analyzer'],
    });
    expect(tasks).toHaveLength(7);
    expect(new Set(tasks.map(task => task.repository.id)).size).toBe(7);
    expect(tasks.every(task => /^[a-f0-9]{40}$/i.test(task.repository.ref))).toBe(true);
    expect(
      tasks.every(task => /^rust:1\.96@sha256:[a-f0-9]{64}$/i.test(task.sandbox.runner.image)),
    ).toBe(true);
    expect(tasks.every(task => task.sandbox.network === 'prefetch-only')).toBe(true);
    expect(tasks.every(task => task.sandbox.userIsolation === 'non-root')).toBe(true);
  });
});
