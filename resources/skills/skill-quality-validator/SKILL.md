---
name: skill-quality-validator
description: "Trigger: skill validation, skill lint, skill quality, validate skill. Validates skill structure, frontmatter, references, dependencies, and conventions. Integrates with CI for PR checks."
license: Apache-2.0
metadata:
  author: AndyTechnologies
  version: "1.0"
---

# Skill Quality Validator

## Activation Contract

**Use this skill when:**
- A skill file is created or modified
- Before publishing a skill to the registry
- In CI/CD pipeline for PR validation
- User requests skill quality check (`/skill-quality-validator` or similar trigger)
- Before releasing a new version of gentle-agent-extensions

**Do NOT use this skill for:**
- Runtime skill loading validation (handled by Pi)
- Skill execution or delegation logic
- Validating agent definitions (different format)

## Hard Rules

| Rule | Description |
|------|-------------|
| **Frontmatter mandatory** | Every skill must have valid YAML frontmatter with required fields |
| **Required frontmatter fields** | `name`, `description`, `license`, `metadata.author`, `metadata.version` |
| **Name consistency** | Skill directory name must match `name` field in frontmatter |
| **SKILL.md required** | Every skill directory must contain `SKILL.md` |
| **Section structure** | Must contain all required sections: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract, References |
| **Reference validity** | All referenced skills, agents, files must exist |
| **No circular deps** | Skill dependency graph must be acyclic |
| **Invocation compatibility** | `disable-model-invocation: true` skills must not be invoked automatically by other skills |

## Knowledge Base

### Required Frontmatter Fields

```yaml
---
name: skill-name
description: "Trigger: trigger phrases. One-line description of when to use this skill."
license: Apache-2.0
metadata:
  author: AuthorName
  version: "1.0"
---
```

### Required SKILL.md Sections

1. **Activation Contract** — When to use / when NOT to use
2. **Hard Rules** — Constraints table
3. **Decision Gates** — Decision table for choices
4. **Execution Steps** — Step-by-step procedures
5. **Output Contract** — What the agent should produce
6. **References** — Local file paths and external URLs

### Skill Invocation Types

| Type | Description | Auto-invocation |
|------|-------------|-----------------|
| `disable-model-invocation: true` | User-invoked only (entry points like `grill-me`) | NEVER |
| `disable-model-invocation: false` (default) | Can be invoked by model/orchestrator | Allowed |

## Decision Gates

| Situation | Action |
|-----------|--------|
| Missing frontmatter | ERROR: Skill invalid |
| Missing required fields | ERROR: Skill invalid |
| Name mismatch (dir vs frontmatter) | ERROR: Skill invalid |
| Missing SKILL.md | ERROR: Skill invalid |
| Missing required section | ERROR: Skill invalid |
| Referenced skill not found | ERROR: Reference broken |
| Circular dependency detected | ERROR: Circular dependency |
| Auto-invocation of user-invoked skill | ERROR: Invocation violation |
| External URL unreachable | WARNING: Link may be broken |
| Missing References section | WARNING: Documentation incomplete |
| Invoke rules unclear | WARNING: Invocation ambiguity |

## Execution Steps

### 1. Validate Frontmatter
- Parse YAML frontmatter from SKILL.md
- Check all required fields present and valid
- Verify `name` matches directory name
- Verify `description` contains "Trigger:" phrase

### 2. Validate Structure
- Check all 6 required sections present
- Verify section headers use `## ` format
- Check for empty sections

### 3. Validate References
- Parse References section for local file paths
- Verify each referenced file exists
- Parse for skill references (backtick-quoted skill names)
- Verify referenced skills exist in resources/skills/

### 4. Validate Dependencies
- Build dependency graph from skill references
- Detect cycles using DFS
- Check for `disable-model-invocation: true` skills being auto-invoked

### 5. Validate External Links
- Extract URLs from content
- HEAD request to verify reachability (optional, with timeout)
- Report broken links as warnings

### 6. Check Conventions
- Skill directory follows naming convention (kebab-case)
- Frontmatter uses consistent formatting
- No hardcoded paths that should be relative

## Output Contract

Return validation result:

```
SKILL_VALIDATION_RESULT: PASS | FAIL

ERRORS:
- [skill-name]: [error description]
  File: [path]
  Line: [if applicable]

WARNINGS:
- [skill-name]: [warning description]
  File: [path]

SUMMARY:
- Skills checked: N
- Errors: N
- Warnings: N
- Status: PASS | FAIL
```

## CI/CD Integration

### GitHub Action: skill-quality.yml

```yaml
name: Skill Quality Check
on: [pull_request, push]
jobs:
  validate-skills:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Install dependencies
        run: npm ci
      - name: Run skill quality validator
        run: npx tsx scripts/validate-skills.ts
```

### Validation Script

The validator can be run standalone:

```bash
npx tsx scripts/validate-skills.ts
```

Exit codes:
- `0` — All skills valid (PASS)
- `1` — Errors found (FAIL)

## Configuration

Optional `.skill-quality.json` at repo root:

```json
{
  "strictMode": true,
  "checkExternalLinks": true,
  "linkTimeout": 5000,
  "allowedExternalDomains": ["github.com", "docs.npmjs.com"],
  "skipSkills": []
}
```

## Integration with gentle-agent-extensions

The validator is automatically run in:
- `npm test` (via tests)
- `gentle-extensions:doctor --skills` command
- CI/CD pipeline on PR/push

## References

- Gentle AI Skill Style Guide: https://github.com/Gentleman-Programming/gentle-pi/blob/main/docs/skill-style-guide.md
- Pi Extensions API: https://pi.dev/docs/latest/extensions
- Skill Registry Protocol: orchestrator-delegation.md