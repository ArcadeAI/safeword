# Skill Authoring Guide

How to write Claude Skills that are discoverable, effective, and production-ready.

**Source:** [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)

**Related:** [LLM Writing Guide](../../.safeword/guides/llm-writing-guide.md) for general principles

---

## Skill Structure

```text
skill-name/
├── SKILL.md        # Required. Main instructions (<500 lines)
├── REFERENCE.md    # Optional. API details, loaded on demand
├── EXAMPLES.md     # Optional. Usage patterns, loaded on demand
└── scripts/        # Optional. Utility scripts
    └── helper.py
```

**How loading works:**

1. **Startup:** Only `name` and `description` from frontmatter are loaded (~100 tokens)
2. **Activation:** Full SKILL.md loads when skill is triggered (<5k tokens ideal)
3. **On-demand:** Referenced files load only when Claude needs them

---

## Naming

Use **short, action-oriented names**. Concise names are preferred over verbose gerunds.

| Form   | Examples                         | Status     |
| ------ | -------------------------------- | ---------- |
| Short  | `bdd`, `debug`, `refactor`       | Preferred  |
| Gerund | `brainstorming`, `tdd-enforcing` | Acceptable |
| Vague  | `helper`, `utils`, `tools`       | Avoid      |

**Short, action-oriented names:** Prefer concise names like `bdd`, `debug`, `refactor` over verbose gerunds like `bdd-orchestrating`. Users find them faster and they're easier to type as `/commands`.

**Official Claude Code requirements:**

- Lowercase letters, numbers, and hyphens only
- Max 64 characters
- Directory name must match `name` field in SKILL.md frontmatter
- No reserved words: `anthropic`, `claude`

**Precedence:** If two skills share a name, higher scope wins: managed → personal → project → plugin.

---

## Description (Critical for Selection Accuracy)

The description is the **primary signal** for skill discovery. Claude uses pure LLM reasoning—no embeddings, classifiers, or pattern matching—to select skills based solely on description text.

**How selection works:**

1. At startup, all skill descriptions load into system prompt (~100 tokens each)
2. Claude reads descriptions and matches user intent using language understanding
3. Best-matching skill is selected and its full SKILL.md loads

**This means:** Description quality directly determines auto-invocation accuracy.

### Requirements

- Write in **third person** (injected into system prompt; first/second person causes issues)
- Include **what it does** AND **when to use it**
- Include **trigger phrases** users would actually say
- Combined description + when_to_use capped at 1,536 characters

### The WHEN + WHEN NOT Pattern

Generic descriptions fail. Specific boundaries succeed. Testing shows ~20% activation with generic descriptions vs 80%+ with the WHEN + WHEN NOT pattern.

```yaml
# BAD - Too vague, will misfire
description: Helps with code quality

# BAD - Missing triggers
description: Performs deep code review with web research

# GOOD - Semantic intent + boundaries
description: Deep code review with web research. Use when double-checking
  code against latest docs, verifying dependency versions, or reviewing
  security concerns. Do NOT use for quick fixes or when user just wants
  code written.
```

### Effective Description Anatomy

```yaml
description: [WHAT it does]. [WHEN to use - specific triggers].
  [WHEN NOT to use - prevents misfires].
```

**Examples from official docs:**

```yaml
# PDF Processing
description: Extract text and tables from PDF files, fill forms, merge
  documents. Use when working with PDF files or when user mentions PDFs,
  forms, or document extraction.

# Git Commit Helper
description: Generate descriptive commit messages by analyzing git diffs.
  Use when user asks for help writing commit messages or reviewing staged
  changes.

# Stakeholder Context (with WHEN NOT)
description: Stakeholder context for Test Project when discussing product
  features, UX research, or stakeholder interviews. Auto-invoke when user
  mentions Test Project, product lead, or UX research. Do NOT load for
  general stakeholder discussions unrelated to Test Project.
```

### Natural Phrases Over Keyword Lists

Describe the situation, don't enumerate trigger words. Claude matches semantically.

```yaml
# Bad — keyword list, brittle
description: Use when user says 'refactor', 'clean up', 'restructure'

# Good — semantic intent + natural phrases
description: Improve code structure without changing behavior. Use when
  refactoring, restructuring, or simplifying code.
```

Include natural action phrases ("refactoring, restructuring") but don't quote them as keywords. The description should read like a sentence, not a grep pattern.

### Testing Selection Accuracy

1. Try invoking with various phrasings - does the right skill activate?
2. Try similar requests - does it avoid misfiring on wrong skills?
3. Test with Haiku (needs more guidance) and Opus (avoid over-triggering)

---

## SKILL.md Body

### Size Limits

- Keep under **500 lines** for optimal performance
- If larger, split into referenced files

### Progressive Disclosure

Show just enough to help Claude decide what to do next. Reference details.

```markdown
# PDF Processing

## Quick Start

[Essential instructions here]

## Advanced Features

See [FORMS.md](FORMS.md) for form filling
See [REFERENCE.md](REFERENCE.md) for API details
```

**Key rules:**

- References **one level deep only** (no nested references)
- Long reference files need **table of contents** at top
- Use **forward slashes** in paths (`reference/guide.md`, not `reference\guide.md`)

### Conciseness

Claude is already smart. Only add context it doesn't have.

```markdown
# BAD - Over-explaining (~150 tokens)

PDF (Portable Document Format) files are a common file format that
contains text, images, and other content. To extract text from a PDF,
you'll need to use a library. There are many libraries available...

# GOOD - Concise (~50 tokens)

Use pdfplumber for text extraction:
\`\`\`python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
text = pdf.pages[0].extract_text()
\`\`\`
```

---

## Workflows

For complex tasks, provide checklists Claude can track.

```markdown
## Form Filling Workflow

Copy this checklist:

- [ ] Step 1: Analyze form (run analyze_form.py)
- [ ] Step 2: Create field mapping
- [ ] Step 3: Validate mapping
- [ ] Step 4: Fill form
- [ ] Step 5: Verify output

**Step 1: Analyze form**
Run: `python scripts/analyze_form.py input.pdf`
...
```

### Feedback Loops

For quality-critical operations, include validation steps:

```markdown
1. Make edits
2. **Validate immediately**: `python scripts/validate.py`
3. If validation fails → fix and validate again
4. **Only proceed when validation passes**
```

---

## Degrees of Freedom

Match specificity to task fragility:

| Freedom | When                      | Example                                           |
| ------- | ------------------------- | ------------------------------------------------- |
| High    | Multiple valid approaches | "Analyze code structure and suggest improvements" |
| Medium  | Preferred pattern exists  | Template with customization options               |
| Low     | Operations are fragile    | "Run exactly this script. Do not modify."         |

---

## Anti-Patterns

| Don't                     | Do                                        |
| ------------------------- | ----------------------------------------- |
| Windows paths (`\`)       | Forward slashes (`/`)                     |
| Offer too many options    | Provide default with escape hatch         |
| Assume packages installed | List dependencies explicitly              |
| Deeply nested references  | One level deep from SKILL.md              |
| Time-sensitive info       | Use "old patterns" section for deprecated |
| Inconsistent terminology  | Pick one term, use throughout             |

---

## Quality Checklist

Before publishing a skill:

- [ ] Name is short and action-oriented
- [ ] Description includes what + when (third person)
- [ ] SKILL.md under 500 lines
- [ ] References one level deep
- [ ] No time-sensitive information
- [ ] Consistent terminology throughout
- [ ] Concrete examples provided
- [ ] Tested with Haiku, Sonnet, and Opus

---

## Schema Registration (CRITICAL)

**Every new template file MUST be registered in `packages/cli/src/schema.ts`.**

Without schema registration, templates are orphaned and never installed by `safeword setup` or `safeword upgrade`.

**For new skills:**

1. Add to `ownedFiles`:
   - `.claude/skills/safeword-{name}/SKILL.md` → `skills/safeword-{name}/SKILL.md`
   - `.cursor/rules/safeword-{name}.mdc` → `cursor/rules/safeword-{name}.mdc`

2. For new commands:
   - `.claude/commands/{name}.md` → `commands/{name}.md`
   - `.cursor/commands/{name}.md` → `commands/{name}.md`

See [Schema Registration Guide](./../guides/schema-registration-guide.md) for the full list of template types and their schema mappings.
