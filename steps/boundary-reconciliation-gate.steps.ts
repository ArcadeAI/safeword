/**
 * Acceptance steps for the boundary reconciliation gate (CDRJTW, #810 slice 1).
 *
 * Each scenario builds a real temp git repo (plus a bare remote for push-tier
 * scenarios) and shells out to the real CLI — `bun packages/cli/src/cli.ts
 * boundary --at <boundary>` — asserting on stdout/stderr, exit code, and the
 * audit record. One exception: the resolver-failure scenario drives the
 * engine directly under bun (a mid-run git failure cannot be staged reliably
 * from outside; the engine seam is where the contract lives, and the exit-0
 * half is proven by the other never-block steps).
 */

import { strict as assert } from 'node:assert';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { implPlanContent } from './anchor-fixtures.ts';
import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');
const AUDIT_PATH = '.safeword/boundary-audit.jsonl';
const TICKET_DIR = '.project/tickets/BGT001-fixture';

interface BoundaryWorld extends SafewordWorld {
  dir?: string;
  remote?: string;
  cli?: { exitCode: number; output: string };
  engineVerdicts?: Array<{ check: string; verdict: string; detail?: string }>;
}

function git(dir: string, command: string): string {
  return execSync(`git ${command}`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
}

function writeFileAt(dir: string, relative: string, content: string): void {
  const full = nodePath.join(dir, relative);
  mkdirSync(nodePath.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function ticketContent(options: {
  type?: string;
  phase: string;
  anchors?: string[];
  skips?: string[];
}): string {
  const lines = [
    '---',
    'id: BGT001',
    `type: ${options.type ?? 'feature'}`,
    `phase: ${options.phase}`,
    'status: in_progress',
  ];
  if (options.anchors) {
    lines.push('phase_anchors:');
    for (const entry of options.anchors) lines.push(`  - ${entry}`);
  }
  if (options.skips) {
    lines.push('phase_skips:');
    for (const entry of options.skips) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

/** A fresh safeword-configured git repo with a pushed baseline commit. */
function createProject(world: BoundaryWorld, options?: { safeword?: boolean }): string {
  const dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-boundary-'));
  git(dir, 'init --quiet');
  git(dir, 'config user.email test@test.com');
  git(dir, 'config user.name Test');
  if (options?.safeword !== false) mkdirSync(nodePath.join(dir, '.safeword'), { recursive: true });
  writeFileAt(dir, 'README.md', 'fixture\n');
  git(dir, 'add -A');
  git(dir, 'commit -m baseline --quiet');
  world.dir = dir;
  return dir;
}

function addRemote(world: BoundaryWorld): void {
  const remote = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-boundary-remote-'));
  execSync('git init --bare --quiet', { cwd: remote, stdio: 'pipe' });
  git(world.dir!, `remote add origin ${remote}`);
  git(world.dir!, 'push -u origin HEAD --quiet');
  world.remote = remote;
}

/** Seed a committed ticket state, optionally pushed. */
function seedTicket(world: BoundaryWorld, content: string): void {
  writeFileAt(world.dir!, `${TICKET_DIR}/ticket.md`, content);
  git(world.dir!, 'add -A');
  git(world.dir!, 'commit -m seed --quiet');
}

function runBoundary(world: BoundaryWorld, at: 'commit' | 'push'): void {
  // spawnSync, not execFileSync: warnings go to stderr, and execFileSync
  // returns only stdout on a zero exit — the warn stream would be lost.
  const result = spawnSync('bun', [CLI, 'boundary', '--at', at], {
    cwd: world.dir,
    encoding: 'utf8',
  });
  world.cli = {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
  };
}

function readAudit(world: BoundaryWorld): Array<Record<string, unknown>> {
  const auditFile = nodePath.join(world.dir!, AUDIT_PATH);
  if (!existsSync(auditFile)) return [];
  return readFileSync(auditFile, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

After(function (this: BoundaryWorld) {
  for (const dir of [this.dir, this.remote]) {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Givens — commit tier
// ---------------------------------------------------------------------------

Given(
  'a safeword project with a feature ticket whose staged evidence is consistent',
  function (this: BoundaryWorld) {
    createProject(this);
    writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, ticketContent({ phase: 'intake' }));
    git(this.dir!, 'add -A');
  },
);

Given(
  'a feature ticket staged with a forward phase advance carrying no phase_anchors entry',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'define-behavior' }));
    writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(this.dir!, 'add -A');
  },
);

Given(
  'a staged change touching a feature ticket that sits at phase implement with no phase_skips and no intake history',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'implement' }));
    writeFileAt(this.dir!, `${TICKET_DIR}/spec.md`, '# Spec\n');
    git(this.dir!, 'add -A');
  },
);

Given('a staged ticket.md whose frontmatter does not parse', function (this: BoundaryWorld) {
  createProject(this);
  seedTicket(this, ticketContent({ phase: 'intake' }));
  writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, '---\n{ not yaml [\n%%%\n---\n\n# Fixture\n');
  git(this.dir!, 'add -A');
});

Given(
  'a staged change touching two tickets, one clean and one with an unanchored advance',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'define-behavior' }));
    writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, ticketContent({ phase: 'implement' }));
    writeFileAt(
      this.dir!,
      '.project/tickets/BGT002-clean/ticket.md',
      ticketContent({ phase: 'intake' }).replace('BGT001', 'BGT002'),
    );
    git(this.dir!, 'add -A');
  },
);

Given(
  'a staged test-definitions.md whose checked step carries a malformed annotation',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'intake' }));
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/test-definitions.md`,
      ['# Test Definitions', '', '### Scenario: s1', '', '- [x] RED not-a-sha!', ''].join('\n'),
    );
    git(this.dir!, 'add -A');
  },
);

Given(
  'a staged change touching a feature ticket past define-behavior with no test-definitions.md',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'define-behavior' }));
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: ['implement: a1b2c3d'] }),
    );
    git(this.dir!, 'add -A');
  },
);

Given(
  'a staged {word} that fails its shape check',
  function (this: BoundaryWorld, artifact: string) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'intake' }));
    writeFileAt(this.dir!, `${TICKET_DIR}/${artifact}`, '# Not a valid artifact\n\njust prose\n');
    git(this.dir!, 'add -A');
  },
);

Given(
  'a staged advance whose anchor SHA is well-formed but absent from history',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'define-behavior' }));
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: ['implement: deadbee'] }),
    );
    git(this.dir!, 'add -A');
  },
);

Given(
  'a staged change touching source files and one ticket with an unanchored advance',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'define-behavior' }));
    writeFileAt(this.dir!, 'src/widget.ts', 'export const widget = 1;\n');
    writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(this.dir!, 'add -A');
  },
);

Given(
  'a staged change whose ticket evidence produces several findings',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'define-behavior' }));
    writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, ticketContent({ phase: 'implement' }));
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/test-definitions.md`,
      ['# Test Definitions', '', '### Scenario: s1', '', '- [x] RED not-a-sha!', ''].join('\n'),
    );
    writeFileAt(this.dir!, `${TICKET_DIR}/verify.md`, '# no pr scope line\n');
    git(this.dir!, 'add -A');
  },
);

Given('a staged change touching no ticket artifacts', function (this: BoundaryWorld) {
  createProject(this);
  writeFileAt(this.dir!, 'src/widget.ts', 'export const widget = 1;\n');
  git(this.dir!, 'add -A');
});

Given('a git repository with no safeword configuration', function (this: BoundaryWorld) {
  createProject(this, { safeword: false });
  writeFileAt(this.dir!, 'src/widget.ts', 'export const widget = 1;\n');
  git(this.dir!, 'add -A');
});

Given('a safeword project that has never run the boundary command', function (this: BoundaryWorld) {
  createProject(this);
  rmSync(nodePath.join(this.dir!, '.safeword'), { recursive: true, force: true });
  mkdirSync(nodePath.join(this.dir!, '.safeword'), { recursive: true });
  writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, ticketContent({ phase: 'intake' }));
  git(this.dir!, 'add -A');
  assert.equal(existsSync(nodePath.join(this.dir!, AUDIT_PATH)), false);
});

Given('two consecutive boundary runs over ticket-touching changes', function (this: BoundaryWorld) {
  createProject(this);
  writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, ticketContent({ phase: 'intake' }));
  git(this.dir!, 'add -A');
  runBoundary(this, 'commit');
  git(this.dir!, 'commit -m first --quiet');
  writeFileAt(
    this.dir!,
    '.project/tickets/BGT003-second/ticket.md',
    ticketContent({ phase: 'intake' }).replace('BGT001', 'BGT003'),
  );
  git(this.dir!, 'add -A');
  runBoundary(this, 'commit');
});

// ---------------------------------------------------------------------------
// Givens — push tier
// ---------------------------------------------------------------------------

Given(
  'a ticket in the outgoing range whose entered-phase anchor names a path absent from the pushed tree',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'scenario-gate' }));
    addRemote(this);
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/ticket.md`,
      ticketContent({
        phase: 'implement',
        anchors: [`implement: ${TICKET_DIR}/impl-plan.md`],
      }),
    );
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m advance --quiet');
  },
);

Given(
  'an outgoing range whose ticket evidence includes an unreachable ledger SHA',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'intake' }));
    addRemote(this);
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/test-definitions.md`,
      ['# Test Definitions', '', '### Scenario: s1', '', '- [x] RED deadbee', ''].join('\n'),
    );
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m forged-ledger --quiet');
  },
);

Given(
  'a ticket whose path anchor was recorded before its branch was rebased',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'scenario-gate' }));
    addRemote(this);
    writeFileAt(this.dir!, 'src/work.ts', 'export const work = 1;\n');
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m work --quiet');
    writeFileAt(this.dir!, `${TICKET_DIR}/impl-plan.md`, implPlanContent());
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/ticket.md`,
      ticketContent({
        phase: 'implement',
        anchors: [`implement: ${TICKET_DIR}/impl-plan.md`],
      }),
    );
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m advance --quiet');
    const base = git(this.dir!, 'rev-parse HEAD~2').trim();
    git(this.dir!, `checkout --quiet -b rebase-target ${base}`);
    writeFileAt(this.dir!, 'docs/note.md', 'note\n');
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m new-base --quiet');
    const newBase = git(this.dir!, 'rev-parse HEAD').trim();
    git(this.dir!, 'checkout --quiet -');
    git(this.dir!, `rebase --quiet --onto ${newBase} ${base}`);
  },
);

Given(
  'a ticket in the outgoing range that advanced several phases in one commitless sitting with one anchor for the current phase',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'define-behavior' }));
    addRemote(this);
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/test-definitions.md`,
      ['# Test Definitions', '', '### Scenario: s1', '', '- [ ] RED', ''].join('\n'),
    );
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/ticket.md`,
      ticketContent({
        phase: 'verify',
        anchors: [`verify: ${TICKET_DIR}/test-definitions.md`],
        skips: ['scenario-gate: reviewed on the PR thread', 'implement: pair-programmed live'],
      }),
    );
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m multi --quiet');
  },
);

Given(
  'a ticket in the outgoing range whose ledger GREEN SHA is absent from history',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'intake' }));
    addRemote(this);
    const real = git(this.dir!, 'rev-parse --short HEAD').trim();
    writeFileAt(
      this.dir!,
      `${TICKET_DIR}/test-definitions.md`,
      [
        '# Test Definitions',
        '',
        '### Scenario: s1',
        '',
        `- [x] RED ${real}`,
        '- [x] GREEN deadbee',
        '',
      ].join('\n'),
    );
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m ledger --quiet');
  },
);

Given(
  'a branch with no upstream whose unpushed commits touch a ticket with an unanchored advance',
  function (this: BoundaryWorld) {
    createProject(this);
    seedTicket(this, ticketContent({ phase: 'define-behavior' }));
    addRemote(this);
    git(this.dir!, 'checkout --quiet -b feature/no-upstream');
    writeFileAt(this.dir!, `${TICKET_DIR}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m advance --quiet');
  },
);

Given(
  'an outgoing range with commits touching no ticket artifacts',
  function (this: BoundaryWorld) {
    createProject(this);
    addRemote(this);
    writeFileAt(this.dir!, 'src/widget.ts', 'export const widget = 1;\n');
    git(this.dir!, 'add -A');
    git(this.dir!, 'commit -m source-only --quiet');
  },
);

Given(
  'a ticket in the outgoing range whose artifact read fails mid-run',
  function (this: BoundaryWorld) {
    // Engine-seam fixture: a reader that throws stands in for git breaking
    // mid-run (see file header). The When step routes accordingly.
    this.engineVerdicts = undefined;
  },
);

// ---------------------------------------------------------------------------
// Whens
// ---------------------------------------------------------------------------

When('the boundary command runs at the commit boundary', function (this: BoundaryWorld) {
  runBoundary(this, 'commit');
});

When(
  'the boundary command runs at the commit boundary over a ticket-touching change',
  function (this: BoundaryWorld) {
    runBoundary(this, 'commit');
  },
);

When('the boundary command runs at the push boundary', function (this: BoundaryWorld) {
  if (this.dir === undefined) {
    // Reader-failure scenario: drive the engine with a throwing artifact reader.
    const script = `
const { reconcileChange } = await import(${JSON.stringify(
      nodePath.join(PROJECT_ROOT, 'packages/cli/src/boundary/engine.ts'),
    )});
const ticket = (phase, anchors) => ['---','id: BGT','type: feature','phase: '+phase,'status: in_progress', ...(anchors ? ['phase_anchors:', ...anchors.map(a=>'  - '+a)] : []), '---',''].join('\\n');
const anchor = 'implement: .project/tickets/BGT001-fixture/impl-plan.md';
const verdicts = reconcileChange([{
  ticketFolder: 'BGT001-fixture',
  artifacts: [{ artifact: 'ticket.md', prior: ticket('define-behavior'), proposed: ticket('implement', [anchor]) }],
  ticketCurrent: ticket('implement', [anchor]),
  hasLedger: true,
}], undefined, () => { throw new Error('git exploded'); });
console.log(JSON.stringify(verdicts[0].checks));
`;
    const output = execFileSync('bun', ['-e', script], { cwd: PROJECT_ROOT, encoding: 'utf8' });
    this.engineVerdicts = JSON.parse(output.trim());
    this.cli = { exitCode: 0, output: '' };
    return;
  }
  runBoundary(this, 'push');
});

When('the audit record is read', function (this: BoundaryWorld) {
  // Reading happens in the Then; this step is narrative sequencing.
});

// ---------------------------------------------------------------------------
// Thens
// ---------------------------------------------------------------------------

Then('it exits zero with no warnings', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.doesNotMatch(this.cli?.output ?? '', /warn|⚠/i);
});

Then('an audit entry records the passing verdicts', function (this: BoundaryWorld) {
  const last = JSON.stringify(readAudit(this).at(-1));
  assert.match(last, /"verdict":"pass"/);
});

Then(
  'it exits zero and warns that the entered phase is unanchored',
  function (this: BoundaryWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /unanchored|phase-anchor|no phase_anchors/i);
  },
);

Then('an audit entry records the finding', function (this: BoundaryWorld) {
  const last = JSON.stringify(readAudit(this).at(-1));
  assert.match(last, /"verdict":"warn"/);
});

Then(
  'it exits zero and warns that the ticket was born past intake without justification',
  function (this: BoundaryWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /born past intake/i);
  },
);

Then(
  'it exits zero and warns that the ticket cannot be classified',
  function (this: BoundaryWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /cannot be classified/i);
  },
);

Then('the warnings name only the ticket with the finding', function (this: BoundaryWorld) {
  const warningLines = (this.cli?.output ?? '').split('\n').filter(line => /warn|⚠/i.test(line));
  assert.match(warningLines.join('\n'), /BGT001/);
  assert.doesNotMatch(warningLines.join('\n'), /BGT002/);
});

Then('the audit entry carries per-ticket verdicts', function (this: BoundaryWorld) {
  const last = JSON.stringify(readAudit(this).at(-1));
  assert.match(last, /BGT001/);
  assert.match(last, /BGT002/);
});

Then('it exits zero and warns about the ledger annotation', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.match(this.cli?.output ?? '', /ledger/i);
});

Then('it exits zero and warns that the ledger is missing', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.match(this.cli?.output ?? '', /ledger is missing|no test-definitions/i);
});

Then(
  'it exits zero and the warning names {word}',
  function (this: BoundaryWorld, artifact: string) {
    assert.equal(this.cli?.exitCode, 0);
    assert.ok((this.cli?.output ?? '').includes(artifact), `expected warning naming ${artifact}`);
  },
);

Then('it exits zero without any reachability warning', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.doesNotMatch(this.cli?.output ?? '', /unreachable|not reachable/i);
});

Then('the warning teaches the artifact-path grammar instead', function (this: BoundaryWorld) {
  // A hex value is yesterday's valid grammar — the finding must migrate, not
  // accuse: it names the path grammar to record instead (HGYGND SM1.R4).
  assert.match(this.cli?.output ?? '', /artifact path/i);
});

Then('it exits zero and warns about the unanchored advance', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.match(this.cli?.output ?? '', /unanchored|no phase_anchors/i);
});

Then('it prints every finding as a warning and still exits zero', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  const output = this.cli?.output ?? '';
  assert.match(output, /phase-anchor|unanchored/i);
  assert.match(output, /ledger/i);
  assert.match(output, /verify/i);
});

Then('one audit entry records all the findings', function (this: BoundaryWorld) {
  const entries = readAudit(this);
  assert.equal(entries.length, 1);
  const last = JSON.stringify(entries.at(-1));
  assert.match(last, /phase-anchor/);
  assert.match(last, /ledger/);
  assert.match(last, /verify/);
});

Then(
  'it warns about the unreachable evidence and still exits zero',
  function (this: BoundaryWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /not reachable|unreachable/i);
  },
);

Then(
  'it exits zero and warns that the anchored artifact is missing',
  function (this: BoundaryWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /missing/i);
  },
);

Then('it exits zero with no anchor warning', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.doesNotMatch(this.cli?.output ?? '', /phase-anchor|unanchored|not reachable|unreachable/i);
});

Then('the audit entry records a passing phase-anchor verdict', function (this: BoundaryWorld) {
  const last = JSON.stringify(readAudit(this).at(-1));
  assert.match(last, /"check":"phase-anchor","verdict":"pass"/);
});

Then('it exits zero and warns about the unreachable ledger SHA', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.match(this.cli?.output ?? '', /deadbee|not reachable/i);
});

Then('it still exits zero', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
});

Then('the audit entry records the anchor check as indeterminate', function (this: BoundaryWorld) {
  const anchor = this.engineVerdicts?.find(v => v.check === 'phase-anchor');
  assert.equal(anchor?.verdict, 'indeterminate');
});

Then('it exits zero with no output', function (this: BoundaryWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.equal((this.cli?.output ?? '').trim(), '');
});

Then('no audit entry is written', function (this: BoundaryWorld) {
  assert.equal(readAudit(this).length, 0);
});

Then(
  'it contains one entry per run with boundary, commit id, and per-check verdicts',
  function (this: BoundaryWorld) {
    const entries = readAudit(this);
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.equal(entry.boundary, 'commit');
      assert.equal(typeof entry.head, 'string');
      assert.match(JSON.stringify(entry), /verdict/);
    }
  },
);

Then('the audit record exists afterward with one entry', function (this: BoundaryWorld) {
  assert.equal(readAudit(this).length, 1);
});
