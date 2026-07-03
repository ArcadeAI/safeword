/**
 * Contract test for the shipped-template-revision registry (ticket 56JCFZ):
 * the CURRENT template's hash must be registered, so editing
 * templates/cucumber/cucumber.mjs without appending its hash fails here
 * instead of silently making future upgrades mistake today's installs for
 * host harnesses.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { isShippedCucumberTemplateRevision } from '../../src/utils/cucumber-template-revisions.js';
import { repoRoot } from '../helpers.js';

const CURRENT_TEMPLATE = readFileSync(
  nodePath.join(repoRoot, 'packages/cli/templates/cucumber/cucumber.mjs'),
  'utf8',
);

describe('cucumber template revision registry', () => {
  it('registers the current template content (append its hash when the template changes)', () => {
    expect(isShippedCucumberTemplateRevision(CURRENT_TEMPLATE)).toBe(true);
  });

  it('does not match customer-authored content', () => {
    expect(isShippedCucumberTemplateRevision('export default { paths: ["acceptance/"] };\n')).toBe(
      false,
    );
  });
});
