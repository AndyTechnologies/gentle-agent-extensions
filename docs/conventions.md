# Declarative Conventions for gentle-agent-extensions

This document defines the file structure and conventions for extending Gentle AI and Gentle Pi through this project.

## Directory Structure

```
gentle-agent-extensions/
├── agents/              # Custom agent definitions (Markdown with YAML frontmatter)
├── routing/             # Routing instructions for custom agents
├── overlays/            # Instruction overlays for orchestrator and existing agents
├── skills/              # Project skills for agent programming
├── mcp/                 # MCP server definitions (JSON)
├── scripts/             # Installation and synchronization scripts
├── tests/               # Automated tests
├── assets/              # Templates, schemas, examples
├── docs/                # Documentation
└── .manifest.json       # Track project-owned files
```

## 1. Agent Definitions (`agents/`)

Custom agents follow Gentle Pi's native agent format: Markdown files with YAML frontmatter.

### File Naming

```
agents/{agent-name}.md
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

### Discovery

Agents are discovered by Gentle Pi from:
- Global: `~/.pi/agent/agents/`, `~/.pi/agent/subagents/`
- Project: `<cwd>/.pi/agents/`, `<cwd>/.pi/subagents/`

This project's `sync.sh` will symlink or copy agents from `agents/` to the appropriate project directory.

## 2. Routing Instructions (`routing/`)

Routing instructions tell the orchestrator when to delegate to a custom agent.

### File Naming

```
routing/{agent-name}.md
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

## 3. Overlays (`overlays/`)

Overlays add instructions to existing agents or the orchestrator without modifying their original definitions.

### File Naming

```
overlays/{target-name}.overlay.md
```

Where `{target-name}` is either:
- An agent name (e.g., `gentle-ai-worker.overlay.md`)
- `orchestrator` for orchestrator-level overlays

### Format

```markdown
---
target: {agent-name|orchestrator}
priority: 100              # optional, higher = applied later
mode: append               # currently only 'append' is supported
---

# Overlay for {target-name}

## Additional Instructions

[Instructions to append to the target's prompt]
```

### Application Mechanism

Overlays are applied via the `before_agent_start` event by mutating `systemPromptOptions.appendSystemPrompt`. This follows Gentle Pi's established pattern (see `lib/append-system-prompt.ts`).

## 4. Skills (`skills/`)

Skills follow the Gentle AI skill format with required sections:

```
skills/{skill-name}/
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

## 5. Installation Profiles

The project supports multiple installation targets:

| Profile | Agent Home | Use Case |
|---------|------------|----------|
| `pi` | `~/.pi/agent` | Standard Pi installation |
| `gentle-shell` | `~/.local/share/gentle-shell/agent` | Isolated Gentle Shell |
| `gentle-shell-linked` | `~/.pi/agent` | Gentle Shell with `--link` |

## 6. Sync Behavior

`sync.sh` performs:
1. Detect declared features (agents, routing, overlays, skills, mcp)
2. Validate metadata and files
3. Resolve native agent/skill paths for the target profile
4. Install/update only project-owned files
5. Update skill registry via official mechanism
6. Prepare orchestrator routing context
7. Validate overlays, detect conflicts
8. Update manifest
9. Report issues requiring intervention

Idempotent: repeated runs with same config produce no changes.

## 7. MCP Server Definitions (`mcp/`)

MCP servers are defined as JSON files in the `mcp/` directory. Each file defines one server.

### File Naming

```
mcp/{server-name}.mcp.json
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

### Discovery

The extension discovers `*.mcp.json` files in `mcp/` on `session_start` and registers them via `pi.registerMcpServer()`.

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

The orchestrator overlay includes available MCP servers and their capabilities.

## 8. Manifest Format

`.manifest.json` tracks project-owned files:

```json
{
  "version": "1.0",
  "managedPaths": {
    "extensions": [".pi/extensions/gentle-agent-extensions.ts"],
    "agents": [".pi/agents/custom-agent.md"],
    "routing": [".pi/routing/custom-agent.md"],
    "overlays": [".pi/overlays/orchestrator.overlay.md"],
    "skills": ["skills/custom-skill/SKILL.md"],
    "mcp": ["mcp/server.mcp.json"],
    "scripts": ["scripts/sync.sh"],
    "assets": []
  },
  "installProfiles": {
    "pi": { "agentHome": "~/.pi/agent" },
    "gentle-shell": { "agentHome": "~/.local/share/gentle-shell/agent" }
  }
}
```