/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

/**
 * Test utilities for ESLint config tests.
 * Shared helpers to navigate flat config structures.
 */

/**
 * Get effective rule config from flat config array.
 * Returns the LAST match since ESLint flat config uses last-wins for rule resolution.
 */
export function getRuleConfig(config: any[], ruleId: string): any {
  let result: any;
  for (const configObject of config) {
    if (configObject.rules && ruleId in configObject.rules) {
      result = configObject.rules[ruleId];
    }
  }
  return result;
}

/**
 * Extract severity from rule config.
 * Handles all ESLint config formats: number, string, or array.
 * Returns the original value (string or number).
 */
// eslint-disable-next-line sonarjs/function-return-type -- Intentionally returns number | string | undefined to match ESLint's severity types
export function getSeverity(ruleConfig: any): number | string | undefined {
  if (ruleConfig === undefined) return undefined;
  if (typeof ruleConfig === 'number') return ruleConfig;
  if (typeof ruleConfig === 'string') return ruleConfig;
  if (Array.isArray(ruleConfig)) return ruleConfig[0];
  return undefined;
}

/**
 * Extract severity as numeric value (0=off, 1=warn, 2=error).
 * Normalizes string severities to their numeric equivalents.
 */
export function getSeverityNumber(ruleConfig: unknown): number {
  if (typeof ruleConfig === 'number') return ruleConfig;
  if (typeof ruleConfig === 'string') {
    if (ruleConfig === 'error') return 2;
    if (ruleConfig === 'warn') return 1;
    return 0;
  }
  if (Array.isArray(ruleConfig) && ruleConfig.length > 0) {
    return getSeverityNumber(ruleConfig[0]);
  }
  return 0;
}

/**
 * Collect all rules from flat config array.
 * Merges rules from all config objects.
 */
export function getAllRules(config: any[]): Record<string, any> {
  const allRules: Record<string, any> = {};
  for (const configObject of config) {
    if (configObject.rules) {
      Object.assign(allRules, configObject.rules);
    }
  }
  return allRules;
}
