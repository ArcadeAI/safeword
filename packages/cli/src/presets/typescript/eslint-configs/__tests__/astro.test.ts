/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */
import { describe, expect, it } from 'vitest';

import { astroConfig } from '../astro.js';
import { getAllRules, getRuleConfig, getSeverity } from './test-utilities.js';

describe('Astro config', () => {
  it('exports astroConfig as an array', () => {
    expect(Array.isArray(astroConfig)).toBe(true);
    expect(astroConfig.length).toBeGreaterThan(0);
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

  describe('recommended rules (8 from flat/recommended)', () => {
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

  describe('total rule count', () => {
    it('has 44 astro rules configured (8 core + 33 a11y + 3 custom)', () => {
      const allRules = getAllRules(astroConfig);
      const astroRules = Object.keys(allRules).filter(name => name.startsWith('astro/'));

      // 8 from flat/recommended + 33 from flat/jsx-a11y-strict + 3 custom LLM rules
      expect(astroRules.length).toBe(44);
    });
  });
});
