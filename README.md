# gentle-agent-extensions

Extend Gentle AI and Gentle Pi with custom agents, overlays, routing rules, and skills — declaratively, without modifying the official repositories.

## What This Project Does

- **Adds custom agents** to Gentle Pi via declarative Markdown definitions
- **Applies instruction overlays** to existing agents or the orchestrator without modifying their original definitions
- **Defines routing rules** so the orchestrator knows when to delegate to custom agents
- **Provides project skills** that teach future agents how to extend this system correctly
- **Installs as a Pi extension** using the official extension mechanism
- **Syncs idempotently** — repeated runs with the same configuration produce no changes

## What This Project Does NOT Do

- ❌ Modify Gentle AI or Gentle Pi official repositories
- ❌ Create parallel agent registries or skill indexes
- ❌ Require code changes for new agents/overlays
- ❌ Install demo agents or overlays by default
- ❌ Automatically update Gentle AI or Gentle Pi

## Architecture

```
gentle-agent-extensions/
├── agents/              # Custom agent definitions (Markdown + YAML frontmatter)
├── overlays/            # Instruction overlays for existing agents/orchestrator
├── routing/             # Delegation rules for custom agents
├── skills/              # Project skills (including gentle-agent-extension skill)
├── extensions/          # Pi extension (gentle-agent-extensions.ts)
├── scripts/             # install.sh, sync.sh, doctor.sh
├── tests/               # Automated tests
├── docs/                # Documentation (conventions.md)
├── .manifest.json       # Tracks project-owned files
└── README.md            # This file
```

### Extension (`extensions/gentle-agent-extensions.ts`)

A Pi extension that:
1. **Discovers** agents, overlays, and skills from project directories on `session_start`
2. **Injects** orchestrator context via `before_agent_start` using `appendSystemPromptOnce`
3. **Applies overlays** to target agents/orchestrator at runtime
4. **Registers commands**: `/gentle-extensions:sync`, `/gentle-extensions:doctor`, `/gentle-extensions:status`

### Declarative Conventions

See [docs/conventions.md](docs/conventions.md) for complete specification.

**Agents** (`agents/{name}.md`):
```markdown
---
name: my-agent
description: "When to use this agent"
model: anthropic/claude-opus-4
thinking: high
mode: task
tools: [read, write, bash]
---
# Agent Instructions
...
```

**Overlays** (`overlays/{target}.overlay.md`):
```markdown
---
target: orchestrator        # or agent name
priority: 100
mode: append
---
# Additional instructions appended to target's prompt
```

**Routing** (`routing/{agent}.md`):
```markdown
---
agent: my-agent
triggers: ["trigger phrase"]
conditions: ["condition"]
delegation: subagent_run
---
```

**Skills** (`skills/{name}/SKILL.md`):
Follows [Gentle AI Skill Style Guide](https://github.com/Gentleman-Programming/gentle-pi/blob/main/docs/skill-style-guide.md)

## Installation

### Prerequisites

- Pi 1.2.0+
- Gentle Pi (`gentle-pi` package installed)
- Node.js 22+

### Quick Install

```bash
# Clone or navigate to the project
cd gentle-agent-extensions

# Make scripts executable
chmod +x scripts/*.sh

# Install for standard Pi (default profile)
./scripts/install.sh

# Or for Gentle Shell isolated
./scripts/install.sh --profile gentle-shell

# Or for Gentle Shell with --link
./scripts/install.sh --profile gentle-shell-linked
```

### Manual Installation Steps

1. **Register extension with Pi**:
   ```bash
   pi install file:$(pwd)
   ```

2. **Sync project agents/overlays**:
   ```bash
   ./scripts/sync.sh
   ```

3. **Verify installation**:
   ```bash
   ./scripts/doctor.sh
   ```

4. **Start Pi and check status**:
   ```
   /gentle-extensions:status
   ```

### Installation Profiles

| Profile | Agent Home | Use Case |
|---------|------------|----------|
| `pi` | `~/.pi/agent` | Standard Pi installation |
| `gentle-shell` | `~/.local/share/gentle-shell/agent` | Isolated Gentle Shell |
| `gentle-shell-linked` | `~/.pi/agent` | Gentle Shell with `--link` |

Use `--agent-home PATH` to override the profile default.

### Dry Run

Preview changes without making them:
```bash
./scripts/install.sh --dry-run
./scripts/sync.sh --dry-run
```

## Usage

### Synchronization

After adding/modifying agents, overlays, routing, or skills:
```bash
./scripts/sync.sh
```

Options:
- `--dry-run` — Preview changes
- `--check` — Validate only (exit 1 on issues)
- `--profile PROFILE` / `--agent-home PATH` — Target installation

### Doctor

Check installation health:
```bash
./scripts/doctor.sh
./scripts/doctor.sh --verbose  # Detailed output
```

Checks:
- Project structure completeness
- Manifest validity
- Extension installation
- Pi / Gentle Pi versions
- Agent/overlay/skill validation
- Conflict detection (shadowing, unknown targets)
- Skill registry status
- Script permissions

### Status Command

Inside Pi:
```
/gentle-extensions:status
```

Shows discovered agents, overlays, skills directory status.

## Adding a New Agent

Follow **Procedure A** from the `gentle-agent-extension` skill:

```bash
# 1. Create agent definition
cat > agents/my-agent.md <<'EOF'
---
name: my-agent
description: "Reviews code for security issues"
model: anthropic/claude-opus-4
thinking: high
mode: task
tools: [read, grep, bash]
---
# My Agent

You are a security reviewer...
EOF

# 2. Create routing (if semantic delegation needed)
cat > routing/my-agent.md <<'EOF'
---
agent: my-agent
triggers:
  - "security review"
  - "check for vulnerabilities"
conditions:
  - "User requests security review"
delegation: subagent_run
---
# Routing for my-agent
...
EOF

# 3. Create skill (for semantic activation)
mkdir -p skills/my-agent
cat > skills/my-agent/SKILL.md <<'EOF'
---
name: my-agent
description: "Trigger: security review, check vulnerabilities. Delegates to my-agent for security reviews."
license: Apache-2.0
metadata:
  author: your-name
  version: "1.0"
---
# My Agent Skill
## Activation Contract
Use when user requests security review.
## Hard Rules
Only delegate via subagent_run to my-agent.
## Decision Gates
| Situation | Action |
|-----------|--------|
| "security review" | Delegate to my-agent |
| General coding | Do NOT delegate |
## Execution Steps
1. Identify files to review
2. Call subagent_run with agent=my-agent
3. Return results
## Output Contract
Security findings with severity
## References
- agents/my-agent.md
- routing/my-agent.md
EOF

# 4. Sync and verify
./scripts/sync.sh
./scripts/doctor.sh
```

Test in Pi:
```
"Please do a security review of my changes"
```

### Adding an Overlay

Follow **Procedure B** from the skill:

```bash
# 1. Create overlay for existing agent or orchestrator
cat > overlays/gentle-ai-worker.overlay.md <<'EOF'
---
target: gentle-ai-worker
priority: 100
mode: append
---
# Overlay for gentle-ai-worker

## Additional Instructions

When writing tests, always use table-driven tests.
Prefer the project's test utilities.
EOF

# 2. Sync and verify
./scripts/sync.sh
./scripts/doctor.sh
```

The overlay instructions are appended to the target agent's prompt at runtime via `before_agent_start`.

## Verifying Routing and Activation

1. **Check status**: `/gentle-extensions:status`
2. **Trigger delegation**: Use trigger phrases from routing
3. **Check doctor**: `./scripts/doctor.sh` validates targets exist
4. **Inspect prompt**: Add temporary overlay with obvious marker to verify injection

## Troubleshooting

### Agent Not Discovered

```bash
./scripts/doctor.sh --verbose
# Check:
# - Agent file in agents/ with .md extension
# - Valid frontmatter with name field
# - sync.sh ran successfully
# - Extension loaded (check Pi startup logs)
```

### Overlay Not Applied

```bash
./scripts/doctor.sh
# Check:
# - Overlay file in overlays/ with .overlay.md extension
# - Target exists (global agent, project agent, or "orchestrator")
# - Extension's before_agent_start handler running
```

### Skill Not Indexed

```bash
# Refresh skill registry
/skill-registry:refresh

# Verify
cat .atl/skill-registry.md | grep your-skill
```

### Extension Not Loading

```bash
# Check Pi settings
cat ~/.pi/agent/settings.json
# Should include: { "packages": [{ "source": "file:/path/to/gentle-agent-extensions" }] }

# Reinstall
pi remove file:/path/to/gentle-agent-extensions
pi install file:/path/to/gentle-agent-extensions
```

### Conflicts Detected

Doctor reports:
- **Shadowing**: Project agent same name as global agent → rename or accept
- **Unknown overlay target**: Target agent doesn't exist → create agent or fix target name

## Limitations

| Limitation | Workaround |
|------------|------------|
| No agent removal via sync | Manually delete from `.pi/agents/` and manifest |
| Overlay priority only affects order | Use single overlay per target, or order by priority |
| Skills require manual registry refresh | Run `/skill-registry:refresh` after adding skills |
| No hot-reload of extension | Restart Pi or `reload` command |
| Profile detection is manual | Use `--profile` or `--agent-home` explicitly |

## Development

### Running Tests

```bash
node --test tests/gentle-extensions.test.ts
```

### Project Skill

The `gentle-agent-extension` skill teaches agents how to extend this system:
```
skills/gentle-agent-extension/SKILL.md
```

Load it when working on this project:
```
/skill-registry:refresh
# Then in agent context, the skill will be available for relevant tasks
```

### Extending the Extension

Changes to `extensions/gentle-agent-extensions.ts` are exceptional. Before modifying:
1. Verify the declarative approach cannot achieve the goal
2. Document the architectural justification
3. Update tests and conventions.md

## Compatibility

Tested with:
- Pi 1.4.0+
- gentle-pi (bundled in Gentle Shell)
- gentle-ai (bundled)

Version detection via `doctor.sh`.

## License

Apache-2.0 — see LICENSE file.

## References

- [Gentle Pi Documentation](https://github.com/Gentleman-Programming/gentle-shell)
- [Gentle AI Skill Style Guide](https://github.com/Gentleman-Programming/gentle-pi/blob/main/docs/skill-style-guide.md)
- [Pi Extensions API](https://pi.dev/docs/latest/extensions)
- [Pi Packages](https://pi.dev/docs/latest/packages)
---

<div align="center">

![Built with Gentle-AI](https://img.shields.io/badge/Built%20with-Gentle--AI-F095C8?style=for-the-badge&labelColor=1A1218)

</div>
