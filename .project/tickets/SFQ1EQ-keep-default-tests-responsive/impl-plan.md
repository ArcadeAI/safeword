# Implementation Plan: Keep default tests responsive

1. Add a failing boundary test that requires config-only setup suites to pass
   the skip-install environment and requires the non-git install proof to live
   in the slow test file.
2. Update the Cursor, hook, and conditional-setup fixtures to disable dependency
   installation while preserving their existing assertions.
3. Move the non-git dependency-installation proof to
   `conditional-setup.slow.test.ts`.
4. Run the focused default and slow lanes, then reprofile the full default suite.
5. Keep `maxWorkers: 3`; do not introduce Vitest projects unless the new profile
   identifies a genuine shared-resource or contention-sensitive lane.
