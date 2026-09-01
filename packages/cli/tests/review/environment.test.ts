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

  it('admits only the named acceptance-fixture controls in test mode', () => {
    expect(
      reviewerEnvironment('claude', {
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_BDD_EXPECTED_MODEL: 'sonnet',
        SAFEWORD_REVIEW_COVERAGE_VERDICT: 'request_changes',
        SAFEWORD_REVIEW_DESCENDANT_PID_FILE: '/tmp/descendant.pid',
        SAFEWORD_REVIEW_LAUNCH_LOG: '/tmp/reviewer-launches.log',
        SAFEWORD_REVIEW_UNKNOWN_FIXTURE: 'hidden',
      }),
    ).toEqual({
      SAFEWORD_REVIEW_BDD_EXPECTED_MODEL: 'sonnet',
      SAFEWORD_REVIEW_COVERAGE_VERDICT: 'request_changes',
      SAFEWORD_REVIEW_DESCENDANT_PID_FILE: '/tmp/descendant.pid',
      SAFEWORD_REVIEW_LAUNCH_LOG: '/tmp/reviewer-launches.log',
    });
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

  it('gives OpenCode only its vendor inputs and a deny-by-default execution profile', () => {
    const environment = reviewerEnvironment('opencode', {
      PATH: '/bin',
      ANTHROPIC_API_KEY: 'anthropic',
      OPENAI_API_KEY: 'openai',
      OPENCODE_CONFIG_DIR: '/isolated/config',
      CODEX_API_KEY: 'codex-only',
      CLAUDE_CODE_OAUTH_TOKEN: 'claude-only',
      DATABASE_URL: 'postgres://secret',
    });

    expect(environment).toEqual({
      PATH: '/bin',
      ANTHROPIC_API_KEY: 'anthropic',
      OPENAI_API_KEY: 'openai',
      OPENCODE_CONFIG_DIR: '/isolated/config',
      OPENCODE_CONFIG_CONTENT: JSON.stringify({ permission: { '*': 'deny' } }),
      OPENCODE_DISABLE_AUTOUPDATE: 'true',
      OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
      OPENCODE_DISABLE_LSP_DOWNLOAD: 'true',
    });
  });

  it('preserves an OpenCode inline provider while overriding its permissions', () => {
    const environment = reviewerEnvironment('opencode', {
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        provider: { local: { name: 'Local' } },
        permission: { bash: 'allow' },
      }),
    });

    expect(JSON.parse(environment.OPENCODE_CONFIG_CONTENT ?? '{}')).toEqual({
      provider: { local: { name: 'Local' } },
      permission: { '*': 'deny' },
    });
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
