// cucumber-js config — the acceptance-test runner (ticket 102a), separate from
// vitest (which owns unit/integration). `tsx/esm` transpiles the TypeScript step
// definitions on the fly; `paths` are the `.feature` files. Auto-discovered by
// `cucumber-js`; invoked via the `test:bdd` script.
const acceptanceTags = 'not @wip and not @proof.vitest and not @manual and not @live';

export default {
  import: ['features/steps/**/*.ts'],
  paths: ['features/**/*.feature'],
  tags: acceptanceTags,
};

export const quietEnrollmentRed = {
  import: ['features/steps/world.ts', 'features/steps/quiet-unenrolled-reviews.steps.ts'],
  paths: ['features/quiet-unenrolled-reviews.feature'],
  tags: acceptanceTags,
};
