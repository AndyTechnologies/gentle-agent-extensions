# Architecture Overview

## System Components

```
gentle-agent-extensions/
├── src/extension.ts                 # Main Pi extension entry point
├── resources/
│   ├── agents/                      # Bundled agents (.md)
│   ├── overlays/                    # Bundled overlays (.overlay.md)
│   ├── skills/                      # Bundled skills (directories with SKILL.md)
│   ├── routing/                     # Routing rules (.md)
│   └── mcp/                         # MCP server definitions (future)
├── scripts/validate-skills.ts       # Skill quality validator
├── tests/gentle-extensions.test.ts  # Unit tests
├── docs/                            # Documentation
├── package.json                     # Package manifest
├── CHANGELOG.md                     # Changelog
└── README.md
```

## Core Architecture

### Extension Entry Point (`src/extension.ts`)

The extension is a Pi extension that hooks into Pi's event system:

```typescript
export default function gentleAgentExtensions(pi: ExtensionAPI): void {
    // Session start: initialize resources, copy agents, register MCPs
    pi.on("session_start", async (_event, ctx) => { ... });

    // Before agent starts: apply overlays, inject routing
    pi.on("before_agent_start", (event, ctx) => { ... });

    // Register slash commands
    pi.registerCommand("gentle-extensions:status", { ... });
    pi.registerCommand("gentle-extensions:doctor", { ... });
    // ... more commands
}
```

**Key Events:**
1. `session_start` - Initialize bundled state, copy agents, register MCPs
2. `before_agent_start` - Apply overlays, inject routing instructions

### Resource Bundling

All resources are bundled under `resources/` and loaded at runtime using `import.meta.url`:

```typescript
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLED = {
    agents: join(PACKAGE_ROOT, "resources", "agents"),
    overlays: join(PACKAGE_ROOT, "resources", "overlays"),
    routing: join(PACKAGE_ROOT, "resources", "routing"),
    mcp: join(PACKAGE_ROOT, "resources", "mcp"),
};
```

### Project State

```typescript
interface ProjectState {
    routing: Map<string, RoutingDefinition>;
    overlays: Map<string, OverlayDefinition[]>;
    agents: Set<string>;
    mcpServers: Map<string, McpServerDefinition>;
    initialized: boolean;
}
```

---

## Resource Types

### Agents (`resources/agents/`)
Markdown files with YAML frontmatter defining Pi agents.

```markdown
---
name: architecture-council
description: "Read-only contractual verifier for Architecture Quest contracts"
model: anthropic/claude-opus-4
thinking: high
mode: task
tools: [read, grep, find, bash]
---
# Agent Instructions
```

### Overlays (`resources/overlays/`)
Instruction overlays applied to agents/orchestrator via `before_agent_start`.

```markdown
---
target: orchestrator
priority: 100
mode: append
---
# Additional Instructions for orchestrator
```

**Modes:**
- `append` (default) - Add after existing prompt
- `prepend` - Add before existing prompt
- `replace` - Replace entire prompt

---

### Skills (`resources/skills/`)
Directories containing `SKILL.md` with full skill definition.

```
skills/
├── architecture-quest/
│   └── SKILL.md
├── product-quest/
│   └── SKILL.md
└── ...
```

**SKILL.md Structure:**
```markdown
---
name: skill-name
description: "Trigger: trigger phrases. One-line description."
license: Apache-2.0
metadata:
  author: AuthorName
  version: "1.0"
  "disable-model-invocation": true  # optional, for user-invoked only
---

# Skill Name

## Activation Contract
When to use / when NOT to use

## Hard Rules
| Rule | Description |

## Decision Gates
| Situation | Action |

## Execution Steps
1. Step 1
2. Step 2

## Output Contract
What the agent should produce

## References
- Local file paths
```

---

### Routing (`resources/routing/`)
Defines when to delegate to agents.

```markdown
---
agent: architecture-council
triggers:
  - "verify architectural contract"
  - "architecture council"
conditions:
  - "file:resources/agents/architecture-council.md"
  - "env:ODD_ACTIVE=true"
delegation: subagent_run
requiredSkills:
  - architecture-quest
requiredMcp: []
priority: 100
---
```

**Fields:**
- `agent` - Target agent name
- `triggers` - Phrases that trigger delegation
- `conditions` - Must all be true (file:, env:, branch:)
- `delegation` - `subagent_run` or `subagent_run_background`
- `requiredSkills` - Skills to load before delegation
- `requiredMcp` - MCP servers required
- `priority` - Higher = earlier evaluation

---

### MCP Servers (`resources/mcp/`)
JSON definitions for MCP servers (future).

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
  "install": { "package": "@pkg/server", "version": "1.0.0", "manager": "npx" },
  "agentDependencies": ["agent-name"]
}
```

---

## Key Subsystems

### 1. Resource Graph Validator
Builds dependency graph of all resources, detects:
- Missing references
- Unregistered agents
- Orphan overlays
- Inconsistent MCP dependencies
- Duplicate names
- Circular references
- Missing manifest

**Output:** GraphViz DOT + human-readable summary

### 2. Routing Engine
Evaluates triggers + conditions, returns sorted routes by priority.

```typescript
function evaluateRouting(agentName: string, ctx?: { cwd?, env? }): RoutingDefinition[]
```

**Condition Types:**
| Prefix | Example | Meaning |
|--------|---------|---------|
| `file:` | `file:resources/agents/foo.md` | File exists |
| `env:` | `env:ODD_ACTIVE=true` | Env var equals value |
| `branch:` | `branch:main` | Current git branch |

---

### 3. MCP Lifecycle Manager
Manages MCP server lifecycle with persistent state.

**States:** `available` | `disabled` | `failed` | `not_installed` | `installing` | `updating`

**State File:** `.gentle-agent-extensions/mcp-state.json`

**Commands:**
- `mcp-install` - Explicit install with auth
- `mcp-uninstall` - Explicit uninstall
- `mcp-status` - Lifecycle status
- `mcp-health` - Real MCP handshake
- `mcp-logs` - Logs (stub)

**Auto-detection:** npm, uv, pip, cargo

---

### 4. Resource Graph Validator
Validates entire resource ecosystem:

1. **Agents** → Skills, Routing
2. **Skills** → References, Dependencies
3. **Routing** → Agents, Skills, MCP
4. **Overlays** → Target agents
5. **MCP** → Agent dependencies, Install config
6. **Manifest** → Existence

**Detects:**
- Missing references
- Unregistered agents
- Orphan overlays
- Inconsistent MCP deps
- Duplicate names
- Circular references
- Missing manifest

---

### 5. Conflict Detection
3-way diff for agent files:

```bash
# bundled vs local vs user-modified
gentle-extensions:conflicts
```

**Conflict Resolution:**
- `synced` - Identical to bundled
- `skipped` - Local identical to bundled
- `conflicts` - User modified, differs from bundled

---

### 6. MCP Lifecycle Manager
Class `McpLifecycleManager` with persistent state.

**Features:**
- State persistence (`.gentle-agent-extensions/mcp-state.json`)
- Auto-detection of installed versions
- Allow-list for managers/packages
- Explicit install/uninstall with auth
- Health checks (stdio/HTTP handshake)
- Status reporting

---

## Data Flow

```
User Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Pi Session Start                          │
├─────────────────────────────────────────────────────────────┤
│  1. initializeBundledState()                                 │
│     - discoverBundledAgents()                                │
│     - loadBundledOverlays()                                  │
│     - loadBundledMcpServers()                                │
│     - loadBundledRouting()                                   │
│     - loadBundledSkills()                                    │
│     - mcpLifecycleManager.loadProjectState(cwd)             │
│     - copyBundledAgentsToProject()                          │
│     - registerBundledMcpServers()                           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│              before_agent_start (per agent)                  │
├─────────────────────────────────────────────────────────────┤
│  1. Apply overlays (orchestrator + agent-specific)          │
│  2. Inject MCP instructions to orchestrator                 │
│  3. Evaluate routing for agent                              │
│  4. Inject delegation instructions                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Command Execution                         │
├─────────────────────────────────────────────────────────────┤
│  /gentle-extensions:* commands                              │
│  Quest delegations (architecture-quest, product-quest)      │
│  Council/Verifier delegations                               │
│  MCP operations (install, health, status)                   │
│  Diagnostic commands (doctor, resources, routing, etc.)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Extension Configuration

### `package.json` (pi section)
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

### `extension.config.json` (optional)
```json
{
  "features": { "autoSync": true, "versionTracking": true },
  "validation": { "requireLicense": true, "allowUnknownTargets": true },
  "mcpDefaults": { "timeout": 60, "exposure": "codemode" }
}
```

---

## Security Considerations

1. **No tokens in code** - `gh` manages auth, MCP uses OIDC
2. **Allow-lists** - MCP managers/packages restricted
3. **No shell injection** - `spawnSync` with arrays, no `shell: true`
3. **Read-only agents** - Council, Verifier are read-only
4. **Explicit authorization** - MCP install requires user consent
5. **Conflict detection** - Never overwrite user modifications silently

---

## Testing Architecture

```
tests/
└── gentle-extensions.test.ts
    ├── Package structure (7 tests)
    ├── Bundled resources validation (15 tests)
    ├── Extension parsing utilities (5 tests)
    └── Extension load test (1 test)
```

**Run:** `npx tsx tests/gentle-extensions.test.ts`

---

## Deployment

### npm Publish
```bash
npm version patch  # or minor/major
git push origin main --tags
npm publish --access public
```

### CI/CD (`.github/workflows/ci-cd.yml`)
- Test job (Node 24, npm ci, npm test)
- Release job (tag + GitHub Release)
- Publish job (Trusted Publishers OIDC, Node 24, npm 11.5.1+)

---

## Versioning

**Semantic Versioning 2.0.0** + Keep a Changelog format.

| Version | Type | Description |
|---------|------|-------------|
| v1.4.3 | Patch | Diagnostic & Observability |
| v1.4.2 | Patch | Skill Quality Validator |
| v1.4.1 | Patch | Product Contract Verifier |
| v1.4.0 | Minor | Epics 1-3 (Graph, Routing, MCP) |

---

## References

- [Pi Extensions API](https://pi.dev/docs/latest/extensions)
- [Gentle Pi Documentation](https://github.com/Gentleman-Programming/gentle-shell)
- [Gentle AI Skill Style Guide](https://github.com/Gentleman-Programming/gentle-pi/blob/main/docs/skill-style-guide.md)