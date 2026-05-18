import { globalIgnores } from 'eslint/config';

/**
 * Global ignore patterns for safeword's vendored content.
 *
 * Downstream consumers spread this into their `eslint.config.mjs` so that
 * their lint run skips files safeword installed under `.safeword/` and the
 * generated `.dependency-cruiser.cjs`. Without this, strict configs (e.g.,
 * `security/*` rules elevated to error) flag many false positives inside
 * vendored hook scripts that legitimately compute filesystem paths.
 *
 * Uses `globalIgnores()` (the explicit directory-pattern primitive per
 * ESLint's March 2025 guidance) rather than the older "ignores-only object"
 * form, so the block stays a global ignore even if it later gains keys.
 */
export const vendoredIgnoresConfig = [globalIgnores(['.safeword/**', '.dependency-cruiser.cjs'])];
