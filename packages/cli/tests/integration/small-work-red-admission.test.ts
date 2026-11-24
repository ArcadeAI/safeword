import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderInitialSmallWorkChecklist } from '../../src/execution-plan/delivery-checklist.js';
import {
  consequentialDecisions,
  readSmallWorkFacts,
  replaceSmallWorkFacts,
} from '../../templates/hooks/lib/small-work-classification.js';
import {
  createTemporaryDirectory,
  expectHookAllow,
  expectHookDeny,
  removeTemporaryDirectory,
  runCli,
  spawnHookScript,
  ticketFolderBySlug,
  ticketIdBySlug,
} from '../helpers.js';

describe('installed small-work RED admission', () => {
  const slug = 'retry-after-timeout';
  const session = 'small-work-red';
  let fixture: string;

  beforeEach(() => {
    fixture = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(fixture);
  });

  function exerciseInstalledEdits(route: 'missing-red' | 'patch' | 'product-behavior') {
    const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
    const setup = nodePath.resolve(
      import.meta.dirname,
      '../fixtures/small-work-hosts/response-contract.ts',
    );
    const output = execFileSync('bun', [setup, cli], { cwd: fixture, encoding: 'utf8' });
    const {
      root: project,
      ticket,
      ticket_id: ticketId,
    } = JSON.parse(output) as {
      root: string;
      ticket: string;
      ticket_id: string;
    };
    try {
      const ticketPath = nodePath.join(project, ticket);
      const filePath = nodePath.join(project, 'src/status.ts');
      const before = readFileSync(filePath, 'utf8');
      const after =
        route === 'patch'
          ? before.replace(';', '; // Existing readiness response.')
          : before.replace('ready: true', 'ready: false');
      const original = readFileSync(ticketPath, 'utf8');
      const facts = readSmallWorkFacts(original) as { decisions: Record<string, string> };
      if (route === 'patch') {
        writeFileSync(
          ticketPath,
          replaceSmallWorkFacts(original.replace(/^type: task$/m, 'type: patch'), {
            ...facts,
            changesBehavior: false,
            verification: 'targeted',
          }),
        );
      } else if (route === 'product-behavior') {
        const revised = { ...facts, decisions: { ...facts.decisions, behavior: 'unresolved' } };
        const promotedInput = replaceSmallWorkFacts(original, revised);
        writeFileSync(ticketPath, `${promotedInput}\nInvestigation: preserve this observation.\n`);
      }
      const env = { ...process.env, CLAUDE_PROJECT_DIR: project };
      const hook = (host: 'claude' | 'codex', post: boolean) => {
        const event = post ? 'PostToolUse' : 'PreToolUse';
        const tool =
          host === 'claude'
            ? {
                tool_name: 'Write',
                tool_input: {
                  file_path: post ? ticketPath : filePath,
                  content: post ? readFileSync(ticketPath, 'utf8') : after,
                },
              }
            : {
                tool_name: 'apply_patch',
                tool_input: {
                  command: post
                    ? `*** Begin Patch\n*** Update File: ${ticket}\n@@\n-# Rename the status response field\n+# Retry task\n*** End Patch`
                    : `*** Begin Patch\n*** Update File: src/status.ts\n@@\n-${before.trimEnd()}\n+${after.trimEnd()}\n*** End Patch`,
                },
              };
        const args =
          host === 'claude'
            ? [
                nodePath.join(
                  project,
                  '.safeword/hooks',
                  post ? 'post-tool-quality.ts' : 'pre-tool-quality.ts',
                ),
              ]
            : [
                nodePath.resolve(import.meta.dirname, '../../codex-plugin/runtime/cli.js'),
                'hook',
                'codex',
                post ? 'post-tool-use' : 'pre-tool-use',
                '--plugin-hook',
              ];
        const result = spawnSync('bun', args, {
          cwd: project,
          encoding: 'utf8',
          env,
          input: JSON.stringify({
            cwd: project,
            session_id: `missing-red-${host}`,
            hook_event_name: event,
            ...tool,
          }),
          timeout: 15_000,
        });
        expect(result.status, result.stderr).toBe(0);
        return result;
      };
      const preparedTicket = readFileSync(ticketPath, 'utf8');
      if (route === 'patch') {
        const configPath = nodePath.join(project, '.safeword', 'config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        writeFileSync(
          configPath,
          JSON.stringify({ ...config, requireSmallWorkClassification: true }),
        );
      }
      return (['claude', 'codex'] as const).map(host => {
        if (route === 'patch') {
          unlinkSync(ticketPath);
          expectHookDeny(hook(host, false), 'Classify this work before changing production files');
        }
        writeFileSync(ticketPath, preparedTicket);
        if (route === 'missing-red') {
          expectHookDeny(hook(host, false), 'Attach this session to the ticket');
        }
        hook(host, true);
        const decision = hook(host, false);
        const status = readFileSync(ticketPath, 'utf8');
        const plans = readdirSync(nodePath.dirname(ticketPath)).filter(file =>
          file.endsWith('plan.md'),
        );
        expect(readFileSync(filePath, 'utf8')).toBe(before);
        expect(status).toContain(`id: ${ticketId}\n`);
        return { decision, status, plans };
      });
    } finally {
      removeTemporaryDirectory(project);
    }
  }

  it('denies native Claude and Codex production edits after ticket binding when RED is missing', () => {
    for (const { decision } of exerciseInstalledEdits('missing-red')) {
      expectHookDeny(decision, 'Record the observed failing test');
    }
  });

  it('allows a classified patch on Claude and Codex without feature planning', () => {
    for (const { decision, status, plans } of exerciseInstalledEdits('patch')) {
      expectHookAllow(decision);
      expect(status).toMatch(/^type: patch$/m);
      expect(status).toMatch(/^phase: intake$/m);
      expect(plans).toEqual([]);
    }
  });

  it('promotes unresolved product behavior on Claude and Codex before a source edit', () => {
    for (const { decision, status } of exerciseInstalledEdits('product-behavior')) {
      expectHookDeny(decision, 'Complete behavior definition and its scenario review');
      expect(status).toMatch(/^type: feature$/m);
      expect(status).toMatch(/^phase: define-behavior$/m);
      expect(status).toContain('Investigation: preserve this observation.');
      expect(status).not.toContain('small_work_pending_phase');
    }
  });

  it('requires the current observed failure and matching relevance before the first edit', async () => {
    const project = nodePath.join(fixture, 'project');
    mkdirSync(project);
    const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
    const environment = {
      NODE_ENV: 'test',
      SAFEWORD_PLUGIN_CLI: cli,
      SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(fixture, 'keys'),
      CLAUDE_PROJECT_DIR: project,
    };
    const run = (args: string[]) => runCli([...args, '--json'], { cwd: project, env: environment });
    const install = await run(['install', '--agents=cursor', '--no-modify', '--offline']);
    expect(install.exitCode, install.stderr).toBe(0);

    const entryPoint = 'src/retry.ts';
    const realTest = './tests/retry.test.ts';
    const unrelatedTest = './tests/unrelated.test.ts';
    const expectedFailure = 'expected two attempts';
    mkdirSync(nodePath.join(project, 'src'));
    mkdirSync(nodePath.join(project, 'tests'));
    writeFileSync(nodePath.join(project, entryPoint), 'export const attempts = () => 1;\n');
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('add', '.');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'before the test',
    );
    const baselineRevision = git('rev-parse', 'HEAD');
    writeFileSync(
      nodePath.join(project, realTest),
      `import { test } from 'bun:test';
import { attempts } from '../src/retry';
test('retry after timeout', () => {
  if (attempts() !== 2) throw new Error('${expectedFailure}');
});\n`,
    );
    writeFileSync(
      nodePath.join(project, unrelatedTest),
      `import { test } from 'bun:test';
test('unrelated', () => { throw new Error('${expectedFailure}'); });\n`,
    );

    const creation = await run(['ticket', 'new', slug, '--type', 'task', '--goal', 'Retry once']);
    expect(creation.exitCode, creation.stderr).toBe(0);
    const id = ticketIdBySlug(project, slug);
    const ticket = nodePath.join(ticketFolderBySlug(project, slug), 'ticket.md');
    const original = readFileSync(ticket, 'utf8');
    const contract = {
      schemaVersion: 1,
      scope: 'Private retry correction',
      outcome: 'Two attempts after a timeout',
      decisions: Object.fromEntries(consequentialDecisions.map(decision => [decision, 'settled'])),
      introducesUserFlow: false,
      multipleUserFlows: false,
      newPersistentState: false,
      changesSharedContract: false,
      changesBehavior: true,
      verification: 'new-regression',
    };
    const evaluation = {
      base: baselineRevision,
      fileLimit: 2,
      surfaceLimit: 1,
      aboveFileLimit: true,
      aboveSurfaceLimit: false,
      declaredSurfaces: ['CLI'],
      surfacePaths: [entryPoint, 'tests/retry.test.ts', 'tests/unrelated.test.ts'].map(path => ({
        path,
        surfaces: ['CLI'],
      })),
    };
    const writeFacts = (proof?: unknown) => {
      writeFileSync(
        ticket,
        `${original}\n## Safeword small-work facts\n\n\`\`\`json\n${JSON.stringify({
          ...contract,
          evaluation,
          proof,
        })}\n\`\`\`\n`,
      );
    };
    const editDecision = () => {
      const result = spawnSync('bun', ['.safeword/hooks/cursor/pre-tool-quality.ts'], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, ...environment },
        timeout: 15_000,
        input: JSON.stringify({
          conversation_id: session,
          workspace_roots: [project],
          tool_name: 'Write',
          tool_input: {
            file_path: nodePath.join(project, entryPoint),
            content: 'export const attempts = () => 2;\n',
          },
        }),
      });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as { permission: string; agent_message?: string };
    };
    const expectDenial = (reason: string) => {
      expect(editDecision()).toMatchObject({
        permission: 'deny',
        agent_message: expect.stringContaining(reason),
      });
    };
    const unlinkedEvidence = 'Connect the assertion and existing entry point';
    const staleEvidence = 'could not verify the current task test observation';
    const claudeDecision = (tool_name: string, tool_input: Record<string, string>) =>
      spawnHookScript(
        nodePath.resolve(import.meta.dirname, '../../templates/hooks/pre-tool-quality.ts'),
        project,
        { cwd: project, session_id: session, tool_name, tool_input },
      );
    const shellDecision = (command: string) => claudeDecision('Bash', { command });
    expect(editDecision()).toMatchObject({ permission: 'allow' });
    writeFacts();
    expectDenial('Attach this session to the ticket');
    expectHookDeny(
      shellDecision(`printf '%s' replacement > ${entryPoint}`),
      'Attach this session to the ticket',
    );
    expectHookAllow(shellDecision(`bun test ${realTest}`));
    expectHookAllow(
      claudeDecision('Write', {
        file_path: nodePath.join(project, realTest),
        content: 'test setup',
      }),
    );
    writeFileSync(
      nodePath.join(project, '.project', `quality-state-cursor-${session}.json`),
      JSON.stringify({
        activeTicket: id,
        locSinceCommit: 0,
        lastCommitHash: '',
        recentFailures: [],
        incrementedPatterns: [],
      }),
    );
    expectDenial('Record the observed failing test');
    writeFileSync(
      nodePath.join(project, '.project', `quality-state-${session}.json`),
      JSON.stringify({ activeTicket: id }),
    );
    expectHookDeny(
      shellDecision(`printf '%s' replacement > ${entryPoint}`),
      'Use the native file edit tool',
    );
    expectHookAllow(shellDecision(`bun test ${realTest}`));
    expectHookAllow(shellDecision(`cat ${entryPoint}`));
    expectHookAllow(shellDecision(`printf '%s' test > ${realTest}`));
    expectHookDeny(
      claudeDecision('Write', {
        file_path: nodePath.join(project, entryPoint),
        content: 'export const attempts = () => 2;\n',
      }),
      'failing',
    );

    const request = {
      ticket: id,
      contractDigest: createHash('sha256').update(JSON.stringify(contract)).digest('hex'),
      argv: ['bun', 'test', realTest],
      cwd: '.',
      target: realTest,
      entryPoint,
      baselineRevision,
      inputs: [],
      expectedFailure,
    };
    const observe = async (target: string) => {
      const result = await run([
        'ticket',
        'observe-small-work-proof',
        JSON.stringify({ ...request, target, argv: ['bun', 'test', target] }),
      ]);
      expect(result.exitCode, result.stderr || result.stdout).toBe(0);
      const payload = JSON.parse(result.stdout).data;
      expect(payload.observation.expectedFailureObserved).toBe(true);
      return payload.observation;
    };
    const record = (
      observation: { tag: string },
      options: {
        relevanceTag?: string;
        relevant?: boolean;
        testTarget?: string;
        request?: typeof request;
      } = {},
    ) => {
      writeFacts({
        request:
          options.testTarget === undefined
            ? (options.request ?? request)
            : { ...request, target: options.testTarget },
        observation,
        relevance: {
          observationTag: options.relevanceTag ?? observation.tag,
          relevant: options.relevant ?? true,
          explanation: 'The target calls the existing retry operation and expected two attempts.',
        },
      });
    };

    record(await observe(unrelatedTest));
    expectDenial(staleEvidence);
    const { contractDigest, ...fileRequest } = request;
    writeFileSync(
      nodePath.join(project, '.project', 'retry-proof.json'),
      JSON.stringify(fileRequest),
    );
    const fromFile = await run([
      'ticket',
      'observe-small-work-proof',
      '@.project/retry-proof.json',
    ]);
    expect(fromFile.exitCode, fromFile.stderr || fromFile.stdout).toBe(0);
    const { request: effectiveRequest, observation: intended } = JSON.parse(fromFile.stdout).data;
    expect(effectiveRequest).toEqual({ ...fileRequest, contractDigest });
    expect(intended.expectedFailureObserved).toBe(true);
    record(intended, { relevanceTag: 'f'.repeat(64) });
    expectDenial(unlinkedEvidence);
    record(intended, { relevant: false });
    expectDenial(unlinkedEvidence);
    record(intended, { testTarget: unrelatedTest });
    expectDenial(staleEvidence);
    const validTest = readFileSync(nodePath.join(project, realTest), 'utf8');
    writeFileSync(
      nodePath.join(project, realTest),
      `throw new Error('${expectedFailure}');\n${validTest}`,
    );
    record(await observe(realTest), { relevant: false });
    expectDenial(unlinkedEvidence);
    writeFileSync(nodePath.join(project, realTest), validTest);

    const invented = await run([
      'ticket',
      'observe-small-work-proof',
      JSON.stringify({ ...request, entryPoint: realTest }),
    ]);
    expect(invented.exitCode).toBe(1);

    record(intended, { request: effectiveRequest });
    const admitted = editDecision();
    expect(admitted.permission, admitted.agent_message).toBe('allow');

    const greenCommand = ['ticket', 'observe-small-work-green', id];
    const beforeGreen = readFileSync(ticket, 'utf8');
    const stillRed = await run(greenCommand);
    expect(stillRed.exitCode).not.toBe(0);
    expect(JSON.parse(stillRed.stdout).errors[0].message).toContain('did not pass');
    expect(readFileSync(ticket, 'utf8')).toBe(beforeGreen);

    writeFileSync(nodePath.join(project, entryPoint), 'export const attempts = () => 2;\n');
    const green = spawnSync('bun', ['test', realTest], { cwd: project, encoding: 'utf8' });
    expect(green.status, green.stderr).toBe(0);
    expect(editDecision().permission).toBe('allow');
    const saved = await run(greenCommand);
    expect(saved.exitCode, saved.stderr || saved.stdout).toBe(0);
    const output = JSON.parse(saved.stdout);
    expect(output.next_actions).toContainEqual(
      expect.objectContaining({
        command: expect.stringContaining(`safeword ticket delivery-checklist '${id}' --json`),
        mutates: false,
        requires_human: false,
      }),
    );
    const receipt = output.data.receipt;
    expect(receipt.redTag).toBe(intended.tag);
    const storedFacts = readSmallWorkFacts(readFileSync(ticket, 'utf8'));
    expect(storedFacts).toMatchObject({
      proof: { request: effectiveRequest, observation: intended, green: receipt },
    });
    const checkGreen = () => run([...greenCommand, '--check']);
    const current = await checkGreen();
    expect(JSON.parse(current.stdout).data).toMatchObject({ current: true });
    const checklist = ['ticket', 'delivery-checklist', id];
    const missingChecklist = await run(checklist);
    expect(JSON.parse(missingChecklist.stdout).findings).toContainEqual(
      expect.objectContaining({
        code: 'missing_delivery_checklist',
        message: expect.stringContaining('inline Delivery Checklist to ticket.md'),
      }),
    );
    const ticketWithGreen = readFileSync(ticket, 'utf8');
    writeFileSync(ticket, ticketWithGreen + renderInitialSmallWorkChecklist());
    const missingProof = {
      code: 'missing_proof_specifications',
      message: expect.stringContaining('ticket.md'),
    };
    const needsProof = await run(checklist);
    expect(JSON.parse(needsProof.stdout).findings).toContainEqual(
      expect.objectContaining(missingProof),
    );
    const recordProof = [
      'ticket',
      'record-delivery-proof',
      id,
      'verification',
      'targeted-verification',
    ];
    const needsSpecification = await run(recordProof);
    expect(JSON.parse(needsSpecification.stdout).findings).toContainEqual(
      expect.objectContaining(missingProof),
    );
    const testInvocation = JSON.stringify({
      type: 'command',
      cwd: effectiveRequest.cwd,
      argv: effectiveRequest.argv,
    });
    const delivery = [
      '## Proof specifications',
      '',
      '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| targeted-verification | command | integration | Retry helper through the saved RED and GREEN test | real_boundary | current_required | ${testInvocation} |`,
      renderInitialSmallWorkChecklist().trimEnd(),
      '| docs | documentation | Update public documentation | contributor | | not_applicable | missing | | No public contract changed. |',
      '| rollout | rollout and rollback | Approve distribution | human | | pending_human | missing | | Release owner approves distribution. |',
    ].join('\n');
    writeFileSync(ticket, `${ticketWithGreen}\n${delivery}\n`);
    git('add', '.');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'candidate for contributor handoff',
    );
    const beforeHandoff = await run(checklist);
    expect(JSON.parse(beforeHandoff.stdout).data).toMatchObject({
      open_contributor_items: ['verification'],
    });
    const attached = await run([
      'ticket',
      'record-delivery-proof',
      id,
      'verification',
      'targeted-verification',
    ]);
    expect(attached.exitCode, attached.stderr || attached.stdout).toBe(0);
    const handoff = await run(checklist);
    expect(handoff.exitCode, handoff.stderr || handoff.stdout).toBe(0);
    expect(JSON.parse(handoff.stdout).data).toMatchObject({
      readiness_state: 'ready_for_human_review',
      open_contributor_items: [],
      pending_human_items: ['rollout'],
      grants_merge_authority: false,
    });
    expect(readdirSync(nodePath.dirname(ticket))).toEqual(['ticket.md']);
    const afterHandoff = readSmallWorkFacts(readFileSync(ticket, 'utf8'));
    expect(afterHandoff).toMatchObject({ proof: { observation: intended, green: receipt } });

    writeFileSync(nodePath.join(project, entryPoint), 'export const attempts = () => 3;\n');
    const stale = await checkGreen();
    expect(stale.exitCode).not.toBe(0);
    expect(JSON.parse(stale.stdout).data).toMatchObject({ current: false });
    writeFileSync(nodePath.join(project, entryPoint), 'export const attempts = () => 2;\n');
    writeFileSync(nodePath.join(project, realTest), '// changed after the observed run\n');
    const changedTest = await checkGreen();
    expect(JSON.parse(changedTest.stdout).data).toMatchObject({ current: false });
    expectDenial(staleEvidence);
  }, 60_000);
});
