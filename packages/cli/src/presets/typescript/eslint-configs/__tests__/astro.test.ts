/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { astroConfig, buildAstroConfig } from '../astro.js';
import { getAllRules, getRuleConfig, getSeverity, getSeverityNumber } from './test-utilities.js';

const ERROR = 2;

async function readCliPackageJson(): Promise<{
  dependencies?: Record<string, string>;
  engines?: Record<string, string>;
}> {
  const packageJsonUrl = new URL('../../../../../package.json', import.meta.url);
  return JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
    dependencies?: Record<string, string>;
    engines?: Record<string, string>;
  };
}

describe('Astro config', () => {
  it('exports astroConfig as an array', () => {
    expect(Array.isArray(astroConfig)).toBe(true);
    expect(astroConfig.length).toBeGreaterThan(0);
  });

  it('ships latest Astro 3 linting with a matching Node engine contract', async () => {
    const packageJson = await readCliPackageJson();

    expect(packageJson.dependencies?.['eslint-plugin-astro']).toBe('~3.0.1');
    expect(packageJson.engines?.node).toBe('^22.22.3 || ^24.16.0 || >=26.3.0');
  });

  it('includes eslint-plugin-astro', () => {
    const hasAstroPlugin = astroConfig.some(
      (config: any) => config.plugins && 'astro' in config.plugins,
    );
    expect(hasAstroPlugin).toBe(true);
  });

  it('targets .astro files', () => {
    const hasAstroFiles = astroConfig.some((config: any) =>
      config.files?.some((pattern: string) => pattern.includes('.astro')),
    );
    expect(hasAstroFiles).toBe(true);
  });

  describe('recommended rules from flat/recommended', () => {
    it('astro/missing-client-only-directive-value is error', () => {
      const severity = getSeverity(
        getRuleConfig(astroConfig, 'astro/missing-client-only-directive-value'),
      );
      expect(severity).toBe('error');
    });

    it('astro/no-conflict-set-directives is error', () => {
      const severity = getSeverity(getRuleConfig(astroConfig, 'astro/no-conflict-set-directives'));
      expect(severity).toBe('error');
    });

    it('astro/no-deprecated-astro-canonicalurl is error', () => {
      const severity = getSeverity(
        getRuleConfig(astroConfig, 'astro/no-deprecated-astro-canonicalurl'),
      );
      expect(severity).toBe('error');
    });

    it('astro/no-deprecated-astro-fetchcontent is error', () => {
      const severity = getSeverity(
        getRuleConfig(astroConfig, 'astro/no-deprecated-astro-fetchcontent'),
      );
      expect(severity).toBe('error');
    });

    it('astro/no-deprecated-astro-resolve is error', () => {
      const severity = getSeverity(getRuleConfig(astroConfig, 'astro/no-deprecated-astro-resolve'));
      expect(severity).toBe('error');
    });

    it('astro/no-deprecated-getentrybyslug is error', () => {
      const severity = getSeverity(
        getRuleConfig(astroConfig, 'astro/no-deprecated-getentrybyslug'),
      );
      expect(severity).toBe('error');
    });

    it('astro/no-unused-define-vars-in-style is error', () => {
      const severity = getSeverity(
        getRuleConfig(astroConfig, 'astro/no-unused-define-vars-in-style'),
      );
      expect(severity).toBe('error');
    });

    it('astro/no-prerender-export-outside-pages is error', () => {
      const severity = getSeverity(
        getRuleConfig(astroConfig, 'astro/no-prerender-export-outside-pages'),
      );
      expect(severity).toBe('error');
    });

    // `astro/no-omitted-end-tags` and `astro/valid-compile` were asserted here
    // until eslint-plugin-astro v3 deprecated both and dropped them from
    // `flat/recommended`. Both are still exported by the plugin, so the preset
    // COULD re-enable them explicitly — deliberately not done: no-omitted-end-tags
    // is a no-op in v3 (Astro's compiler rejects omitted end tags at parse time),
    // and upstream's own docs for valid-compile tell users to remove it from
    // their ESLint config and run `astro check` instead. See the note in astro.ts.
    it('does not assert the rules v3 deprecated out of flat/recommended', () => {
      expect(getRuleConfig(astroConfig, 'astro/no-omitted-end-tags')).toBeUndefined();
      expect(getRuleConfig(astroConfig, 'astro/valid-compile')).toBeUndefined();
    });
  });

  describe('LLM-critical rules (3 additional)', () => {
    it('astro/no-set-html-directive is error (XSS prevention)', () => {
      const severity = getSeverity(getRuleConfig(astroConfig, 'astro/no-set-html-directive'));
      expect(severity).toBe('error');
    });

    it('astro/no-unsafe-inline-scripts is error (CSP safety)', () => {
      const severity = getSeverity(getRuleConfig(astroConfig, 'astro/no-unsafe-inline-scripts'));
      expect(severity).toBe('error');
    });

    it('astro/no-exports-from-components is error (Astro convention)', () => {
      const severity = getSeverity(getRuleConfig(astroConfig, 'astro/no-exports-from-components'));
      expect(severity).toBe('error');
    });
  });

  describe('no warn rules (LLMs ignore warnings)', () => {
    it('no astro rules are at warn severity', () => {
      const allRules = getAllRules(astroConfig);
      const astroRules = Object.entries(allRules).filter(([name]) => name.startsWith('astro/'));

      const warnRules = astroRules.filter(([, config]) => {
        const severity = getSeverity(config);
        return severity === 'warn' || severity === 1;
      });

      expect(warnRules).toEqual([]);
    });
  });

  describe('Astro rule coverage', () => {
    /**
     * Named explicitly rather than counted. A bare floor passes as long as
     * SOME rules survive, so an upstream release that emptied
     * `flat/recommended` would read as full coverage — the config is derived
     * from that preset, so the count and the source move together. Naming the
     * rules makes the assertion fail on the change that matters.
     */
    const REQUIRED_ASTRO_RULES = [
      // v3 flat/recommended
      'astro/missing-client-only-directive-value',
      'astro/no-conflict-set-directives',
      'astro/no-deprecated-astro-canonicalurl',
      'astro/no-deprecated-astro-fetchcontent',
      'astro/no-deprecated-astro-resolve',
      'astro/no-deprecated-getentrybyslug',
      'astro/no-exports-from-components',
      'astro/no-prerender-export-outside-pages',
      'astro/no-unused-define-vars-in-style',
      // Safeword's LLM-critical additions
      'astro/no-set-html-directive',
      'astro/no-unsafe-inline-scripts',
    ];

    it.each(REQUIRED_ASTRO_RULES)('%s is configured at error', rule => {
      expect(getSeverity(getRuleConfig(astroConfig, rule))).toBe('error');
    });

    it('keeps the jsx-a11y-strict rules enforcing on top of the named core', () => {
      const enforcedA11yRules = Object.entries(getAllRules(astroConfig))
        .filter(([name]) => name.startsWith('astro/jsx-a11y/'))
        .filter(([, config]) => getSeverityNumber(config) === ERROR)
        .map(([name]) => name);

      // Scoped to the `astro/jsx-a11y/` prefix and to error severity, because
      // a floor over every `astro/` rule at any severity hides the two ways
      // this block degrades: a dropped a11y rule masked by a newly added
      // `flat/recommended` rule, or an a11y rule switched off upstream.
      // eslint-plugin-astro 3.0.1's `flat/jsx-a11y-strict` configures 33, of
      // which it deliberately ships `control-has-associated-label` and
      // `label-has-for` off — so 31 enforce. Naming all 31 would duplicate
      // upstream's list without adding signal; the floor plus the anchors
      // below covers it.
      expect(enforcedA11yRules.length).toBeGreaterThanOrEqual(31);
      expect(enforcedA11yRules).toEqual(
        expect.arrayContaining([
          'astro/jsx-a11y/alt-text',
          'astro/jsx-a11y/aria-props',
          'astro/jsx-a11y/html-has-lang',
          'astro/jsx-a11y/role-has-required-aria-props',
        ]),
      );
    });
  });

  describe('optional jsx-a11y dependency', () => {
    it('keeps core Astro rules when eslint-plugin-jsx-a11y is unavailable', () => {
      const config = buildAstroConfig({
        astroPlugin: {
          configs: {
            'flat/recommended': [
              {
                plugins: { astro: {} },
                rules: {
                  'astro/valid-compile': 'error',
                },
              },
            ],
            'flat/jsx-a11y-strict': [
              {
                rules: {
                  'astro/jsx-a11y/alt-text': 'error',
                },
              },
            ],
          },
        },
        hasJsxA11y: false,
      });

      expect(getSeverity(getRuleConfig(config, 'astro/valid-compile'))).toBe('error');
      expect(getRuleConfig(config, 'astro/jsx-a11y/alt-text')).toBeUndefined();
      expect(getSeverity(getRuleConfig(config, 'astro/no-set-html-directive'))).toBe('error');
    });
  });

  describe('linting real .astro files', () => {
    /**
     * Every other test here reads config shape, which stays green even if no
     * .astro file can be parsed at all. These two lint committed fixtures
     * through ESLint proper, so the whole eslint-plugin-astro →
     * astro-eslint-parser → @astrojs/compiler-rs path (a native binding since
     * plugin v3) has to work. This repo ships no .astro sources, so nothing
     * else exercises it.
     */
    async function lintAstroFixture(fixture: string): Promise<Linter.LintMessage[]> {
      const fixtureUrl = new URL(fixture, import.meta.url);
      const source = await readFile(fixtureUrl, 'utf8');

      return new Linter({ configType: 'flat' }).verify(source, astroConfig, {
        filename: fileURLToPath(fixtureUrl),
      });
    }

    it('reports nothing on a valid .astro file', async () => {
      // Empty, not "no errors": a parse failure surfaces as a fatal message
      // here, which is the regression this fixture is for.
      expect(await lintAstroFixture('astro-sample.astro')).toEqual([]);
    });

    it('flags markup violations from both rule blocks', async () => {
      // Both live in the template, not the frontmatter, so catching them proves
      // the Astro AST was built rather than the frontmatter alone. One rule per
      // block the config assembles: if either block stops reaching .astro
      // markup, the valid fixture above stays green but this fails.
      const messages = await lintAstroFixture('astro-violation-sample.astro');

      expect(messages.map(message => message.ruleId)).toEqual([
        'astro/no-set-html-directive',
        'astro/jsx-a11y/alt-text',
      ]);
    });
  });
});
