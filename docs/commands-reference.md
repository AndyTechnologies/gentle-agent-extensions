# Commands Reference

## Core Commands

### `/gentle-extensions:status`
Shows current status of all bundled resources.

**Output:**
```
gentle-agent-extensions status:
  Package root: /path/to/package
  Bundled agents: architecture-council
  Bundled overlays: orchestrator
  Bundled skills: present
  Bundled routing: architecture-council
```

**Enhanced output (with MCP lifecycle):**
```
MCP Servers (real-time):
  github: available v1.2.3 (stdio) (checked 30s ago)
  redis: not_installed (stdio)

Routing rules (with conditions/skills/MCP):
  architecture-council: agent=architecture-council, triggers=verify architectural contract, priority=100, skills=architecture-quest, mcp=
```

### `/gentle-extensions:sync`
Syncs bundled agents to project's `.pi/agents/` directory.

**Output:**
```
gentle-extensions:sync
  Synced: architecture-council
  Skipped (identical): none
  Conflicts (user-modified): none
```

### `/gentle-extensions:doctor`
Validates bundled resources, installation, and performs deep diagnostics.

**Basic usage:**
```
/gentle-extensions:doctor
```

**With flags:**
```
/gentle-extensions:doctor --graph          # Resource graph
/gentle-extensions:doctor --graph --dot    # Resource graph + GraphViz DOT
/gentle-extensions:doctor --resources      # Resource conflict detection
/gentle-extensions:doctor --routing        # Routing validation
/gentle-extensions:doctor --mcp-health     # MCP health checks
/gentle-extensions:doctor --graph --resources --routing --mcp-health  # Full deep diagnostic
```

**Output example:**
```
gentle-agent-extensions doctor:

❌ Issues:
  - Extension not installed (run: pi install npm:gentle-agent-extensions...)

⚠️  Warnings:
  - MCP github: not_installed

✅ All checks passed
```

**Graph output (--graph):**
```
Resource Graph Summary
========================

Nodes:
  agent: 1
  skill: 13
  routing: 1
  overlay: 1
  mcp: 2
  manifest: 1
  Total: 21

Edges:
  triggers: 1
  requires: 4
  overlays: 1
  depends: 2
  installs: 2
  Total: 11

✅ No issues detected
```

### `/gentle-extensions:sync`
Syncs bundled agents to current project.

```
gentle-extensions:sync
  Synced: architecture-council
  Skipped (identical): none
  Conflicts (user-modified): none
```

### `/gentle-extensions:fix`
Auto-fixes non-destructive issues (permissions, directories, manifest, overlay modes).

```
gentle-extensions:fix
  applied 2 fix(es)
```

### `/gentle-extensions:fix-destructive`
Auto-fix including destructive actions (requires UI confirmation).

### `/gentle-extensions:mcp-reload`
Reloads MCP servers from bundled resources.

```
MCP servers reloaded from bundled resources
```

### `/gentle-extensions:mcp-health`
Checks MCP server connectivity with real MCP handshake.

```
/gentle-extensions:mcp-health
```

**Output:**
```
MCP Health Check (real handshake):

OK github (stdio): healthy (45ms)
OK redis (stdio): healthy (12ms)
FAIL postgres (http): connection refused

❌ All MCP servers healthy
```

### `/gentle-extensions:mcp-install <server-name>`
Installs an MCP server explicitly (requires user confirmation).

```
/gentle-extensions:mcp-install github
```

### `/gentle-extensions:mcp-uninstall <server-name>`
Uninstalls an MCP server explicitly.

```
/gentle-extensions:mcp-uninstall github
```

### `/gentle-extensions:mcp-status`
Shows MCP servers status (available, disabled, failed, not_installed).

```
/gentle-extensions:mcp-status
```

**Output:**
```
MCP Servers Status:

  github: available v1.2.3 (stdio)
  redis: not_installed (stdio)
  postgres: failed (http) - connection refused
```

### `/gentle-extensions:mcp-logs <server-name>`
Shows MCP server logs (stub - not yet implemented).

```
/gentle-extensions:mcp-logs github
```

### `/gentle-extensions:conflicts`
Shows 3-way diff: bundled vs local vs user-modified resources.

```
/gentle-extensions:conflicts
```

**Output:**
```
Resource Conflicts (3-way diff):

Conflicts (user-modified, differs from bundled):
  architecture-council: bundled=a1b2c3d4 vs local=e5f6g7h8 (DIFFER)
```

### `/gentle-extensions:routing`
Shows routing rules loaded with agents, skills, MCP requirements, conditions, and priorities.

```
/gentle-extensions:routing
```

**Output:**
```
Routing Rules:

## architecture-council
  Agent: architecture-council
  Triggers: verify architectural contract, architecture council, check architecture contract, verify quest contract
  Conditions: file:resources/agents/architecture-council.md, env:ODD_ACTIVE=true
  Required Skills: architecture-quest
  Required MCP: 
  Delegation: subagent_run
  Priority: 100
```

### `/gentle-extensions:doctor --graph`
Generates resource graph with GraphViz DOT output.

```
/gentle-extensions:doctor --graph --dot
```

**Output:**
```
Resource Graph Summary
========================

Nodes:
  agent: 1
  skill: 13
  routing: 1
  overlay: 1
  mcp: 2
  manifest: 1
  Total: 21

Edges:
  triggers: 1
  requires: 4
  overlays: 1
  depends: 2
  installs: 2
  Total: 11

Errors:
  Circular reference detected: routing -> skill -> routing

GraphViz DOT:
digraph ResourceGraph {
  rankdir=LR;
  node [fontname="Arial", fontsize=10];
  edge [fontname="Arial", fontsize=8];

  "agent:architecture-council" [label="architecture-council", shape=box, style=filled, fillcolor="#e8a838", fontcolor="#000000"];
  "skill:architecture-quest" [label="architecture-quest", shape=box, style=filled, fillcolor="#38b8e8", fontcolor="#000000"];
  ...
  "routing:architecture-council" -> "agent:architecture-council" [label="triggers", style=solid];
  ...
}
```

### `/gentle-extensions:resources`
Shows comprehensive resource status.

```
/gentle-extensions:resources
```

**Output:**
```
Resources Status:

Agents:
  Synced: architecture-council
  Skipped (identical): none
  Conflicts (user-modified): none

Skills:
  Bundled: architecture-quest, product-quest, changelog-generator, gentle-ui, github-automation, grilling, grill-me, red-suite-hygiene, ui-design, ui-ux-principles, using-git-worktrees, gentle-agent-extension, skill-quality-validator

Overlays:
  Bundled: orchestrator

MCP Servers:
  github: available v1.2.3 (stdio)
  redis: not_installed (stdio)

Routing:
  architecture-council: agent=architecture-council, triggers=verify architectural contract,architecture council,check architecture contract,verify quest contract, priority=100
```

### `/gentle-extensions:conflicts`
Shows 3-way diff between bundled, local, and user-modified resources.

```
/gentle-extensions:conflicts
```

### `/gentle-extensions:routing`
Shows routing rules with agents, triggers, conditions, required skills/MCP, delegation, and priority.

```
/gentle-extensions:routing
```

### `/gentle-extensions:mcp-health`
Real MCP protocol handshake check.

```
/gentle-extensions:mcp-health
```

### `/gentle-extensions:mcp-status`
Shows MCP server lifecycle status.

```
/gentle-extensions:mcp-status
```

### `/gentle-extensions:mcp-install <server>`
Installs MCP server explicitly.

```
/gentle-extensions:mcp-install github
```

### `/gentle-extensions:mcp-uninstall <server>`
Uninstalls MCP server explicitly.

```
/gentle-extensions:mcp-uninstall github
```

### `/gentle-extensions:mcp-status`
Shows MCP lifecycle status.

```
/gentle-extensions:mcp-status
```

### `/gentle-extensions:mcp-logs <server>`
Shows MCP server logs (stub).

```
/gentle-extensions:mcp-logs github
```

### `/gentle-extensions:conflicts`
Shows resource conflicts (3-way diff).

```
/gentle-extensions:conflicts
```

### `/gentle-extensions:mcp-health`
Real MCP handshake health check.

```
/gentle-extensions:mcp-health
```

### `/gentle-extensions:doctor`
Deep diagnostic with multiple flags.

```
/gentle-extensions:doctor [--graph] [--dot] [--resources] [--routing] [--mcp-health]
```

## Quest Commands

### Architecture Quest
```bash
"Run architecture quest for this feature"
```

### Product Quest
```bash
"Run product quest for this feature"
```

### Architecture Council
```bash
"Use architecture-council to verify AC-01"
```

### Product Contract Verifier
```bash
"Verify product contract for this feature"
```

### Changelog Generator
```bash
"Generate changelog for this release"
```

### Grilling (Bounded Interview)
```bash
/grill-me
```
User-invoked only. Bounded 50-question interview.

## Flag Reference

### `/gentle-extensions:doctor`
| Flag | Description |
|------|-------------|
| `--graph` | Generate resource graph |
| `--dot` | Include GraphViz DOT output |
| `--resources` | Check resource conflicts |
| `--routing` | Validate routing rules |
| `--mcp-health` | Run MCP health checks |

### `/gentle-extensions:doctor`
| Flag | Description |
|------|-------------|
| `--graph` | Generate resource graph |
| `--dot` | Include GraphViz DOT output |
| `--resources` | Check resource conflicts |
| `--routing` | Validate routing rules |
| `--mcp-health` | Run MCP health checks |

### `/gentle-extensions:doctor`
| Flag | Description |
|------|-------------|
| `--graph` | Generate resource graph |
| `--dot` | Include GraphViz DOT output |
| `--resources` | Check resource conflicts |
| `--routing` | Validate routing rules |
| `--mcp-health` | Run MCP health checks |

## MCP Commands

| Command | Description |
|---------|-------------|
| `/gentle-extensions:mcp-status` | Show MCP server status |
| `/gentle-extensions:mcp-install <name>` | Install MCP server |
| `/gentle-extensions:mcp-uninstall <name>` | Uninstall MCP server |
| `/gentle-extensions:mcp-reload` | Reload MCP servers |
| `/gentle-extensions:mcp-health` | Real MCP handshake check |
| `/gentle-extensions:mcp-status` | Lifecycle status |
| `/gentle-extensions:mcp-logs <name>` | View logs (stub) |

## Quest Commands

| Command | Description |
|---------|-------------|
| `"Run architecture quest for <feature>"` | Architectural exploration |
| `"Run product quest for <feature>"` | Product/domain decisions |
| `"Use architecture-council to verify <AC-XX>"` | Verify architectural contract |
| `"Verify product contract for <feature>"` | Verify product contract |
| `"Generate changelog for this release"` | Changelog + SemVer proposals |

## Grilling Commands

| Command | Description |
|---------|-------------|
| `/grill-me` | Start bounded interview (user-invoked) |
| `/grill-me <topic>` | Start grilling on specific topic |

## Diagnostic Commands Summary

| Command | Purpose |
|---------|---------|
| `/gentle-extensions:status` | Quick resource status |
| `/gentle-extensions:resources` | Detailed resource inventory |
| `/gentle-extensions:routing` | Routing rules with details |
| `/gentle-extensions:conflicts` | 3-way diff conflicts |
| `/gentle-extensions:conflicts --force` | Force overwrite conflicts |
| `/gentle-extensions:doctor` | Quick health check |
| `/gentle-extensions:doctor --graph` | Resource graph |
| `/gentle-extensions:doctor --graph --dot` | Graph + GraphViz DOT |
| `/gentle-extensions:doctor --resources` | Resource conflicts |
| `/gentle-extensions:doctor --routing` | Routing validation |
| `/gentle-extensions:doctor --mcp-health` | MCP health checks |
| `/gentle-extensions:doctor --graph --dot` | Graph + GraphViz DOT |
| `/gentle-extensions:mcp-health` | Real MCP handshake |
| `/gentle-extensions:mcp-status` | MCP lifecycle status |
| `/gentle-extensions:mcp-install <name>` | Install MCP server |
| `/gentle-extensions:mcp-uninstall <name>` | Uninstall MCP server |
| `/gentle-extensions:mcp-reload` | Reload MCP servers |
| `/gentle-extensions:mcp-logs <name>` | View MCP logs (stub) |

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    gentle-extensions QUICK REF               │
├─────────────────────────────────────────────────────────────┤
│ STATUS & SYNC                                                │
│   :status          Quick resource status                     │
│   :sync            Sync bundled agents                       │
│   :sync --force    Force overwrite conflicts                 │
├─────────────────────────────────────────────────────────────┤
│ DIAGNOSTICS                                                  │
│   :doctor                    Quick health check              │
│   :doctor --graph            Resource graph                  │
│   :doctor --graph --dot      Graph + GraphViz DOT           │
│   :doctor --resources        Resource conflicts             │
│   :doctor --routing          Routing validation             │
│   :doctor --mcp-health       MCP health checks              │
│   :doctor --graph --dot      Full graph + DOT               │
│   :doctor --graph --resources --routing --mcp-health       │
│   :resources                 Full resource inventory        │
│   :routing                   Routing rules detail           │
│   :conflicts                 3-way diff conflicts           │
│   :conflicts --force         Force overwrite                │
├─────────────────────────────────────────────────────────────┤
│ MCP                                                           │
│   :mcp-status         Status (available/disabled/failed)    │
│   :mcp-install <name>  Install MCP server                   │
│   :mcp-uninstall <name> Uninstall MCP server                │
│   :mcp-reload           Reload MCP servers                  │
│   :mcp-health           Real MCP handshake                  │
│   :mcp-status           Lifecycle status                    │
│   :mcp-logs <name>      View logs (stub)                    │
├─────────────────────────────────────────────────────────────┤
│ QUESTS                                                        │
│   "Run architecture quest for <feature>"                    │
│   "Run product quest for <feature>"                         │
│   "Use architecture-council to verify AC-XX"               │
│   "Verify product contract for <feature>"                  │
│   "Generate changelog for this release"                    │
├─────────────────────────────────────────────────────────────┤
│ GRILLING                                                       │
│   /grill-me              Start bounded interview            │
│   /grill-me <topic>      Grill specific topic               │
└─────────────────────────────────────────────────────────────┘
```