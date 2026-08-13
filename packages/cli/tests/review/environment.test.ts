import { describe, expect, it } from 'vitest';

import { reviewerEnvironment, reviewerProbeEnvironment } from '../../src/review/environment.js';

describe('reviewer-scoped environment', () => {
  it('excludes the wrapper-only managed-progress signal from the reviewer allowlist', () => {
    expect(
      reviewerEnvironment('claude', {
        SAFEWORD_REVIEW_PROGRESS: '1',
        SAFEWORD_REVIEW_TIMEOUT_MS: '1000',
      }),
    ).toEqual({ SAFEWORD_REVIEW_TIMEOUT_MS: '1000' });
  });

  it('does not expose unknown review-prefixed variables in production', () => {
    const originalNodeEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(
        reviewerEnvironment('claude', {
          SAFEWORD_REVIEW_CUSTOM_SECRET: 'hidden',
          SAFEWORD_REVIEW_FAKE_VERDICT: 'request_changes',
          SAFEWORD_REVIEW_TIMEOUT_MS: '1000',
        }),
      ).toEqual({ SAFEWORD_REVIEW_TIMEOUT_MS: '1000' });
    } finally {
      if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnvironment;
    }
  });

  it('keeps vendor credentials out of capability probes', () => {
    expect(
      reviewerProbeEnvironment({
        PATH: '/bin',
        ANTHROPIC_API_KEY: 'anthropic',
        OPENAI_API_KEY: 'openai',
        SAFEWORD_REVIEW_TIMEOUT_MS: '1000',
      }),
    ).toEqual({ PATH: '/bin', SAFEWORD_REVIEW_TIMEOUT_MS: '1000' });
  });

  it('passes only process essentials, reviewer credentials, and coordinator controls', () => {
    const environment = reviewerEnvironment('claude', {
      PATH: '/bin',
      HOME: '/home/reviewer',
      ANTHROPIC_API_KEY: 'anthropic',
      OPENAI_API_KEY: 'openai',
      DATABASE_URL: 'postgres://secret',
      GITHUB_TOKEN: 'github-secret',
      SAFEWORD_REVIEW_TIMEOUT_MS: '1000',
      PWD: '/private/source',
    });

    expect(environment).toEqual({
      PATH: '/bin',
      HOME: '/home/reviewer',
      ANTHROPIC_API_KEY: 'anthropic',
      SAFEWORD_REVIEW_TIMEOUT_MS: '1000',
    });
  });

  it('keeps Codex credentials isolated from Claude credentials', () => {
    const environment = reviewerEnvironment('codex', {
      OPENAI_API_KEY: 'openai',
      CODEX_HOME: '/codex',
      CLAUDE_CODE_OAUTH_TOKEN: 'claude-oauth',
    });

    expect(environment).toEqual({ OPENAI_API_KEY: 'openai', CODEX_HOME: '/codex' });
  });

  it('matches Windows process keys without changing their original casing', () => {
    const environment = reviewerEnvironment(
      'codex',
      {
        Path: String.raw`C:\bin`,
        Temp: String.raw`C:\temp`,
        SystemRoot: String.raw`C:\Windows`,
        ComSpec: String.raw`C:\Windows\System32\cmd.exe`,
        USERPROFILE: String.raw`C:\Users\reviewer`,
        http_proxy: 'https://proxy.example',
        Safeword_Review_Timeout_Ms: '1000',
        Safeword_Review_Progress: '1',
      },
      'win32',
    );

    expect(environment).toEqual({
      Path: String.raw`C:\bin`,
      Temp: String.raw`C:\temp`,
      SystemRoot: String.raw`C:\Windows`,
      ComSpec: String.raw`C:\Windows\System32\cmd.exe`,
      USERPROFILE: String.raw`C:\Users\reviewer`,
      http_proxy: 'https://proxy.example',
      Safeword_Review_Timeout_Ms: '1000',
    });
  });
});
