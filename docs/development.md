# Development Guide

## Development Environment Setup

### Prerequisites

- Node.js 20+ (24 recommended)
- npm 10+
- Pi coding agent 1.5.0+
- TypeScript 5+
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/AndyTechnologies/gentle-agent-extensions.git
cd gentle-agent-extensions

# Install dependencies
npm ci

# Run tests
npm test

# Test extension load
pi -e ./src/extension.ts
```

---

## Project Structure

```
gentle-agent-extensions/
├── src/
│   └── extension.ts              # Main extension entry point
├── resources/
│   ├── agents/                   # Bundled agents (.md)
│   ├── overlays/                 # Bundled overlays (.overlay.md)
│   ├── skills/                   # Bundled skills (dirs with SKILL.md)
│   ├── routing/                  # Routing rules (.md)
│   └── mcp/                      # MCP server definitions (.mcp.json)
├── scripts/
│   └── validate-skills.ts        # Skill quality validator
├── tests/
│   └── gentle-extensions.test.ts # Unit tests
├── docs/                         # Documentation
├── scripts/                      # Utility scripts
├── .github/workflows/            # CI/CD
├── package.json
├── CHANGELOG.md
├── extension.config.json
└── README.md
```

---

## Development Workflow

### Adding a New Skill

```bash
# 1. Create skill directory
mkdir -p resources/skills/my-skill

# 2. Create SKILL.md with all required sections
cat > resources/skills/my-skill/SKILL.md <<'EOF'
---
name: my-skill
description: "Trigger: my trigger. What this skill does."
license: Apache-2.0
metadata:
  author: YourName
  version: "1.0"
---

# My Skill

## Activation Contract
Use when...

## Hard Rules
| Rule | Description |

## Decision Gates
| Situation | Action |

## Execution Steps
1. Step 1

## Output Contract
...

## References
- resources/skills/my-skill/SKILL.md
EOF
```

### Adding a Bundled Agent

```bash
cat > resources/agents/my-agent.md <<'EOF'
---
name: my-agent
description: "What this agent does"
model: anthropic/claude-opus-4
thinking: high
mode: task
tools: [read, write, bash]
---
# My Agent Instructions
EOF
```

### Adding Routing

```bash
cat > resources/routing/my-agent.md <<'EOF'
---
agent: my-agent
triggers: ["trigger phrase"]
conditions: ["file:resources/agents/my-agent.md"]
delegation: subagent_run
requiredSkills: ["my-skill"]
priority: 100
---
EOF
```

### Adding MCP Server

```bash
cat > resources/mcp/my-server.mcp.json <<'EOF'
{
  "name": "my-server",
  "description": "What this server provides",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@pkg/server"],
  "env": { "API_KEY": "${API_KEY}" },
  "exposure": "codemode",
  "enabled": true
}
EOF
```

---

## Testing

### Run All Tests

```bash
npm test
# or
npx tsx tests/gentle-extensions.test.ts
```

### Run Specific Test

```bash
npx tsx tests/gentle-extensions.test.ts --test-name-pattern="architecture-quest"
```

### Test Output

```
▶ gentle-agent-extensions package structure
  ✔ package directories exist
  ✔ extension entry point exists
  ✔ package.json has correct pi manifest
  ✔ bundled agents exist
  ✔ bundled overlays exist
  ✔ bundled skills exist
  ✔ bundled routing exists
  ✔ no legacy directories exist
✔ gentle-agent-extensions package structure

▶ bundled resources validation
  ✔ architecture-council agent has valid frontmatter
  ✔ orchestrator overlay has valid frontmatter and modes
  ✔ gentle-agent-extension skill references new paths
  ✔ architecture-quest skill is valid
  ✔ changelog-generator skill is valid
  ✔ product-quest skill is valid
  ✔ routing references correct agent
  ✔ all skills valid
✔ bundled resources validation

▶ extension parsing utilities
  ✔ overlay frontmatter parsing works
  ...

▶ extension load test
  ✔ extension loads without errors via pi -e
  ✔ extension load test

ℹ tests 30
ℹ suites 4
ℹ pass 30
ℹ fail 0
```

### Watch Mode

```bash
npx tsx watch tests/gentle-extensions.test.ts
```

---

## Skill Validation

### Run Skill Validator

```bash
npm run validate:skills
# or
npx tsx scripts/validate-skills.ts
```

### Validator Output

```
Validating 13 skills...

✅ gentle-ui: OK
✅ github-automation: OK
✅ grilling: OK
✅ grill-me: OK
✅ red-suite-hygiene: OK
✅ ui-design: OK
✅ ui-ux-principles: OK
✅ using-git-worktrees: OK
✅ all new skills have SKILL.md
========================
Skills checked: 13
Errors: 0
Warnings: 49
Status: PASS
```

### Validator Checks

| Check | Type | Description |
|-------|------|-------------|
| Frontmatter | Error | Required fields, name match, metadata |
| Sections | Error | All 6 required sections present |
| References | Warning | Local files exist, skill refs valid |
| Circular deps | Error | DFS cycle detection |
| External links | Warning | HEAD request (optional) |
| Conventions | Warning | kebab-case, formatting |

---

## Extension Testing

### Load Test

```bash
pi -e ./src/extension.ts
```

Expected: Extension loads without errors.

### Manual Testing Checklist

- [ ] `/gentle-extensions:status` shows all resources
- [ ] `/gentle-extensions:doctor` passes
- [ ] `/gentle-extensions:doctor --graph` generates graph
- [ ] `/gentle-extensions:doctor --graph --dot` outputs DOT
- [ ] `/gentle-extensions:doctor --resources` checks conflicts
- [ ] `/gentle-extensions:doctor --routing` validates routing
- [ ] `/gentle-extensions:doctor --mcp-health` runs MCP health
- [ ] `/gentle-extensions:doctor --graph --dot` outputs DOT
- [ ] `/gentle-extensions:resources` shows inventory
- [ ] `/gentle-extensions:routing` shows routing rules
- [ ] `/gentle-extensions:conflicts` detects conflicts
- [ ] `/gentle-extensions:mcp-health` runs handshake
- [ ] `/gentle-extensions:mcp-status` shows lifecycle
- [ ] `/gentle-extensions:mcp-install <name>` installs server
- [ ] `/gentle-extensions:mcp-uninstall <name>` uninstalls server
- [ ] `/gentle-extensions:mcp-reload` reloads servers
- [ ] `/gentle-extensions:mcp-status` shows lifecycle
- [ ] `/gentle-extensions:mcp-logs <name>` stub works
- [ ] `/gentle-extensions:conflicts` detects conflicts
- [ ] `/gentle-extensions:routing` shows routing
- [ ] `/gentle-extensions:doctor --graph --dot` outputs DOT
- [ ] `/gentle-extensions:doctor --graph` shows graph
- [ ] `/gentle-extensions:doctor --resources` checks conflicts
- [ ] `/gentle-extensions:doctor --routing` validates routing
- [ ] `/gentle-extensions:doctor --mcp-health` runs handshake

### Architecture Quest Test

```
"Run architecture quest for adding a new MCP server"
```

Expected:
1. Detects architectural implications
2. Identifies gaps (MCP security, state management)
3. Launches quest-interview for blocking gaps
4. Produces AC-01, AC-02, etc.

### Product Quest Test

```
"Run product quest for new MCP marketplace feature"
```

Expected:
1. Detects product gaps (scope, pricing, moderation)
2. Launches quest-interview for blocking gaps
3. Produces PC-01, PC-02, etc.

### Architecture Council Test

```
"Use architecture-council to verify AC-01"
```

Expected:
- Reads AC-01 from ODD document
- Checks implementation against invariants
- Returns PASS/FAIL/UNVERIFIED per clause

### Product Contract Verifier Test

```
"Verify product contract for new feature"
```

Expected:
- Reads PC-XX from ODD document
- Checks implementation against acceptance criteria
- Returns PASS/FAIL/INCOMPLETE

### Changelog Generator Test

```
"Generate changelog for this release"
```

Expected:
- Analyzes git diff
- Categorizes changes
- Proposes 2+ SemVer options
- Outputs CHANGELOG.md section

---

## Debugging

### Extension Load Debug

```bash
# Verbose load
DEBUG=* pi -e ./src/extension.ts

# Check specific module
pi -e "import './src/extension.ts'; console.log('loaded')"
```

### Debug Commands in Pi

```
/gentle-extensions:status
/gentle-extensions:doctor
/gentle-extensions:resources
/gentle-extensions:routing
/gentle-extensions:conflicts
/gentle-extensions:mcp-health
/gentle-extensions:mcp-status
/gentle-extensions:doctor --graph --dot
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Extension not loading | Check `pi.extensions` in package.json |
| Skills not loading | Verify `pi.skills` glob pattern |
| MCP not registering | Check `registry-url` in setup-node |
| Permission denied | Check allow-list in config |
| Circular dependency | Run `/gentle-extensions:doctor --graph` |

---

## Code Style

### TypeScript

```bash
# Type check
npx tsc --noEmit

# Lint
npx eslint src/ --ext .ts
```

### Conventions

- **Naming**: camelCase for variables, PascalCase for types/interfaces
- **Imports**: Group by external/internal, alphabetical within groups
- **Async**: Always use `async/await`, avoid `.then()`
- **Errors**: Use typed errors, include context
- **Comments**: JSDoc for public APIs

### Formatting

```bash
npx prettier --write src/ tests/ scripts/
```

---

## Adding Tests

### Unit Test Template

```typescript
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test, { describe } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

describe("my-feature", () => {
  test("does something", () => {
    assert.ok(true);
  });
});
```

### Test Naming

- `test("description of behavior", () => {...})`
- Group related tests in `describe("feature", () => {...})`
- Use descriptive names: "should do X when Y"

---

## Release Process

### Pre-Release Checklist

- [ ] All tests pass (`npm test`)
- [ ] Skill validation passes (`npm run validate:skills`)
- [ ] Extension loads (`pi -e ./src/extension.ts`)
- [ ] CHANGELOG.md updated
- [ ] Version bumped in `package.json`

### Release Commands

```bash
# Bump version
npm version patch  # or minor/major

# Commit and tag
git add -A
git commit -m "chore: v1.4.4"
git tag -a v1.4.4 -m "v1.4.4 - Description"
git push origin main --tags

# CI/CD will handle npm publish via Trusted Publishers
```

### CI/CD Pipeline

```yaml
# .github/workflows/ci-cd.yml
# 1. Test job
# 2. Release job (tag + GitHub Release)
# 3. Publish job (npm via Trusted Publishers OIDC)
```

---

## Troubleshooting

### Extension Won't Load

```bash
# Check syntax
npx tsc --noEmit src/extension.ts

# Check for parse errors
pi -e ./src/extension.ts 2>&1 | head -50
```

### Tests Failing

```bash
# Run single test
npx tsx tests/gentle-extensions.test.ts --test-name-pattern="pattern"

# Debug specific test
node --inspect-brk ./node_modules/.bin/tsx tests/gentle-extensions.test.ts
```

### MCP Issues

```bash
# Check MCP config
cat resources/mcp/*.mcp.json

# Test handshake manually
pi -e "import { performMcpHandshake } from './src/extension.ts'; ..."
```

### Skill Validation Failures

```bash
npm run validate:skills

# Check specific skill
cat resources/skills/my-skill/SKILL.md
```

---

## Useful Commands Summary

```bash
# Development
npm test                    # Run all tests
npm run validate:skills     # Validate all skills
pi -e ./src/extension.ts    # Test extension load

# Testing
npx tsx tests/gentle-extensions.test.ts
npx tsx tests/gentle-extensions.test.ts --test-name-pattern="pattern"

# Debugging
DEBUG=* pi -e ./src/extension.ts

# Release
npm version patch
git push origin main --tags
```

---

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [Pi Extensions API](https://pi.dev/docs/latest/extensions)
- [Gentle Pi Documentation](https://github.com/Gentleman-Programming/gentle-shell)
- [MCP Specification](https://modelcontextprotocol.io/specification)