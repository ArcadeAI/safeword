import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildColdStartPrompt } from '../scripts/lib/data-architecture-eval.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const scriptPath = nodePath.join(packageRoot, 'scripts/data-architecture-eval.ts');

describe('data architecture evaluation CLI', () => {
  it('rejects guide and corpus flags placed inside adapter argv', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'data-architecture-eval-'));
    try {
      const guidePath = nodePath.join(directory, 'guide.md');
      const corpusDirectory = nodePath.join(directory, 'corpus');
      writeFileSync(guidePath, '# Guide\n');
      mkdirSync(corpusDirectory);
      writeFileSync(nodePath.join(corpusDirectory, 'cases.json'), '[]');
      writeFileSync(
        nodePath.join(corpusDirectory, 'contract.json'),
        JSON.stringify({
          modelVersion: 'fixture-adapter-v1',
          decodingConfiguration: { temperature: 0 },
          responseFormat: 'data-architecture-eval-v1',
          rubricLoader: 'data-architecture-rubric-v1',
          toolsDisabled: true,
        }),
      );

      const result = spawnSync(
        'bun',
        [
          scriptPath,
          'record',
          '--adapter',
          process.execPath,
          '--guide',
          guidePath,
          '--corpus',
          corpusDirectory,
        ],
        { cwd: packageRoot, encoding: 'utf8' },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('--guide must appear before --adapter.');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('records through an isolated adapter and deterministically verifies the written corpus', () => {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'data-architecture-eval-'));
    try {
      const guidePath = nodePath.join(directory, 'guide.md');
      const corpusDirectory = nodePath.join(directory, 'corpus');
      const adapterPath = nodePath.join(directory, 'adapter.mjs');
      const capturePath = nodePath.join(directory, 'adapter-capture.json');
      const guide = [
        '# Guide',
        '[decision.test]',
        '<!-- data-architecture-ablation:test:start -->',
        '[proof.test]',
        '<!-- data-architecture-ablation:test:end -->',
        '',
      ].join('\n');
      const evaluationCase = {
        id: 'test-case',
        text: 'Plan SYNTHETIC_TEST_VALUE.',
        rubric: {
          expectedDecisionIds: ['decision.test'],
          forbiddenDecisionIds: [],
          expectedProofFactIds: ['proof.test'],
          forbiddenProofFactIds: [],
        },
      };
      writeFileSync(guidePath, guide);
      writeFileSync(
        adapterPath,
        "import{readdirSync,writeFileSync}from'node:fs';let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{const full=input.includes('[proof.test]');if(full)writeFileSync(process.argv[2],JSON.stringify({cwd:process.cwd(),entries:readdirSync('.'),input}));process.stdout.write(JSON.stringify({decisionIds:['decision.test'],proofFactIds:full?['proof.test']:[]}));});\n",
      );
      mkdirSync(corpusDirectory);
      writeFileSync(nodePath.join(corpusDirectory, 'cases.json'), JSON.stringify([evaluationCase]));
      writeFileSync(
        nodePath.join(corpusDirectory, 'contract.json'),
        JSON.stringify({
          modelVersion: 'fixture-adapter-v1',
          decodingConfiguration: { temperature: 0 },
          responseFormat: 'data-architecture-eval-v1',
          rubricLoader: 'data-architecture-rubric-v1',
          toolsDisabled: true,
          ablation: {
            id: 'test',
            caseId: 'test-case',
            preservedDecisionIds: ['decision.test'],
            attributableDecisionIds: [],
            attributableProofFactIds: ['proof.test'],
          },
        }),
      );

      const record = spawnSync(
        'bun',
        [
          scriptPath,
          'record',
          '--guide',
          guidePath,
          '--corpus',
          corpusDirectory,
          '--adapter',
          process.execPath,
          adapterPath,
          capturePath,
        ],
        { cwd: packageRoot, encoding: 'utf8' },
      );
      expect(record.status, record.stderr).toBe(0);
      const records = JSON.parse(
        readFileSync(nodePath.join(corpusDirectory, 'records.json'), 'utf8'),
      );
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        caseId: 'test-case',
        guideSha256: createHash('sha256').update(guide).digest('hex'),
        modelVersion: 'fixture-adapter-v1',
        decodingConfiguration: { temperature: 0 },
        responseFormat: 'data-architecture-eval-v1',
        rubricLoader: 'data-architecture-rubric-v1',
        prompt: buildColdStartPrompt(guide, evaluationCase),
        coldStartPromptSha256: createHash('sha256')
          .update(buildColdStartPrompt(guide, evaluationCase))
          .digest('hex'),
        response: { decisionIds: ['decision.test'], proofFactIds: ['proof.test'] },
      });
      expect(records[0].caseAndRubricSha256).toMatch(/^[a-f0-9]{64}$/u);
      const ablationRecord = JSON.parse(
        readFileSync(nodePath.join(corpusDirectory, 'ablation-record.json'), 'utf8'),
      );
      expect(ablationRecord).toMatchObject({
        ablationId: 'test',
        caseId: 'test-case',
        record: {
          modelVersion: 'fixture-adapter-v1',
          response: { decisionIds: ['decision.test'], proofFactIds: [] },
        },
      });
      const capture = JSON.parse(readFileSync(capturePath, 'utf8'));
      expect(capture.input).toBe(buildColdStartPrompt(guide, evaluationCase));
      expect(capture.cwd).not.toBe(packageRoot);
      expect(capture.entries).toEqual([]);

      const verify = spawnSync(
        'bun',
        [scriptPath, 'verify', '--guide', guidePath, '--corpus', corpusDirectory],
        { cwd: packageRoot, encoding: 'utf8' },
      );
      expect(verify.status, verify.stderr).toBe(0);
      expect(verify.stdout).toContain(
        'Verified 1 data architecture evaluation record and 1 ablation record.',
      );

      writeFileSync(guidePath, `${guide}\nDRIFT`);
      const rejected = spawnSync(
        'bun',
        [scriptPath, 'verify', '--guide', guidePath, '--corpus', corpusDirectory],
        { cwd: packageRoot, encoding: 'utf8' },
      );
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain(
        'Evaluation record guide hash does not match the current canonical guide.',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
