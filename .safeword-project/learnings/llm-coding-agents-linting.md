# LLM Coding Agents and Linting: Research Summary (December 2025)

Covers: ESLint configuration for AI agents, security plugins, additive preset architecture, auto-fix strategies.

> Knowledge extracted from Claude Code documentation, 2025 research papers, security plugin analysis, and practical experience configuring ESLint for AI-assisted development.

---

## Core Insight: LLMs Ignore Warnings, Only Respond to Errors

**This is the single most important finding for LLM linting configuration.**

```javascript
// LLM ignores - but human sees in lint output
'style-rule': 'warn'

// LLM must fix before proceeding
'correctness-rule': 'error'

// Nobody sees it
'disabled-rule': 'off'
```

**When to use each:**

- `"error"` - Correctness issues the LLM must fix (type safety, security, promises)
- `"warn"` - Style/smell issues for human review (reduce complexity, naming)
- `"off"` - Legitimately disabled (not applicable to project)

Source: [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) - "By encoding these rules as hooks rather than prompting instructions, you turn suggestions into app-level code that executes every time."

**The Discipline Principle:** From [When AI Writes All the Code](https://mkwatson.github.io/2025/06/24/ai-writes-all-code.html):

> "We can't make AI be disciplined, but we can make discipline the only option."

AI selectively follows constraints as context degrades. The solution: use linting rules to make compliance mandatory, not optional.

---

## Security Plugins Deep Dive

### @microsoft/eslint-plugin-sdl Analysis

**Source:** [GitHub - microsoft/eslint-plugin-sdl](https://github.com/microsoft/eslint-plugin-sdl)

**Critical gotcha:** SDL's `recommended` config REGISTERS `eslint-plugin-security` but does NOT enable any of its rules. You must explicitly configure security plugin rules yourself.

#### What's Good for LLM Development

| Rule Category      | Rules                                                  | Why It Matters for LLMs                                                       |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **Code Execution** | `no-eval`, `no-implied-eval`, `no-new-func`            | LLMs frequently generate `eval()`-like patterns when handling dynamic content |
| **DOM/XSS**        | `no-inner-html`, `no-document-write`, `no-html-method` | LLMs default to innerHTML assignments rather than createElement patterns      |
| **Insecure URLs**  | `no-insecure-url`                                      | Models suggest HTTP URLs without HTTPS consideration                          |
| **Memory Safety**  | `no-unsafe-alloc`                                      | Blocks `Buffer.allocUnsafe()` - LLMs don't understand memory risks            |

#### What's Bad (Noise for Modern Projects)

| Rule                   | Issue                                        | Recommendation                         |
| ---------------------- | -------------------------------------------- | -------------------------------------- |
| `no-angularjs-*` rules | Legacy AngularJS - irrelevant for greenfield | Disable unless using AngularJS         |
| `no-msapp-exec-unsafe` | Windows-specific UWP apps only               | Disable for non-Windows                |
| `no-winjs-html-unsafe` | WinJS is deprecated since 2017               | Disable for greenfield                 |
| `no-cookies`           | Warns on all cookie usage                    | Too noisy - cookies are valid for auth |

#### What's Missing from SDL

1. **No input validation rules** - LLMs frequently skip input sanitization
2. **No SQL injection detection** - Major LLM failure mode
3. **No path traversal detection** - `detect-non-literal-fs-filename` is in security plugin but weak
4. **No secrets detection** - SDL doesn't catch hardcoded API keys
5. **No SSRF detection** - Server-side request forgery patterns

**Verdict:** SDL is a good baseline but insufficient alone. Supplement with `eslint-plugin-security` rules explicitly and consider Semgrep for deeper analysis.

---

### eslint-plugin-security Analysis

**Source:** [GitHub - eslint-community/eslint-plugin-security](https://github.com/eslint-community/eslint-plugin-security)

14 security rules, all `warn` by default (should be `error` for LLM development).

#### Critical Rules for LLM Code

| Rule                             | What It Catches           | LLM Failure Mode                                      |
| -------------------------------- | ------------------------- | ----------------------------------------------------- |
| `detect-eval-with-expression`    | Dynamic code execution    | LLMs generate `eval(variable)` for "flexibility"      |
| `detect-non-literal-fs-filename` | Path traversal            | LLMs use variables in file paths without sanitization |
| `detect-non-literal-regexp`      | ReDoS patterns            | LLMs generate user-controlled regex                   |
| `detect-non-literal-require`     | Dynamic imports           | LLMs use `require(variable)` for "configurability"    |
| `detect-object-injection`        | Prototype pollution       | LLMs use `obj[userInput]` without validation          |
| `detect-child-process`           | Command injection         | LLMs spawn processes with user input                  |
| `detect-unsafe-regex`            | Catastrophic backtracking | LLMs generate complex regex that DoS                  |

#### Configuration for LLM Development

```javascript
// Security rules: error for low-false-positive, warn for high-false-positive
{
  rules: {
    // Core security rules at error severity (LLMs ignore warnings)
    'security/detect-eval-with-expression': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-child-process': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    // High false positive rate (~40%) - warn for human review
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-buffer-noassert': 'warn',
    'security/detect-new-buffer': 'warn',
    'security/detect-pseudoRandomBytes': 'warn',
  }
}
```

#### False Positive Issues

| Rule                             | False Positive Rate | Mitigation                                             |
| -------------------------------- | ------------------- | ------------------------------------------------------ |
| `detect-object-injection`        | HIGH (~40%)         | Use `// eslint-disable-next-line` for legitimate cases |
| `detect-non-literal-fs-filename` | MEDIUM              | Often flags safe path.join() usage                     |
| `detect-possible-timing-attacks` | HIGH                | Flags non-security comparisons                         |

**Key insight:** False positives are tolerable because LLMs iterate on errors. Better to have false positives than miss real vulnerabilities.

---

## What LLMs Struggle With (Updated December 2025)

### Security Vulnerabilities (New Research)

From [Security Degradation in AI-Generated Code](https://securityboulevard.com/2025/11/security-degradation-in-ai-generated-code-a-threat-vector-cisos-cant-ignore/) and [Kaspersky - Vibe Coding Risks](https://www.kaspersky.com/blog/vibe-coding-2025-risks/54584/):

**Most Common LLM Security Mistakes:**

1. **Lack of input validation** - No sanitization of user input
2. **Hardcoded secrets** - API keys directly in code
3. **Client-side authentication** - Auth logic in browser code
4. **XSS vulnerabilities** - Using innerHTML without escaping
5. **SQL injection** - String interpolation in queries

**MITRE CWE Top Issues in LLM Code:**

- CWE-94: Code injection
- CWE-78: OS command injection
- CWE-190: Integer overflow
- CWE-306: Missing authentication
- CWE-434: Unrestricted file upload

**Critical Finding:** A study found **37.6% increase** in critical vulnerabilities after just 5 iterations of "improvements" - LLMs can make code LESS secure over time when explicitly asked to make it more secure.

Source: [University of San Francisco / Vector Institute study](https://securityboulevard.com/2025/11/security-degradation-in-ai-generated-code-a-threat-vector-cisos-cant-ignore/)

### Type System Failures

#### 1. Forgetting `await` (Floating Promises)

```typescript
// LLM mistake - forgot to await
someAsyncFunction(); // Promise floats, errors silently swallowed
```

**Rule:** `@typescript-eslint/no-floating-promises: 'error'`

#### 2. Async in Wrong Contexts

```typescript
// LLM mistake - async in non-async context
array.forEach(async (item) => { ... })  // Promises fire-and-forget
```

**Rule:** `@typescript-eslint/no-misused-promises: 'error'`

#### 3. Type Coercion Bugs

```typescript
// LLM mistake - truthy check when value could be 0 or ""
if (value) { ... }
```

**Rule:** `@typescript-eslint/strict-boolean-expressions: 'error'`

#### 4. Using `any` When Stuck

```typescript
// LLM mistake - gives up on typing
function process(data: any) { ... }
```

**Rule:** `@typescript-eslint/no-explicit-any: 'error'`

#### 5. Using `||` Instead of `??`

```typescript
// LLM mistake - breaks when value is 0 or ""
const count = value || defaultValue;

// Correct - only falls back on null/undefined
const count = value ?? defaultValue;
```

**Rule:** `@typescript-eslint/prefer-nullish-coalescing: 'error'`

#### 6. Silent Exception Swallowing

```typescript
// LLM mistake - empty catch
try { ... } catch (e) {}
```

**Rules:**

- `no-empty: 'error'`
- `@typescript-eslint/no-useless-catch: 'error'`

---

## What LLMs Excel At (Don't Over-Constrain)

| Strength                    | Implication                                         |
| --------------------------- | --------------------------------------------------- |
| Import organization         | Auto-fix with `simple-import-sort`                  |
| Following explicit patterns | Architecture boundaries guide behavior              |
| Iterating on errors         | Hooks give immediate feedback                       |
| Consistent formatting       | Prettier handles this                               |
| Test-driven development     | RED → GREEN → REFACTOR aligns with LLM capabilities |
| Applying auto-fixes         | `--fix` flag leverages LLM's iterative strength     |

**Key insight:** LLMs excel at mechanical fixes. Use auto-fix rules liberally for style issues; reserve blocking errors for semantic correctness.

---

## Research Findings (2025)

### "Do Code LLMs Do Static Analysis?" (May 2025)

[arxiv.org/abs/2505.12118](https://arxiv.org/abs/2505.12118)

**Key finding:** LLMs show poor performance on static analysis tasks (callgraph, AST, dataflow generation). Pretraining on static analysis tasks does not generalize to better performance on code intelligence tasks.

**Implication:** Don't expect LLMs to mentally track types or control flow. Use type-checking rules to compensate.

### "Static Analysis as a Feedback Loop" (ICSME 2025)

[arxiv.org/abs/2508.14419](https://arxiv.org/abs/2508.14419)

**Quantified Results (within 10 iterations):**

- Security issues: >40% → 13%
- Readability violations: >80% → 11%
- Reliability warnings: >50% → 11%

**Key Finding:** Incremental approach preferred over fixing all issues at once—attempting to resolve multiple problems concurrently may overwhelm the model.

**Implication:** Prioritize issues: security > reliability > readability. Fix incrementally.

### "Feedback-Driven Security Patching" (November 2025)

[MDPI Publication](https://www.mdpi.com/2624-800X/5/4/110)

**Results:**

- 33% vulnerability reduction with Bandit
- 12% vulnerability reduction with CodeQL

**Implication:** Static analysis tools as feedback loops significantly improve security of LLM-generated code.

### "IRIS: LLM-Assisted Static Analysis" (April 2025)

[arxiv.org/abs/2405.17238](https://arxiv.org/abs/2405.17238)

IRIS + GPT-4 detects 55 vulnerabilities vs CodeQL's 27 (+28) and improves false discovery rate by 5%.

**Implication:** LLMs + static analysis together outperform either alone. Use both.

### TypeScript with AI-Aided Development

[pm.dartus.fr](https://pm.dartus.fr/posts/2025/typescript-ai-aided-development/)

**Key findings:**

- Stricter type definitions → AI generates more accurate code in fewer attempts
- AI self-corrects more effectively using TypeScript error messages
- AI eliminates impossible test cases when types are strict

**Implication:** Maximize TypeScript strictness. Use `strictTypeChecked` + `stylisticTypeChecked`.

---

## Performance & Latency Considerations

From [AI Coding Assistants Guide](https://www.augmentcode.com/guides/ai-coding-assistants-for-large-codebases-a-complete-guide):

### Latency Targets

- **Inline completions:** <250ms (Cursor achieves <100ms)
- **Linting feedback:** <500ms or perceived as blocking
- **Type-checked linting:** Can be 30x slower than syntax-only

### Strategies for Large Codebases

1. **Lint only changed files** in PostToolUse hooks
2. **Run lightweight rules locally** (formatting, syntax)
3. **Push heavyweight analysis** (type-checked rules) to pre-commit
4. **Use incremental TypeScript** (`tsc --incremental`)

### Context Window Concerns

ESLint output can "balloon an AI conversation past the model's context size." Mitigation:

- Suppress verbose output in hooks
- Only show first N errors
- Prioritize actionable errors over warnings

---

## Recommended ESLint Plugins for LLM Development

### Must-Have (Greenfield Projects)

| Plugin                             | Purpose                  | LLM Value                     |
| ---------------------------------- | ------------------------ | ----------------------------- |
| `typescript-eslint`                | Type-checked rules       | Catches most LLM type errors  |
| `@microsoft/eslint-plugin-sdl`     | Security baseline        | XSS, eval, DOM safety         |
| `eslint-plugin-security`           | Additional security      | Path traversal, injection     |
| `eslint-plugin-boundaries`         | Architecture enforcement | Prevents "convenient" imports |
| `eslint-plugin-promise`            | Promise anti-patterns    | No-floating-promises critical |
| `eslint-plugin-regexp`             | Regex correctness        | ReDoS prevention              |
| `eslint-plugin-simple-import-sort` | Auto-fixable imports     | Zero-friction organization    |
| `eslint-config-prettier`           | Formatting conflicts     | Prevents style fights         |

### Recommended

| Plugin                  | Purpose              | When to Add                |
| ----------------------- | -------------------- | -------------------------- |
| `eslint-plugin-sonarjs` | Cognitive complexity | For complex business logic |
| `eslint-plugin-unicorn` | Modern JS patterns   | After stabilizing codebase |
| `eslint-plugin-jsdoc`   | Documentation        | For library/API code       |

### Framework-Specific

| Plugin                      | When             |
| --------------------------- | ---------------- |
| `eslint-plugin-react-hooks` | React projects   |
| `@next/eslint-plugin-next`  | Next.js projects |
| `eslint-plugin-astro`       | Astro projects   |
| `eslint-plugin-vue`         | Vue projects     |
| `eslint-plugin-svelte`      | Svelte projects  |

---

## What's Missing from Current Setup

### 1. Secrets Detection

Neither SDL nor security plugin catches hardcoded secrets.

**Options:**

- `eslint-plugin-no-secrets` - Detects high-entropy strings
- `detect-secrets` (Yelp) - Pre-commit hook, not ESLint
- Gitleaks - CI/CD integration

### 2. SQL Injection Detection

No ESLint rule catches SQL injection patterns.

**Options:**

- Semgrep rules for SQL injection
- Custom ESLint rule for your ORM patterns
- `eslint-plugin-sql` (limited)

### 3. Input Validation Enforcement

No rule ensures user input is validated.

**Options:**

- Zod/Yup schema enforcement via custom rules
- Framework-specific validation plugins

### 4. SSRF Detection

Server-side request forgery not covered.

**Options:**

- Semgrep SSRF rules
- Custom rules for fetch/axios patterns

### 5. Rate Limiting / DoS Prevention

No rules for resource exhaustion patterns.

**Missing coverage for:**

- Unbounded loops
- Recursive depth limits
- Memory allocation limits

---

## TypeScript-ESLint Configuration Tiers

### Tier 3: Strict (Recommended for LLM Development)

```javascript
...tseslint.configs.strictTypeChecked,
...tseslint.configs.stylisticTypeChecked,
```

All recommended + strict rules. Maximum LLM guardrails.

**Key strict rules:**

- `no-non-null-assertion` - Prevents `!` escape hatches
- `no-unnecessary-condition` - Catches redundant checks
- Stricter `any` handling

**Performance note:** Type-checking can increase lint time 30x. Mitigate by linting only changed files in hooks.

---

## Hook-Based Enforcement Pattern

From Claude Code documentation (November 2025 update):

### PostToolUse Hook for Linting

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [{ "type": "command", "command": "./hooks/post-tool-lint.sh" }]
      }
    ]
  }
}
```

```bash
# post-tool-lint.sh - parse file from stdin JSON
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0
npx eslint --fix "$file"
```

### New in 2025: Input Modification

PreToolUse hooks can now modify tool inputs (v2.0.10+):

```json
{
  "decision": "modify",
  "updatedInput": { "file_path": "/safe/path/file.ts" }
}
```

**Use case:** Auto-fix inputs without blocking-and-retry loops.

### Exit Code Semantics

- **Exit 0**: Success (stdout in verbose mode)
- **Exit 2**: Blocking error (stderr shown to Claude)
- **Other codes**: Non-blocking errors (user only)

---

## Common Anti-Patterns to Avoid

### 1. Using `warn` for Security Rules

LLMs ignore warnings. Security rules MUST be `error`.

### 2. Disabling `no-unsafe-*` in Test Files

LLMs hallucinate API shapes in tests. Keep type safety.

### 3. Over-Permissive `any` Usage

LLMs use `any` when stuck. Enforce `@typescript-eslint/no-explicit-any`.

### 4. No Architecture Boundaries

LLMs generate "convenient" imports. Use `eslint-plugin-boundaries`.

### 5. Enabling Legacy Framework Rules

AngularJS, WinJS rules in SDL add noise for greenfield. Disable explicitly.

### 6. Running Full Lint on Every Edit

Type-checked rules are slow. Lint only changed files in PostToolUse hooks.

---

## Critique of Current safeword ESLint Config

### What's Good

1. **strictTypeChecked enabled** - Maximum type safety for LLM code
2. **SDL plugin included** - Security baseline (own rules are all `error`)
3. **Security plugin rules explicitly configured** - With appropriate severities
4. **Boundaries plugin** - Architecture enforcement
5. **Promise plugin** - Critical for async error catching
6. **Regexp plugin** - ReDoS prevention
7. **Dynamic framework detection** - Adapts to project dependencies
8. **Config file overrides** - Relaxes rules for inherently untyped files

### What Could Be Better

1. **Missing secrets detection** - No eslint-plugin-no-secrets
2. **Missing SQL injection** - No coverage for database queries
3. **Legacy SDL rules enabled** - AngularJS/WinJS rules add noise for greenfield

### False Positive Mitigation Strategy

For high-false-positive rules like `detect-object-injection`:

**Option A: Warn severity (current)**

- LLM sees warning but doesn't block
- Human reviews in PR
- Risk: LLM ignores legitimate issues

**Option B: Error with inline disables**

- LLM blocks and may add `// eslint-disable-next-line`
- Review disable comments in PR
- Risk: LLM over-disables

**Option C: Error with allowlist**

- Configure rule with known-safe patterns
- Most precise but high maintenance

**Current choice:** Option A for `detect-object-injection` and `detect-possible-timing-attacks` due to ~40% false positive rate.

---

## Key Sources

### Official Documentation

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks.md)
- [typescript-eslint.io](https://typescript-eslint.io/)
- [Microsoft SDL Plugin](https://github.com/microsoft/eslint-plugin-sdl)
- [ESLint Security Plugin](https://github.com/eslint-community/eslint-plugin-security)

### Research Papers (2025)

- [Do Code LLMs Do Static Analysis?](https://arxiv.org/abs/2505.12118)
- [Static Analysis as a Feedback Loop](https://arxiv.org/abs/2508.14419)
- [Feedback-Driven Security Patching](https://www.mdpi.com/2624-800X/5/4/110)
- [IRIS: LLM-Assisted Static Analysis](https://arxiv.org/abs/2405.17238)
- [Hidden Risks of LLM-Generated Web Code](https://arxiv.org/html/2504.20612v1)

### Security Research

- [Security Degradation in AI-Generated Code](https://securityboulevard.com/2025/11/security-degradation-in-ai-generated-code-a-threat-vector-cisos-cant-ignore/)
- [Vibe Coding Security Risks](https://www.kaspersky.com/blog/vibe-coding-2025-risks/54584/)
- [OWASP Top 10 LLM Vulnerabilities](https://www.brightdefense.com/resources/owasp-top-10-llm/)
- [LLMs + Coding Agents = Security Nightmare](https://garymarcus.substack.com/p/llms-coding-agents-security-nightmare)

### Practical Guides

- [TypeScript with AI-Aided Development](https://pm.dartus.fr/posts/2025/typescript-ai-aided-development/)
- [Rulens: AI-Friendly Coding Guidelines](https://www.mh4gf.dev/articles/rulens-introduction)
- [Docker: Fix ESLint Violations with AI](https://www.docker.com/blog/how-to-fix-eslint-violations-with-ai-assistance/)
- [AI Coding Assistants for Large Codebases](https://www.augmentcode.com/guides/ai-coding-assistants-for-large-codebases-a-complete-guide)

---

_Last updated: December 8, 2025_
