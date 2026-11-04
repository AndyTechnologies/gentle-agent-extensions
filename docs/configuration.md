# Configuration Guide

## Overview

gentle-agent-extensions can be configured through multiple mechanisms:

1. **Package.json** - Core extension manifest
2. **extension.config.json** - Optional runtime configuration
3. **Environment variables** - Runtime overrides
4. **Resource files** - Bundled agents, skills, overlays, routing

---

## Package.json Configuration

### Core pi Section

```json
{
  "pi": {
    "extensions": ["src/extension.ts"],
    "skills": ["resources/skills/*"],
    "prompts": [],
    "themes": [],
    "changelogPath": "CHANGELOG.md"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `extensions` | Yes | Entry point(s) for Pi extension |
| `skills` | Yes | Glob pattern for skill directories |
| `prompts` | No | Prompt templates (unused) |
| `themes` | No | UI themes (unused) |
| `changelogPath` | No | Path to CHANGELOG.md for Pi UI |

### Files Section

```json
{
  "files": [
    "src/",
    "resources/",
    "CHANGELOG.md"
  ]
}
```

### Peer Dependencies

```json
{
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "^1.5.0",
    "@earendil-works/pi-agent-core": "^1.5.0",
    "@earendil-works/pi-ai": "^1.5.0",
    "@earendil-works/pi-tui": "^1.5.0",
    "typebox": "^1.4.0"
  }
}
```

---

## extension.config.json (Optional)

Create `extension.config.json` in package root for runtime configuration:

```json
{
  "features": {
    "autoSync": true,
    "versionTracking": true
  },
  "validation": {
    "requireLicense": true,
    "allowUnknownTargets": true
  },
  "mcpDefaults": {
    "timeout": 60,
    "exposure": "codemode"
  }
}
```

### Feature Flags

| Option | Default | Description |
|--------|---------|-------------|
| `autoSync` | `true` | Auto-sync agents on session start |
| `versionTracking` | `true` | Track version in state |

### Validation

| Option | Default | Description |
|--------|---------|-------------|
| `requireLicense` | `true` | Require license field in skills/agents |
| `allowUnknownTargets` | `true` | Allow overlay targets not in bundled agents |

### MCP Defaults

| Option | Default | Description |
|--------|---------|-------------|
| `timeout` | `60` | MCP connection timeout (seconds) |
| `exposure` | `codemode` | Tool exposure level |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GENTLE_PI_AGENT_HOME` | Custom agent home directory |
| `PI_CODING_AGENT_DIR` | Pi coding agent directory |
| `ENGRAM_BIN` | Engram binary path (for memory) |
| `GH_TOKEN` | GitHub token (for CI) |
| `NPM_TOKEN` | npm token (for CI publish) |

---

## Resource Configuration

### Agents (`resources/agents/*.md`)

```markdown
---
name: agent-name
description: "One-line description"
model: anthropic/claude-opus-4
thinking: high
mode: task
tools: [read, write, bash]
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique agent identifier |
| `description` | Yes | When to use this agent |
| `model` | No | LLM model (default: Pi default) |
| `thinking` | No | Thinking level: minimal/low/medium/high |
| `mode` | No | `task` or `background` |
| `tools` | No | Tool allowlist |

### Skills (`resources/skills/*/SKILL.md`)

```markdown
---
name: skill-name
description: "Trigger: trigger phrases. One-line description."
license: Apache-2.0
metadata:
  author: AuthorName
  version: "1.0"
  "disable-model-invocation": true  # optional
---

# Skill Name

## Activation Contract
...

## Hard Rules
...

## Decision Gates
...

## Execution Steps
...

## Output Contract
...

## References
...
```

### Required Frontmatter Fields
| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill identifier (matches directory) |
| `description` | Yes | Must contain "Trigger:" |
| `license` | Yes | SPDX license identifier |
| `metadata.author` | Yes | Author name |
| `metadata.version` | Yes | Semantic version |
| `disable-model-invocation` | No | If true, user-invoked only |

### Overlays (`resources/overlays/*.overlay.md`)

```markdown
---
target: orchestrator|agent-name
priority: 100
mode: append|prepend|replace
---
# Additional instructions
```

| Field | Required | Description |
|-------|----------|-------------|
| `target` | Yes | `orchestrator` or agent name |
| `priority` | No | Higher = later application (default: 100) |
| `mode` | No | `append` (default), `prepend`, `replace` |

### Routing (`resources/routing/*.md`)

```markdown
---
agent: target-agent
triggers:
  - "trigger phrase 1"
  - "trigger phrase 2"
conditions:
  - "file:path/to/file.md"
  - "env:VAR_NAME=value"
  - "branch:main"
delegation: subagent_run
requiredSkills:
  - skill-name
requiredMcp:
  - mcp-server-name
priority: 100
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `agent` | Yes | Target agent name |
| `triggers` | Yes | Array of trigger phrases |
| `conditions` | No | Array of conditions (file:, env:, branch:) |
| `delegation` | No | `subagent_run` or `subagent_run_background` |
| `requiredSkills` | No | Skills to load before delegation |
| `requiredMcp` | No | MCP servers required |
| `priority` | No | Higher = earlier (default: 100) |

**Condition Types:**
| Prefix | Example | Meaning |
|--------|---------|---------|
| `file:` | `file:path/to/file` | File exists |
| `env:` | `env:VAR=value` | Env var equals value |
| `branch:` | `branch:main` | Current git branch |

### MCP Servers (`resources/mcp/*.mcp.json`)

```json
{
  "name": "server-name",
  "description": "What this server provides",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@pkg/server"],
  "env": { "API_KEY": "${API_KEY}" },
  "exposure": "codemode",
  "enabled": true,
  "timeout": 60,
  "install": {
    "package": "@pkg/server",
    "version": "1.0.0",
    "manager": "npm"
  },
  "auth": {
    "type": "oauth",
    "envVar": "API_KEY",
    "description": "OAuth flow"
  },
  "capabilities": ["tools", "resources"],
  "agentDependencies": ["agent-name"]
}
```

---

## MCP Lifecycle Configuration

### McpLifecycleConfig

```typescript
interface McpLifecycleConfig {
  autoInstall: boolean;
  allowList: {
    managers: string[];
    packages: Record<string, string[]>;
  };
  stateFile: string;
}
```

### Default Configuration

```json
{
  "autoInstall": false,
  "allowList": {
    "managers": ["npm", "uv", "pip", "cargo"],
    "packages": {
      "npm": ["*"],
      "uv": ["*"],
      "pip": ["*"],
      "cargo": ["*"]
    }
  },
  "stateFile": ".gentle-agent-extensions/mcp-state.json"
}
```

### Customizing Allow-List

In `extension.config.json`:

```json
{
  "mcpDefaults": {
    "allowList": {
      "managers": ["npm", "uv"],
      "packages": {
        "npm": ["@modelcontextprotocol/*", "github"],
        "uv": ["*"]
      }
    }
  }
}
```

---

## Skill Development

### Creating a New Skill

```bash
mkdir -p resources/skills/my-skill
cat > resources/skills/my-skill/SKILL.md <<'EOF'
---
name: my-skill
description: "Trigger: my trigger. What this skill does."
license: Apache-2.0
metadata:
  author: AndyTechnologies
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

### Skill Checklist

- [ ] Frontmatter with all required fields
- [ ] All 6 required sections present
- [ ] Name matches directory name
- [ ] Description contains "Trigger:"
- [ ] References section with valid paths
- [ ] No circular dependencies
- [ ] `disable-model-invocation: true` if user-invoked only

---

## CI/CD Configuration

### GitHub Actions (`.github/workflows/ci-cd.yml`)

```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: write
  id-token: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci
      - run: npm test

  release:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Get version
        id: pkg
        run: echo "version=$(node -p \"require('./package.json').version\")" >> $GITHUB_OUTPUT
      - name: Create tag and release
        if: ${{ steps.tag-check.outputs.exists == 'false' && steps.release-check.outputs.exists == 'false' }}
        run: |
          git tag "v${{ steps.pkg.outputs.version }}"
          git push origin "v${{ steps.pkg.outputs.version }}"
          gh release create "v${{ steps.pkg.outputs.version }}" --generate-notes
        env: { GH_TOKEN: ${{ github.token }} }

  publish-npm:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v6
        with: { node-version: '24', registry-url: 'https://registry.npmjs.org', cache: 'npm' }
      - name: Upgrade npm
        run: npm install --global 'npm@^11.5.1'
      - name: Check version
        id: pkg
        run: |
          VERSION=$(node -p "require('./package.json').version")
          PACKAGE_NAME=$(node -p "require('./package.json').name")
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "name=$PACKAGE_NAME" >> $GITHUB_OUTPUT
      - name: Check npm
        id: npm-check
        run: |
          if npm view "${{ steps.pkg.outputs.name }}@${{ steps.pkg.outputs.version }}" version >/dev/null 2>&1; then
            echo "exists=true" >> $GITHUB_OUTPUT
          else
            echo "exists=false" >> $GITHUB_OUTPUT
          fi
      - run: npm ci
        if: ${{ steps.npm-check.outputs.exists == 'false' }}
      - run: npm test
        if: ${{ steps.npm-check.outputs.exists == 'false' }}
      - name: Publish
        if: ${{ steps.npm-check.outputs.exists == 'false' }}
        run: npm publish --access public
```

---

## MCP Configuration

### Trusted Publishers Setup

1. Go to npm package settings: `https://www.npmjs.com/package/gentle-agent-extensions/settings/trusted-publishers`
2. Add publisher:
   - Provider: GitHub Actions
   - Repository: `AndyTechnologies/gentle-agent-extensions`
   - Workflow: `ci-cd.yml`
   - Environment: (leave empty)
3. Enable `npm publish` permission (not just `npm stage publish`)

### Local Development

```bash
# Test without installing
pi -e ./src/extension.ts

# In Pi:
/gentle-extensions:status
/gentle-extensions:doctor
/gentle-extensions:doctor --graph --dot
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Extension not loading | Check `pi.extensions` in package.json |
| Skills not loading | Verify `pi.skills` glob pattern |
| MCP not registering | Check `registry-url` in setup-node |
| Permission denied on install | Check allow-list in config |
| Circular dependency | Run `/gentle-extensions:doctor --graph` |

### Debug Commands

```bash
# Test extension load
pi -e ./src/extension.ts

# Run tests
npm test

# Validate skills
npm run validate:skills

# Deep doctor
/gentle-extensions:doctor --graph --resources --routing --mcp-health

# Check resource graph
/gentle-extensions:doctor --graph --dot | dot -Tpng > graph.png
```

---

## Performance Tuning

### Extension Load Time

- Lazy-load heavy modules (MCP handshake, GraphViz)
- Cache parsed resources in `projectState`
- Use `projectState.initialized` guard

### Memory

- Clear `projectState` on session end
- Limit MCP state file size
- Cleanup temp files in `runDoctorChecks`

---

## Security Hardening

### MCP Allow-List

```json
{
  "allowList": {
    "managers": ["npm", "uv"],
    "packages": {
      "npm": ["@modelcontextprotocol/*", "github"],
      "uv": ["*"]
    }
  }
}
```

### Token Handling

- Never embed tokens in code
- Use `gh` CLI for GitHub (delegates to `gh auth`)
- Use OIDC for npm (Trusted Publishers)
- Never log tokens or secrets

---

## Maintenance

### Version Bump

```bash
npm version patch  # or minor/major
git push origin main --tags
npm publish --access public
```

### Changelog

Follow [Keep a Changelog](https://keepachangelog.com/) + [SemVer](https://semver.org/):

```markdown
## [1.4.4] - 2026-11-XX

### Added
- New feature X

### Changed
- Improved Y

### Fixed
- Bug Z
```

### Dependency Updates

```bash
npm update
npm audit fix
# Check peer deps compatibility
```

---

## Reference Links

- [Pi Extensions API](https://pi.dev/docs/latest/extensions)
- [Gentle Pi Documentation](https://github.com/Gentleman-Programming/gentle-shell)
- [Gentle AI Skill Style Guide](https://github.com/Gentleman-Programming/gentle-pi/blob/main/docs/skill-style-guide.md)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)