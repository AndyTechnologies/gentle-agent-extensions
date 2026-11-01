# gentle-agent-extensions

**Bundled extensions for Gentle Shell** — Install once, get architecture-quest, architecture-council, orchestrator overlay, and gentle-agent-extension skill automatically. No configuration needed.

## What This Package Provides

| Resource | Description |
|----------|-------------|
| **architecture-council** agent | Read-only contractual verifier for Architecture Quest contracts |
| **architecture-quest** skill | Explores architectural needs, identifies gaps, produces verifiable contracts |
| **gentle-agent-extension** skill | Teaches how to extend this package (for maintainers) |
| **orchestrator.overlay.md** | Integrates Quest + Council into ODD workflow before RDD review |
| **architecture-council routing** | Semantic delegation rules for the council agent |

## What This Package Does NOT Do

- ❌ Require user project directories (`agents/`, `overlays/`, `skills/`)
- ❌ Need `sync.sh`, `doctor.sh`, `install.sh` scripts (removed)
- ❌ Modify Gentle AI or Gentle Pi official repositories
- ❌ Create parallel agent registries or skill indexes

---

## Installation

### From npm (recommended)
```bash
pi install npm:gentle-agent-extensions@latest
```

### From Git
```bash
pi install git:github.com/AndyTechnologies/gentle-agent-extensions@v1.2.0
```

### Local development
```bash
pi install ./gentle-agent-extensions
# Or for testing without installing:
pi -e ./src/extension.ts
```

**That's it.** No scripts, no sync, no doctor. Open Pi and everything works.

---

## Usage

### Automatic on Session Start

When you open Pi, the extension:
1. Copies bundled agents to your project's `.pi/agents/`
2. Registers bundled MCP servers (when added)
3. Applies bundled overlays to orchestrator and agents
4. Skills are auto-registered via `pi.skills`

### Commands (inside Pi)

| Command | Description |
|---------|-------------|
| `/gentle-extensions:status` | Show bundled resources status |
| `/gentle-extensions:sync` | Re-sync bundled agents to current project |
| `/gentle-extensions:doctor` | Validate bundled resources + installation |
| `/gentle-extensions:mcp-reload` | Reload MCP servers from bundled resources |
| `/gentle-extensions:fix` | Auto-fix non-destructive issues |
| `/gentle-extensions:mcp-health` | Test MCP connectivity (stdio + HTTP) |
| `/gentle-extensions:conflicts` | Interactive conflict resolution |

### Delegation

```bash
# Architecture Council - verify architectural contract
"Use architecture-council to verify AC-01"

# Architecture Quest - explore architectural decisions
"Run architecture quest for this feature"
```

### Skills

Skills are auto-available via `/skill-registry:refresh`:
- `architecture-quest` — Architectural exploration
- `gentle-agent-extension` — Package maintainer guide

---

## Architecture

```
~/.pi/agent/npm/node_modules/gentle-agent-extensions/   ← Installed package (read-only)
├── src/extension.ts                                     ← Pi extension entry point
├── resources/
│   ├── agents/architecture-council.md                   ← Bundled agent
│   ├── overlays/orchestrator.overlay.md                 ← Bundled overlay
│   ├── skills/
│   │   ├── architecture-quest/SKILL.md                  ← Bundled skill
│   │   └── gentle-agent-extension/SKILL.md              ← Bundled skill
│   ├── routing/architecture-council.md                  ← Bundled routing
│   └── mcp/                                             ← Bundled MCPs (future)
├── package.json                                         ← pi: {extensions, skills}
└── README.md
```

### How It Works

1. **`pi install`** downloads package to `~/.pi/agent/npm/node_modules/gentle-agent-extensions/`
2. **Pi loads** `src/extension.ts` via `pi.extensions` in package.json
3. **`session_start`**: Extension reads bundled resources from `resources/` (using `import.meta.url`)
4. **`before_agent_start`**: Applies overlays, injects MCP info to orchestrator
5. **Skills** loaded via `pi.skills: ["resources/skills/*"]` in package.json

---

## For Package Maintainers

### Adding a New Bundled Agent

```bash
# 1. Create agent in resources/agents/
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

# 2. Add routing in resources/routing/
cat > resources/routing/my-agent.md <<'EOF'
---
agent: my-agent
triggers: ["trigger phrase"]
delegation: subagent_run
---
EOF

# 3. (Optional) Add skill in resources/skills/
mkdir -p resources/skills/my-agent
cat > resources/skills/my-agent/SKILL.md <<'EOF'
---
name: my-agent
description: "Trigger: trigger phrase. Delegates to my-agent."
license: Apache-2.0
metadata:
  author: AndyTechnologies
  version: "1.0"
---
# My Agent Skill
## Activation Contract
Use when...
## Hard Rules
- Only delegate via subagent_run to my-agent
## Decision Gates
| Situation | Action |
| "trigger phrase" | Delegate to my-agent |
| General coding | Do NOT delegate |
## Execution Steps
1. Call subagent_run with agent=my-agent
2. Return results
## Output Contract
Findings with severity
## References
- resources/agents/my-agent.md
- resources/routing/my-agent.md
EOF
```

### Adding a Bundled Overlay

```bash
cat > resources/overlays/target-agent.overlay.md <<'EOF'
---
target: target-agent
priority: 100
mode: append
---
# Additional Instructions for target-agent
EOF
```
Modes: `append` (default), `prepend`, `replace`

### Adding a Bundled MCP Server

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

### Test Locally

```bash
# Test without installing
pi -e ./src/extension.ts

# In Pi:
/gentle-extensions:status
/gentle-extensions:doctor
```

### Publish

```bash
npm version patch  # or minor/major
git push origin main --tags
npm publish --access public
```

---

## Configuration

### `extension.config.json` (optional)

Override defaults in the package root:

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

### Peer Dependencies

Pinned to Pi 1.4.0 compatible versions:

```json
"peerDependencies": {
  "@earendil-works/pi-coding-agent": "^1.4.0",
  "@earendil-works/pi-agent-core": "^1.4.0",
  "@earendil-works/pi-ai": "^1.4.0",
  "@earendil-works/pi-tui": "^1.4.0",
  "typebox": "^0.30.0"
}
```

---

## Development

### Run Tests

```bash
# Unit tests (fast)
node --test tests/gentle-extensions.test.ts

# Integration tests (slow, spawns Pi)
node --test tests/integration.test.ts
```

### Test Without Installing

```bash
pi -e ./src/extension.ts
# Then in Pi:
/gentle-extensions:status
```

---

## Compatibility

- Pi 1.4.0+
- gentle-pi 4.5.1+ (bundled in Gentle Shell)
- gentle-ai (bundled)

---

## License

Apache-2.0 — see LICENSE file.

## References

- [Gentle Pi Documentation](https://github.com/Gentleman-Programming/gentle-shell)
- [Pi Extensions API](https://pi.dev/docs/latest/extensions)
- [Pi Packages](https://pi.dev/docs/latest/packages)
- [Gentle AI Skill Style Guide](https://github.com/Gentleman-Programming/gentle-pi/blob/main/docs/skill-style-guide.md)

---

<div align="center">

![Built with Gentle-AI](https://img.shields.io/badge/Built%20with-Gentle--AI-F095C8?style=for-the-badge&labelColor=1A1218)

</div>