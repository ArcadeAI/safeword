/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { astroConfig, buildAstroConfig } from '../astro.js';
import { getAllRules, getRuleConfig, getSeverity } from './test-utilities.js';

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

    expect(packageJson.dependencies?.['eslint-plugin-astro']).toBe('~3.1.0');
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

    it('keeps the jsx-a11y-strict rules on top of the named core', () => {
      const astroRules = Object.keys(getAllRules(astroConfig)).filter(name =>
        name.startsWith('astro/'),
      );

      // The bulk above the named core is the adapted jsx-a11y set; the floor
      // guards that block specifically, since naming 30+ a11y rules would
      // duplicate upstream's list without adding signal.
      expect(astroRules.length).toBeGreaterThanOrEqual(44);
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
});
