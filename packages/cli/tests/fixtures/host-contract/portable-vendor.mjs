#!/usr/bin/env bun
// Substituted vendor subprocess records only; never native proof or policy results.
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';

const codex = path.basename(process.argv[1]).includes('codex');
const mode = () => readFileSync(process.env.PORTABLE_TEST_MODE, 'utf8');
if (process.argv.includes('--version')) {
  console.log(codex ? 'codex-cli 0.167.0' : '2026.11.05-86047df');
} else if (process.argv.includes('marketplace')) {
  console.log('{}');
} else if (process.argv.includes('plugin') && process.argv.includes('add')) {
  const installedPath = path.join(process.env.CODEX_HOME, 'plugins/cache/probe');
  mkdirSync(path.dirname(installedPath), { recursive: true });
  cpSync(path.join(path.dirname(process.env.CODEX_HOME), 'marketplace/plugin'), installedPath, {
    recursive: true,
  });
  console.log(JSON.stringify({ installedPath }));
} else if (process.argv.includes('app-server')) {
  const lines = createInterface({ input: process.stdin });
  for await (const line of lines) {
    const request = JSON.parse(line);
    if (request.id === 1) console.log(JSON.stringify({ id: 1, result: {} }));
    if (request.id !== 2) continue;
    const root = path.join(path.dirname(process.env.CODEX_HOME), 'marketplace/plugin');
    const metadata =
      mode() === 'overlay'
        ? JSON.parse(readFileSync(path.join(root, '.codex-plugin/plugin.json'), 'utf8')).interface
        : JSON.parse(readFileSync(path.join(root, 'plugin.json'), 'utf8')).extensions['com.openai']
            .interface;
    if (mode() === 'rpc-error')
      console.log(JSON.stringify({ id: 2, error: { message: 'fixture transport error' } }));
    else
      console.log(
        JSON.stringify({
          id: 2,
          result: {
            plugin: { summary: { interface: mode() === 'missing-observation' ? {} : metadata } },
          },
        }),
      );
  }
} else {
  const root = codex
    ? path.join(process.env.CODEX_HOME, 'plugins/cache/probe')
    : process.argv[process.argv.indexOf('--plugin-dir') + 1];
  const workflow = readFileSync(path.join(root, 'skills/explain/SKILL.md'), 'utf8');
  const reference = /\[the packaged guide\]\(([^)]+)\)/u.exec(workflow)?.[1];
  if (!reference) throw new Error('fixture workflow has no declared guide');
  const guide = readFileSync(path.resolve(root, 'skills/explain', reference), 'utf8');
  if (codex) {
    writeFileSync(
      process.argv[process.argv.indexOf('-o') + 1],
      mode() === 'missing-model' ? 'No resource report' : workflow + guide,
    );
  } else {
    const runtime =
      mode() === 'foreign-helper'
        ? '/unexecuted-foreign/runtime/cli.js'
        : path.join(root, 'runtime/cli.js');
    const args = [
      runtime,
      'project',
      'runtime',
      'audit-principle-trace',
      '--cwd',
      process.cwd(),
      '--',
    ];
    const result =
      mode() === 'foreign-helper'
        ? { stdout: 'foreign helper', status: 0 }
        : spawnSync('bun', args, { encoding: 'utf8' });
    const command = `bun '${runtime}' project runtime audit-principle-trace --cwd '${process.cwd()}' --`;
    console.log(JSON.stringify({ type: 'assistant', text: workflow + guide }));
    console.log(
      JSON.stringify({
        type: 'tool_call',
        subtype: 'completed',
        tool_call: {
          shellToolCall: {
            args: {
              command,
              parsingResult: { executableCommands: [{ name: 'bun', fullText: command }] },
            },
            result: { success: { exitCode: result.status, stdout: result.stdout } },
          },
        },
      }),
    );
  }
}
