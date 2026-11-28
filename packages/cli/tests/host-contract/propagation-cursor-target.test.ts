import { expect, it } from 'vitest';

import { requiredCursorIdeTarget } from '../helpers/cursor-native-window.js';

// Exact lookup used by real window preparation; no OS/UI/model calls or skipped platforms.
it('selects current project hooks separately on the same current IDE release', () => {
  expect(
    requiredCursorIdeTarget('3.29.9', 'project-hooks'),
    'PROJECT_PROPAGATION_TARGET_REPLACED',
  ).toMatchObject({
    agent: 'cursor',
    version: '3.29.9',
    runtimes: ['IDE'],
    delivery_variants: ['native', 'project-hooks'],
  });
});
it('does not substitute an unlisted version for the current native target', () => {
  expect(() => requiredCursorIdeTarget('unlisted', 'native')).toThrow(
    'CURSOR_SETUP_UNAVAILABLE: unsupported exact delivery',
  );
});
it('preserves the existing default native selection for the current exact version', () => {
  expect(requiredCursorIdeTarget('3.29.9')).toMatchObject({
    version: '3.29.9',
    delivery_variants: ['native', 'project-hooks'],
    macos_arm64: {
      build: '306d153d51d714882ab7b1bc49649cab624e8a30',
      sha256: '3eefc6948a93e5aedfa27d2fe3139aee97153898ff392e3c7181df2e53e97c37',
      cdhash: '57d1aaf4731ec323a28c0ae233993a9583172994',
      signing_team: 'VDXQ22DGB9',
    },
  });
});
