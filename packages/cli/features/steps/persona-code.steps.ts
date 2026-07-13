import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';
import { createJiti } from 'jiti';

import type * as PersonasModule from '../../src/utils/personas.js';
import type { PersonaValidationError, ResolvedPersona } from '../../src/utils/personas.js';
import type * as JtbdModule from '../../templates/hooks/lib/jtbd.js';
import type { JtbdGateVerdict } from '../../templates/hooks/lib/jtbd.js';
import type { SafewordWorld } from './world.js';

const jiti = createJiti(import.meta.url);
const { derivePersonaCode, parsePersonas, resolvePersonaCodes, validatePersonas } =
  await jiti.import<typeof PersonasModule>('../../src/utils/personas.ts');
const { evaluateJtbdGate, knownPersonaRefs } = await jiti.import<typeof JtbdModule>(
  '../../templates/hooks/lib/jtbd.ts',
);

interface PersonaCodeState {
  content: string;
  names: string[];
  cli: ResolvedPersona[];
  hookReferences: Set<string>;
  validation: PersonaValidationError[];
  hookVerdict?: JtbdGateVerdict;
  referencedCode?: string;
  surface?: string;
  personaGuidance?: string;
  discoveryGuidance?: string;
  scenarioGuidance?: string;
  projectRoot?: string;
}

const states = new WeakMap<SafewordWorld, PersonaCodeState>();
const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const cliPath = nodePath.join(repoRoot, 'packages/cli/dist/cli.js');

After(function (this: SafewordWorld) {
  const projectRoot = states.get(this)?.projectRoot;
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  states.delete(this);
});

function state(world: SafewordWorld): PersonaCodeState {
  let current = states.get(world);
  if (!current) {
    current = { content: '', names: [], cli: [], hookReferences: new Set(), validation: [] };
    states.set(world, current);
  }
  return current;
}

function catalog(names: readonly string[], explicitCode?: string): string {
  return names
    .map(name => {
      const suffix = explicitCode ? ` (${explicitCode})` : '';
      return `## ${name}${suffix}\n\n**Role:** Test persona.`;
    })
    .join('\n\n');
}

function resolveBoth(current: PersonaCodeState): void {
  current.cli = resolvePersonaCodes(parsePersonas(current.content));
  current.hookReferences = knownPersonaRefs(current.content);
}

function prepareFixture(current: PersonaCodeState): void {
  current.projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'persona-code-bdd-'));
  writeFileSync(
    nodePath.join(current.projectRoot, 'package.json'),
    JSON.stringify({ name: 'persona-code-fixture', private: true }),
  );
  const git = spawnSync('git', ['init', '--quiet'], { cwd: current.projectRoot, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
}

function installAndReadAssets(current: PersonaCodeState): void {
  assert.ok(current.projectRoot);
  const setup = spawnSync('bun', [cliPath, 'setup', '--yes', '--no-modify'], {
    cwd: current.projectRoot,
    encoding: 'utf8',
    env: { ...process.env, SAFEWORD_SKIP_INSTALL: '1', SAFEWORD_SKIP_SKILLS: '1' },
  });
  assert.equal(setup.status, 0, `${setup.stdout}\n${setup.stderr}`);

  const skillRoot = current.surface === 'OpenAI Codex' ? '.agents' : '.claude';
  current.personaGuidance = readFileSync(
    nodePath.join(current.projectRoot, '.project/personas.md'),
    'utf8',
  );
  current.discoveryGuidance = readFileSync(
    nodePath.join(current.projectRoot, skillRoot, 'skills/bdd/DISCOVERY.md'),
    'utf8',
  );
  current.scenarioGuidance = readFileSync(
    nodePath.join(current.projectRoot, skillRoot, 'skills/bdd/SCENARIOS.md'),
    'utf8',
  );
}

Given('a persona named {string} without an explicit code', function (this: SafewordWorld, name) {
  const current = state(this);
  current.names = [name];
  current.content = catalog(current.names);
});

When('the CLI resolver and installed JTBD hook resolve its code', function (this: SafewordWorld) {
  resolveBoth(state(this));
});

Then('both resolve the exact code {string}', function (this: SafewordWorld, code) {
  const current = state(this);
  assert.equal(current.cli[0]?.code, code);
  assert.ok(current.hookReferences.has(`${current.names[0]} (${code})`));
});

Then(
  'the resolved code is between {int} and {int} characters',
  function (this: SafewordWorld, minimum, maximum) {
    const code = state(this).cli[0]?.code ?? '';
    assert.ok(code.length >= minimum && code.length <= maximum);
  },
);

Given(
  '{string} precedes {string} in the persona catalog',
  function (this: SafewordWorld, first, second) {
    const current = state(this);
    current.names = [first, second];
    current.content = catalog(current.names);
  },
);

Given('both names derive the code {string}', function (this: SafewordWorld, code) {
  for (const name of state(this).names) assert.equal(derivePersonaCode(name), code);
});

When(
  'the CLI resolver and installed JTBD hook resolve the catalog in source order',
  function (this: SafewordWorld) {
    resolveBoth(state(this));
  },
);

Then('both map {string} to {string}', function (this: SafewordWorld, name, code) {
  const current = state(this);
  assert.equal(current.cli.find(persona => persona.name === name)?.code, code);
  assert.ok(current.hookReferences.has(`${name} (${code})`));
});

When('safeword validates the persona catalog', function (this: SafewordWorld) {
  const current = state(this);
  current.validation = validatePersonas(parsePersonas(current.content));
});

Then(
  'validation identifies {string} as a non-canonical derived code',
  function (this: SafewordWorld, name) {
    assert.ok(state(this).validation.some(error => error.message.includes('non-canonical')));
    assert.equal(state(this).names[0], name);
  },
);

Then(
  'the message requests an explicit {int}–{int} letter code',
  function (this: SafewordWorld, minimum, maximum) {
    assert.ok(
      state(this).validation.some(error =>
        error.message.includes(`explicit ${minimum}–${maximum} letter code`),
      ),
    );
  },
);

Given(
  'an ordered persona catalog contains {int} names deriving {string}',
  function (this: SafewordWorld, count, code) {
    const current = state(this);
    current.names = Array.from({ length: count }, (_, index) => `Pl${index} Operator`);
    assert.ok(current.names.every(name => derivePersonaCode(name) === code));
    current.content = catalog(current.names);
  },
);

When(
  'the CLI resolver and installed JTBD hook resolve the catalog',
  function (this: SafewordWorld) {
    const current = state(this);
    resolveBoth(current);
    const lastName = current.names.at(-1) ?? '';
    current.validation = validatePersonas(parsePersonas(current.content));
    current.hookVerdict = evaluateJtbdGate(
      `## Jobs To Be Done\n\n### x.PLO1 — t\n\n**Persona:** ${lastName}`,
      current.content,
    );
  },
);

Then('both report that the canonical collision space is exhausted', function (this: SafewordWorld) {
  const current = state(this);
  assert.equal(current.cli.at(-1)?.codeError, 'collision-space-exhausted');
  assert.equal(current.hookVerdict?.ok, false);
  if (!current.hookVerdict?.ok) assert.match(current.hookVerdict.reason, /collision.*exhausted/i);
});

Then(
  'both messages request an explicit {int}–{int} letter code',
  function (this: SafewordWorld, minimum, maximum) {
    const current = state(this);
    const expected = `explicit ${minimum}–${maximum} letter code`;
    assert.ok(current.validation.some(error => error.message.includes(expected)));
    assert.ok(current.hookVerdict?.ok === false && current.hookVerdict.reason.includes(expected));
  },
);

Given('a persona with the explicit code {string}', function (this: SafewordWorld, code) {
  const current = state(this);
  current.names = ['Compatibility Persona'];
  current.content = catalog(current.names, code);
});

When('safeword validates and resolves that persona', function (this: SafewordWorld) {
  const current = state(this);
  current.validation = validatePersonas(parsePersonas(current.content));
  current.cli = resolvePersonaCodes(parsePersonas(current.content));
});

Then('validation accepts the code', function (this: SafewordWorld) {
  assert.deepEqual(state(this).validation, []);
});

Then('resolution returns the exact code {string}', function (this: SafewordWorld, code) {
  assert.equal(state(this).cli[0]?.code, code);
});

Given(
  'personas.md declares Safeword Maintainer with the explicit code {string}',
  function (this: SafewordWorld, code) {
    const current = state(this);
    current.names = ['Safeword Maintainer'];
    current.content = catalog(current.names, code);
  },
);

Given(
  'an existing JTBD references the persona code {string}',
  function (this: SafewordWorld, code) {
    state(this).referencedCode = code;
  },
);

When('the installed intake gate validates the JTBD', function (this: SafewordWorld) {
  const current = state(this);
  current.hookVerdict = evaluateJtbdGate(
    `## Jobs To Be Done\n\n### x.${current.referencedCode}1 — t\n\n**Persona:** ${current.referencedCode}`,
    current.content,
  );
  current.cli = resolvePersonaCodes(parsePersonas(current.content));
});

Then('the reference resolves to the Safeword Maintainer persona', function (this: SafewordWorld) {
  assert.equal(state(this).hookVerdict?.ok, true);
  assert.equal(state(this).cli[0]?.name, 'Safeword Maintainer');
});

Then('its exact resolved code is {string}', function (this: SafewordWorld, code) {
  assert.equal(state(this).cli[0]?.code, code);
});

Then('validation rejects the code', function (this: SafewordWorld) {
  assert.ok(state(this).validation.some(error => error.message.includes('violates pattern')));
});

Given('a fresh project configured for {string}', function (this: SafewordWorld, surface) {
  const current = state(this);
  current.surface = surface;
  prepareFixture(current);
});

When('safeword installs its persona and BDD authoring assets', function (this: SafewordWorld) {
  installAndReadAssets(state(this));
});

Then(
  'persona guidance defines new codes as {int}–{int} letters',
  function (this: SafewordWorld, minimum, maximum) {
    assert.ok(
      (state(this).personaGuidance ?? '')
        .toLowerCase()
        .includes(`new codes use ${minimum}–${maximum} letters`),
    );
  },
);

Then('JTBD and Gherkin guidance carry the persona code unchanged', function (this: SafewordWorld) {
  assert.ok((state(this).discoveryGuidance ?? '').includes('oauth-flow.PLO1'));
  assert.ok((state(this).scenarioGuidance ?? '').includes('@oauth-flow.PLO1.R2'));
});

Given('the installed persona and BDD authoring assets', function (this: SafewordWorld) {
  const current = state(this);
  current.surface = 'Claude Code';
  prepareFixture(current);
});

When('their new-code examples are inspected', function (this: SafewordWorld) {
  installAndReadAssets(state(this));
});

Then(
  'every new-code example uses {int}–{int} letters',
  function (this: SafewordWorld, minimum, maximum) {
    const combined = `${state(this).personaGuidance}\n${state(this).discoveryGuidance}\n${state(this).scenarioGuidance}`;
    assert.ok(combined.includes('Platform Operator (PLO)'));
    assert.ok('PLO'.length >= minimum && 'PLO'.length <= maximum);
  },
);

Then('two-letter codes are described only as legacy compatibility', function (this: SafewordWorld) {
  const combined = `${state(this).personaGuidance}\n${state(this).discoveryGuidance}`;
  assert.match(combined, /legacy.*2–6/i);
  assert.ok(!combined.includes('Platform Operator (PO)'));
});
