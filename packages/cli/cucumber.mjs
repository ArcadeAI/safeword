// cucumber-js config — the acceptance-test runner (ticket 102a), separate from
// vitest (which owns unit/integration). `tsx/esm` transpiles the TypeScript step
// definitions on the fly; `paths` are the `.feature` files. Auto-discovered by
// `cucumber-js`; invoked via the `test:bdd` script.
export default {
  import: ['tsx/esm', 'features/steps/**/*.ts'],
  paths: ['features/**/*.feature'],
  tags: 'not @manual and not @live',
};
