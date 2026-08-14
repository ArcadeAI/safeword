/**
 * Python tooling readiness for the shared doctor/status health contract.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('python tool readiness', () => {
  let projectDirectory: string;

  beforeEach(async () => {
    projectDirectory = createTemporaryDirectory();
    await createConfiguredProject(projectDirectory);
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('reports undeclared Safeword Python tools through doctor', async () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "python-project"
version = "0.1.0"
dependencies = ["ruff>=0.8.0"]
`,
    );

    const result = await runCli(['doctor', '--json', '--offline'], { cwd: projectDirectory });
    const output = JSON.parse(result.stdout) as {
      state: string;
      findings: { code: string; message: string }[];
    };

    expect(result.exitCode).toBe(2);
    expect(output.state).not.toBe('verified');
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_PYTHON_TOOL',
          message: 'mypy is not declared for this Python project.',
        }),
        expect.objectContaining({
          code: 'MISSING_PYTHON_TOOL',
          message: 'deadcode is not declared for this Python project.',
        }),
      ]),
    );
  });

  it('reports undeclared Safeword Python tools through status', async () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "python-project"
version = "0.1.0"
dependencies = ["ruff>=0.8.0"]
`,
    );

    const result = await runCli(['status', '--json', '--offline'], { cwd: projectDirectory });
    const output = JSON.parse(result.stdout) as {
      findings: { code: string; message: string }[];
    };

    expect(result.exitCode).toBe(2);
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_PYTHON_TOOL',
          message: 'mypy is not declared for this Python project.',
        }),
      ]),
    );
  });

  it('does not count commented Python tool names as doctor declarations', async () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "python-project"
version = "0.1.0"
dependencies = [
  "ruff>=0.8.0", # TODO add "mypy" and "deadcode" later
]
`,
    );

    const result = await runCli(['doctor', '--json', '--offline'], { cwd: projectDirectory });
    const output = JSON.parse(result.stdout) as {
      findings: { code: string; message: string }[];
    };

    expect(result.exitCode).toBe(2);
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_PYTHON_TOOL',
          message: 'mypy is not declared for this Python project.',
        }),
        expect.objectContaining({
          code: 'MISSING_PYTHON_TOOL',
          message: 'deadcode is not declared for this Python project.',
        }),
      ]),
    );
  });

  it('does not count dependency-group references as doctor declarations', async () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "python-project"
version = "0.1.0"

[dependency-groups]
dev = [{ include-group = "mypy" }, "ruff", "deadcode"]
mypy = []
`,
    );

    const result = await runCli(['doctor', '--json', '--offline'], { cwd: projectDirectory });
    const output = JSON.parse(result.stdout) as {
      findings: { code: string; message: string }[];
    };

    expect(result.exitCode).toBe(2);
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_PYTHON_TOOL',
          message: 'mypy is not declared for this Python project.',
        }),
      ]),
    );
  });

  it('does not report a Python readiness finding when all required tools are declared', async () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "python-project"
version = "0.1.0"
dependencies = ["ruff>=0.8.0", "mypy", "deadcode"]
`,
    );

    const result = await runCli(['doctor', '--json', '--offline'], { cwd: projectDirectory });
    const output = JSON.parse(result.stdout) as {
      findings: { code: string }[];
    };

    expect(output.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_PYTHON_TOOL' })]),
    );
  });

  it('accepts Pipenv package and dev-package declarations through doctor', async () => {
    writeTestFile(
      projectDirectory,
      'Pipfile',
      `[packages]
ruff = "*"

[dev-packages]
mypy = "*"
deadcode = "*"
`,
    );

    const result = await runCli(['doctor', '--json', '--offline'], { cwd: projectDirectory });
    const output = JSON.parse(result.stdout) as {
      findings: { code: string }[];
    };

    expect(output.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_PYTHON_TOOL' })]),
    );
  });

  it('does not claim a healthy setup while Python tools are missing', async () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "python-project"
version = "0.1.0"
dependencies = ["ruff"]
`,
    );

    const result = await runCli(['setup', '--json'], {
      cwd: projectDirectory,
      env: { SAFEWORD_SKIP_INSTALL: '1' },
    });
    const output = JSON.parse(result.stdout) as {
      state: string;
      findings: { code: string; message: string }[];
      next_actions: { command: string }[];
    };

    expect(result.exitCode).toBe(2);
    expect(output.state).toBe('action_required');
    expect(output.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SETUP_POSTCONDITION_VERIFIED' })]),
    );
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SETUP_POSTCONDITION_ADVISORY',
          message: 'Missing Python tool: mypy',
        }),
        expect.objectContaining({
          code: 'SETUP_POSTCONDITION_ADVISORY',
          message: 'Missing Python tool: deadcode',
        }),
      ]),
    );
    expect(output.next_actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ command: 'pip install mypy deadcode' })]),
    );
  });

  it('does not add a Python readiness finding to a non-Python project', async () => {
    const result = await runCli(['doctor', '--json', '--offline'], { cwd: projectDirectory });
    const output = JSON.parse(result.stdout) as {
      findings: { code: string }[];
    };

    expect(output.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_PYTHON_TOOL' })]),
    );
  });

  it('requires import-linter when Safeword would scaffold its contract', async () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "python-project"
version = "0.1.0"
dependencies = ["ruff", "mypy", "deadcode"]
`,
    );
    writeTestFile(projectDirectory, 'src/python_project/__init__.py', '');

    const result = await runCli(['doctor', '--json', '--offline'], { cwd: projectDirectory });
    const output = JSON.parse(result.stdout) as {
      findings: { code: string; message: string }[];
    };

    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_PYTHON_TOOL',
          message: 'import-linter is not declared for this Python project.',
        }),
      ]),
    );
  });
});
