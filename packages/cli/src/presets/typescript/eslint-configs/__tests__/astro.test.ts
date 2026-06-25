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

  it('ships latest Astro 2 linting with a matching Node engine contract', async () => {
    const packageJson = await readCliPackageJson();

    expect(packageJson.dependencies?.['eslint-plugin-astro']).toBe('~2.1.0');
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

    it('astro/no-omitted-end-tags is error', () => {
      const severity = getSeverity(getRuleConfig(astroConfig, 'astro/no-omitted-end-tags'));
      expect(severity).toBe('error');
    });

    it('astro/no-prerender-export-outside-pages is error', () => {
      const severity = getSeverity(
        getRuleConfig(astroConfig, 'astro/no-prerender-export-outside-pages'),
      );
      expect(severity).toBe('error');
    });

    it('astro/valid-compile is error', () => {
      const severity = getSeverity(getRuleConfig(astroConfig, 'astro/valid-compile'));
      expect(severity).toBe('error');
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
    it('keeps expanded Astro 2.1 coverage plus Safeword custom rules', () => {
      const allRules = getAllRules(astroConfig);
      const astroRules = Object.keys(allRules).filter(name => name.startsWith('astro/'));

      expect(astroRules.length).toBeGreaterThanOrEqual(46);
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
