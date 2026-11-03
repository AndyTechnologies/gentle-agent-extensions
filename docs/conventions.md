# Declarative Conventions for gentle-agent-extensions

This document defines the file structure and conventions for extending Gentle AI and Gentle Pi through this project.

## Directory Structure

```
gentle-agent-extensions/
├── src/extension.ts          # Pi extension entry point
├── resources/
│   ├── agents/               # Custom agent definitions (Markdown with YAML frontmatter)
│   ├── routing/              # Routing instructions for custom agents
│   ├── overlays/             # Instruction overlays for orchestrator and existing agents
│   ├── skills/               # Project skills for agent programming
│   └── mcp/                  # MCP server definitions (JSON) — optional
├── tests/                    # Automated tests
├── assets/                   # Templates, schemas, examples
├── docs/                     # Documentation
├── package.json
├── CHANGELOG.md
├── README.md
└── extension.config.json
```

> **Note:** The old structure with `agents/`, `routing/`, `overlays/`, `skills/`, `scripts/`, `mcp/` at project root has been replaced by the bundled structure under `resources/`. The extension loads resources from `resources/` using `import.meta.url`.

## 1. Agent Definitions (`resources/agents/`)

Custom agents follow Gentle Pi's native agent format: Markdown files with YAML frontmatter.

### File Naming

```
resources/agents/{agent-name}.md
```

### Frontmatter Schema

```yaml
---
name: {agent-name}
description: "One-line description of when this agent should be used"
model: {provider/model}          # optional, e.g. "anthropic/claude-opus-4"
thinking: {minimal|low|medium|high}  # optional
mode: {task|background}           # optional, default: task
tools: [tool1, tool2, ...]        # optional, defaults to Pi defaults
---
```

### Body

The body contains the agent's instructions/prompt. This follows the same format as Gentle AI's agent definitions.

### Discovery & Sync

Agents are discovered by Gentle Pi from:
- Global: `~/.pi/agent/agents/`, `~/.pi/agent/subagents/`
- Project: `<cwd>/.pi/agents/`, `<cwd>/.pi/subagents/`

The extension's `session_start` handler copies bundled agents from `resources/agents/` to the project's `.pi/agents/` directory (see `copyBundledAgentsToProject()` in `src/extension.ts`).

## 2. Routing Instructions (`resources/routing/`)

Routing instructions tell the orchestrator when to delegate to a custom agent.

### File Naming

```
resources/routing/{agent-name}.md
```

### Format

```markdown
---
agent: {agent-name}
triggers:
  - "trigger phrase 1"
  - "trigger phrase 2"
conditions:
  - "condition description"
delegation: subagent_run
---

# Routing Instructions for {agent-name}

## When to Use

[Description of when this agent should be delegated to]

## How to Delegate

Use the `subagent_run` tool with:
- `agent`: "{agent-name}"
- `task`: "[specific task description]"
- `label`: "[3-6 word label]"
- `mode`: "task" | "background"
```

### Skill Integration

Each agent that needs semantic routing should have an associated skill in `skills/` with an explicit Activation Contract.

The extension loads routing files via `loadBundledRouting()` and makes them available to the orchestrator overlay.

## 3. Overlays (`resources/overlays/`)

Overlays add instructions to existing agents or the orchestrator without modifying their original definitions.

### File Naming

```
resources/overlays/{target-name}.overlay.md
```

Where `{target-name}` is either:
- An agent name (e.g., `gentle-ai-worker.overlay.md`)
- `orchestrator` for orchestrator-level overlays

### Format

```markdown
---
target: {agent-name|orchestrator}
priority: 100              # optional, higher = applied later
mode: append               # optional: append (default), prepend, or replace
---

# Overlay for {target-name}

## Additional Instructions

[Instructions to apply to the target's prompt based on mode]
```

### Application Mechanism

Overlays are applied via the `before_agent_start` event. The behavior depends on the `mode`:
- **append** (default): Adds instructions after the existing system prompt via `systemPromptOptions.appendSystemPrompt`
- **prepend**: Adds instructions before the existing system prompt
- **replace**: Replaces the entire system prompt with the overlay instructions

This follows Gentle Pi's established pattern (see `lib/append-system-prompt.ts`).

The extension loads overlays via `loadBundledOverlays()` and applies them in `before_agent_start`.

## 4. Skills (`resources/skills/`)

Skills follow the Gentle AI skill format with required sections:

```
resources/skills/{skill-name}/
├── SKILL.md
├── assets/       # optional
└── references/   # optional
```

### Required SKILL.md Sections

1. **Activation Contract** - When to use this skill
2. **Hard Rules** - Constraints and restrictions
3. **Decision Gates** - Decision tables for choices
4. **Execution Steps** - Step-by-step procedures
5. **Output Contract** - What the agent should produce
6. **References** - Local file paths

### Discovery

Skills are registered via `pi.skills: ["resources/skills/*"]` in `package.json`. The extension auto-refreshes the skill registry on `session_start`.

## 5. MCP Server Definitions (`resources/mcp/`) — Optional

MCP servers are defined as JSON files in the `mcp/` directory. Each file defines one server.

### File Naming

```
resources/mcp/{server-name}.mcp.json
```

### Schema

```json
{
  "name": "server-name",
  "description": "What this server provides",
  "transport": "stdio|http",
  "command": "npx",
  "args": ["-y", "@pkg/server"],
  "url": "https://example.com/mcp",
  "env": {"KEY": "${ENV_VAR}"},
  "exposure": "codemode",
  "toolExposure": {},
  "enabled": true,
  "timeout": 60,
  "install": {
    "package": "@pkg/server",
    "version": "1.0.0",
    "manager": "npx"
  },
  "auth": {
    "type": "oauth|bearer|none",
    "envVar": "TOKEN_ENV_VAR",
    "description": "OAuth flow or bearer token"
  },
  "capabilities": ["tools", "resources"],
  "agentDependencies": ["agent-name"]
}
```

### Field Descriptions

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (letters, digits, `_`, `-` only) |
| `description` | Yes | One-line description for system prompt |
| `transport` | Yes | `stdio` or `http` (streamable HTTP) |
| `command` | stdio only | Executable (not shell command) |
| `args` | stdio only | Array of arguments |
| `url` | http only | Server URL |
| `env` | No | Environment variables; use `${VAR}` for substitution |
| `exposure` | No | Tool exposure: `codemode` (default), `direct`, `deferred`, `hidden` |
| `toolExposure` | No | Per-tool exposure overrides |
| `enabled` | No | Default `true`; `false` keeps entry without connecting |
| `timeout` | No | Per-request timeout in seconds (default 60) |
| `install` | No | Installation metadata for optional auto-install |
| `auth` | No | Authentication requirements (no secrets in repo) |
| `capabilities` | No | Declared: `tools`, `resources` |
| `agentDependencies` | No | List of agent names that need this server |

### Discovery & Registration

The extension discovers `*.mcp.json` files in `resources/mcp/` on `session_start` and registers them via `pi.registerMcpServer()`.

### Agent MCP Dependencies

Agents can declare MCP dependencies in their routing files:

```markdown
---
agent: my-agent
mcpDependencies:
  - github
  - filesystem
---
```

The orchestrator overlay includes available MCP servers and their capabilities. The doctor command validates that declared dependencies exist.

## 6. Extension Configuration

`extension.config.json` (optional) at package root:

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

## 7. Peer Dependencies

Pinned in `package.json`:

```json
"peerDependencies": {
  "@earendil-works/pi-coding-agent": "^1.5.0",
  "@earendil-works/pi-agent-core": "^1.5.0",
  "@earendil-works/pi-ai": "^1.5.0",
  "@earendil-works/pi-tui": "^1.5.0",
  "typebox": "^1.4.0"
}
```

## 8. Testing

```bash
# Unit tests
npx tsx tests/gentle-extensions.test.ts
```

Tests validate:
- Package structure and resource presence
- Frontmatter and required sections
- Extension parsing utilities
- Extension load without errors

## 9. Publishing

```bash
npm version patch  # or minor/major
git push origin main --tags
npm publish --access public
```

The CI/CD workflow (`.github/workflows/ci-cd.yml`) runs tests, creates GitHub releases on version bump, and publishes to npm via Trusted Publishers (OIDC).