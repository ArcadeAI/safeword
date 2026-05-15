/**
 * Unit tests for project type detection (Tests 4.1-4.3)
 *
 * These are pure unit tests for the detectProjectType function.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  writeTestFile,
} from '../../tests/helpers.js';
import type { Languages, PackageJson, PythonProjectType } from './project-detector.js';
import { detectLanguages, detectProjectType, detectPythonType } from './project-detector.js';

describe('detectProjectType', () => {
  describe('Test 4.1: Detects TypeScript project', () => {
    it('should detect typescript from devDependencies', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        devDependencies: {
          typescript: '^5.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.typescript).toBe(true);
    });

    it('should detect typescript from dependencies', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          typescript: '^5.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.typescript).toBe(true);
    });

    it('should return false when typescript is not present', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {},
      };

      const result = detectProjectType(packageJson);
      expect(result.typescript).toBe(false);
    });
  });

  describe('Test 4.2: Detects React project', () => {
    it('should detect react from dependencies', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.react).toBe(true);
    });

    it('should detect react from devDependencies', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        devDependencies: {
          react: '^18.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.react).toBe(true);
    });

    it('should return false when react is not present', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {},
      };

      const result = detectProjectType(packageJson);
      expect(result.react).toBe(false);
    });
  });

  describe('Test 4.3: Detects Next.js project', () => {
    it('should detect next.js from dependencies', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.nextjs).toBe(true);
    });

    it('should imply react when next.js is present', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0',
          // Note: react not explicitly listed
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.nextjs).toBe(true);
      expect(result.react).toBe(true); // Next.js implies React
    });
  });

  describe('Detects other frameworks', () => {
    it('should detect Astro project', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          astro: '^4.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.astro).toBe(true);
    });
  });

  describe('Detects Tailwind', () => {
    it('should detect tailwindcss from dependencies', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          tailwindcss: '^3.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.tailwind).toBe(true);
    });

    it('should detect tailwindcss from devDependencies', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        devDependencies: {
          tailwindcss: '^3.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.tailwind).toBe(true);
    });

    it('should detect @tailwindcss/vite (Tailwind v4)', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        devDependencies: {
          '@tailwindcss/vite': '^4.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.tailwind).toBe(true);
    });

    it('should detect @tailwindcss/postcss (Tailwind v4)', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        devDependencies: {
          '@tailwindcss/postcss': '^4.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.tailwind).toBe(true);
    });
  });

  describe('Detects publishable library', () => {
    it('should detect library with main field', () => {
      const packageJson: PackageJson = {
        name: 'my-lib',
        version: '1.0.0',
        main: './dist/index.js',
      };

      const result = detectProjectType(packageJson);
      expect(result.publishableLibrary).toBe(true);
    });

    it('should detect library with module field', () => {
      const packageJson: PackageJson = {
        name: 'my-lib',
        version: '1.0.0',
        module: './dist/index.mjs',
      };

      const result = detectProjectType(packageJson);
      expect(result.publishableLibrary).toBe(true);
    });

    it('should detect library with exports field', () => {
      const packageJson: PackageJson = {
        name: 'my-lib',
        version: '1.0.0',
        exports: {
          '.': './dist/index.js',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.publishableLibrary).toBe(true);
    });

    it('should NOT detect private packages as publishable', () => {
      const packageJson: PackageJson = {
        name: 'my-app',
        version: '1.0.0',
        private: true,
        main: './dist/index.js',
      };

      const result = detectProjectType(packageJson);
      expect(result.publishableLibrary).toBe(false);
    });

    it('should NOT detect apps without entry points as publishable', () => {
      const packageJson: PackageJson = {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.publishableLibrary).toBe(false);
    });
  });

  describe('Detects existing linter', () => {
    it('should detect existing linter from lint script', () => {
      const packageJson = {
        name: 'test',
        version: '1.0.0',
        scripts: {
          lint: 'biome check .',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.existingLinter).toBe(true);
    });

    it('should return false when no lint script exists', () => {
      const packageJson = {
        name: 'test',
        version: '1.0.0',
        scripts: {
          build: 'tsc',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.existingLinter).toBe(false);
    });
  });

  describe('Detects existing formatter', () => {
    it('should detect existing formatter from format script', () => {
      const packageJson = {
        name: 'test',
        version: '1.0.0',
        scripts: {
          format: 'biome format .',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.existingFormatter).toBe(true);
    });

    it('should return false when no format script exists (without cwd)', () => {
      const packageJson = {
        name: 'test',
        version: '1.0.0',
        scripts: {
          build: 'tsc',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.existingFormatter).toBe(false);
    });
  });

  describe('Detects TanStack Query', () => {
    it('should detect @tanstack/react-query', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          '@tanstack/react-query': '^5.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.tanstackQuery).toBe(true);
    });

    it('should detect @tanstack/vue-query', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          '@tanstack/vue-query': '^5.0.0',
        },
      };

      const result = detectProjectType(packageJson);
      expect(result.tanstackQuery).toBe(true);
    });
  });

  describe('Handles edge cases', () => {
    it('should handle empty package.json', () => {
      const packageJson: PackageJson = {};

      const result = detectProjectType(packageJson);

      expect(result.typescript).toBe(false);
      expect(result.react).toBe(false);
      expect(result.nextjs).toBe(false);
      expect(result.astro).toBe(false);
      expect(result.tailwind).toBe(false);
      expect(result.publishableLibrary).toBe(false);
      expect(result.existingLinter).toBe(false);
      expect(result.existingFormatter).toBe(false);
      expect(result.tanstackQuery).toBe(false);
    });

    it('should handle complex project with multiple frameworks', () => {
      const packageJson: PackageJson = {
        name: 'complex-project',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
        devDependencies: {
          typescript: '^5.3.0',
          vitest: '^1.0.0',
        },
      };

      const result = detectProjectType(packageJson);

      expect(result.typescript).toBe(true);
      expect(result.react).toBe(true);
      expect(result.nextjs).toBe(true);
      expect(result.vitest).toBe(true);
      expect(result.astro).toBe(false);
    });
  });
});

/**
 * Test Suite 1: Python Project Detection
 * Tests for Story 1 - detecting Python projects and their characteristics.
 */

describe('detectLanguages', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 1.1: Detects pyproject.toml as Python project', () => {
    it('should detect python from pyproject.toml', () => {
      writeTestFile(temporaryDirectory, 'pyproject.toml', '[project]\nname = "test"\n');

      const result: Languages = detectLanguages(temporaryDirectory);

      expect(result.python).toBe(true);
      expect(result.javascript).toBe(false);
    });
  });

  describe('Test 1.2: Detects requirements.txt as Python fallback', () => {
    it('should detect python from requirements.txt when pyproject.toml absent', () => {
      writeTestFile(temporaryDirectory, 'requirements.txt', 'django>=4.0\n');

      const result: Languages = detectLanguages(temporaryDirectory);

      expect(result.python).toBe(true);
    });
  });

  describe('Test 1.9: Detects polyglot project (JS + Python)', () => {
    it('should detect both languages when package.json and pyproject.toml exist', () => {
      writeTestFile(temporaryDirectory, 'package.json', '{"name": "test"}');
      writeTestFile(temporaryDirectory, 'pyproject.toml', '[project]\nname = "test"\n');

      const result: Languages = detectLanguages(temporaryDirectory);

      expect(result.python).toBe(true);
      expect(result.javascript).toBe(true);
    });
  });

  describe('Test 1.10: Works without package.json', () => {
    it('should complete detection without package.json', () => {
      writeTestFile(temporaryDirectory, 'pyproject.toml', '[project]\nname = "test"\n');

      const result: Languages = detectLanguages(temporaryDirectory);

      expect(result.python).toBe(true);
      expect(result.javascript).toBe(false);
    });
  });
});

describe('detectPythonType', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 1.3: Detects Django framework', () => {
    it('should detect django from pyproject.toml dependencies', () => {
      writeTestFile(
        temporaryDirectory,
        'pyproject.toml',
        '[project]\ndependencies = ["django>=4.0"]\n',
      );

      const result: PythonProjectType | undefined = detectPythonType(temporaryDirectory);

      expect(result).toBeDefined();
      expect(result?.framework).toBe('django');
    });
  });

  describe('Test 1.4: Detects Flask framework', () => {
    it('should detect flask from pyproject.toml dependencies', () => {
      writeTestFile(
        temporaryDirectory,
        'pyproject.toml',
        '[project]\ndependencies = ["flask>=2.0"]\n',
      );

      const result: PythonProjectType | undefined = detectPythonType(temporaryDirectory);

      expect(result).toBeDefined();
      expect(result?.framework).toBe('flask');
    });
  });

  describe('Test 1.5: Detects FastAPI framework', () => {
    it('should detect fastapi from pyproject.toml dependencies', () => {
      writeTestFile(
        temporaryDirectory,
        'pyproject.toml',
        '[project]\ndependencies = ["fastapi>=0.100"]\n',
      );

      const result: PythonProjectType | undefined = detectPythonType(temporaryDirectory);

      expect(result).toBeDefined();
      expect(result?.framework).toBe('fastapi');
    });
  });

  describe('Test 1.6: Detects Poetry package manager', () => {
    it('should detect poetry from [tool.poetry] section', () => {
      writeTestFile(temporaryDirectory, 'pyproject.toml', '[tool.poetry]\nname = "test"\n');

      const result: PythonProjectType | undefined = detectPythonType(temporaryDirectory);

      expect(result).toBeDefined();
      expect(result?.packageManager).toBe('poetry');
    });
  });

  describe('Test 1.7: Detects uv package manager', () => {
    it('should detect uv from uv.lock file', () => {
      writeTestFile(temporaryDirectory, 'pyproject.toml', '[project]\nname = "test"\n');
      writeTestFile(temporaryDirectory, 'uv.lock', '# uv lockfile\n');

      const result: PythonProjectType | undefined = detectPythonType(temporaryDirectory);

      expect(result).toBeDefined();
      expect(result?.packageManager).toBe('uv');
    });
  });

  describe('Test 1.8: Defaults to pip package manager', () => {
    it('should default to pip when no other manager detected', () => {
      writeTestFile(temporaryDirectory, 'requirements.txt', 'requests>=2.0\n');

      const result: PythonProjectType | undefined = detectPythonType(temporaryDirectory);

      expect(result).toBeDefined();
      expect(result?.packageManager).toBe('pip');
    });
  });
});
