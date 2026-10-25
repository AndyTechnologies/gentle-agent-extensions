---
name: gentle-agent-extension
description: "Trigger: gentle-agent-extensions, extend gentle-ai, extend gentle-pi, add agent, add overlay. How to extend Gentle AI/Pi via gentle-agent-extensions project: add agents, overlays, routing, skills declaratively."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# Gentle Agent Extension Skill

This skill teaches how to extend Gentle AI and Gentle Pi through the `gentle-agent-extensions` project using declarative files only — no code changes to the extension itself.

## Activation Contract

**Use this skill when:**
- Creating a new custom agent for Gentle Pi
- Adding an overlay to an existing agent or the orchestrator
- Defining routing rules for when a custom agent should be delegated to
- Creating a new project skill for use within gentle-agent-extensions
- Modifying or removing any of the above

**Do NOT use this skill for:**
- One-off tasks that don't extend the agent system
- Modifying the gentle-agent-extensions extension code directly
- Changing Gentle AI or Gentle Pi official repositories

## Hard Rules

| Rule | Description |
|------|-------------|
| **No official file modification** | Never modify files managed by Gentle Pi (`~/.pi/agent/agents/`, `~/.pi/agent/subagents/`, `subagents.json`, `.atl/skill-registry.md`) |
| **No duplicate registries** | Do not create parallel agent registries or skill indexes. Use native discovery. |
| **Declarative only** | New capabilities added via files in `agents/`, `overlays/`, `routing/`, `skills/` — not by editing extension code |
| **Extension code is stable** | Changes to `extensions/gentle-agent-extensions.ts` are exceptional and require architectural justification |
| **Manifest ownership** | Only files listed in `.manifest.json` are project-owned. Sync never touches unlisted files. |
| **Idempotent sync** | Running `sync.sh` repeatedly with same config produces no changes |
| **Profile awareness** | Respect installation profile (pi, gentle-shell, gentle-shell-linked) — different agent homes |

## Decision Gates

### Choosing the Right Extension Mechanism

| Need | Mechanism | Location |
|------|-----------|----------|
| New autonomous capability with own prompt | **New Agent** | `agents/{name}.md` |
| Modify behavior of existing agent/orchestrator | **Overlay** | `overlays/{target}.overlay.md` |
| Define when orchestrator delegates to agent | **Routing** | `routing/{agent}.md` |
| Reusable workflow/decision logic for agents | **Skill** | `skills/{name}/SKILL.md` |
| External tool/API integration via MCP | **MCP Server** | `mcp/{name}.mcp.json` |
| New programmatic capability not possible declaratively | **Extension Code** | `extensions/` (rare, justify) |

### Agent vs Overlay vs Skill

| Situation | Action |
|-----------|--------|
| Capability needs its own model/tools/mode | Create Agent + Routing + Skill |
| Existing agent needs extra instructions | Create Overlay targeting that agent |
| Orchestrator needs global routing rules | Create Overlay targeting `orchestrator` |
| Delegation logic is reusable across tasks | Create Skill with Activation Contract |
| Simple one-time instruction addition | Use Overlay (simpler than Agent) |

## Execution Steps

### Procedure A: Add a New Agent

1. **Define identity and purpose**
   - Choose unique name (kebab-case, e.g., `code-reviewer`)
   - Write one-line description of when to use it
   - Determine model, thinking level, mode, tools needed

2. **Create agent definition**
   ```bash
   # Create agent file
   cat > agents/code-reviewer.md <<'EOF'
   ---
   name: code-reviewer
   description: "Reviews code changes for correctness, style, and security"
   model: anthropic/claude-opus-4
   thinking: high
   mode: task
   tools: [read, write, edit, bash, grep]
   ---
   
   # Code Reviewer Agent
   
   You are a senior code reviewer. Review the changes...
   EOF
   ```

3. **Create routing instructions** (if semantic delegation needed)
   ```bash
   cat > routing/code-reviewer.md <<'EOF'
   ---
   agent: code-reviewer
   triggers:
     - "review this code"
     - "code review"
     - "check my changes"
   conditions:
     - "User explicitly requests code review"
     - "PR/MR is ready for review"
   delegation: subagent_run
   ---
   
   # Routing for code-reviewer
   
   ## When to Use
   Delegate when user asks for code review or changes need review.
   
   ## How to Delegate
   Use subagent_run with agent="code-reviewer", mode="task"
   EOF
   ```

4. **Create associated skill** (for semantic activation)
   ```bash
   mkdir -p skills/code-reviewer
   cat > skills/code-reviewer/SKILL.md <<'EOF'
   ---
   name: code-reviewer
   description: "Trigger: code review, review code, check changes. Delegates to code-reviewer agent for code review tasks."
   license: Apache-2.0
   metadata:
     author: gentleman-programming
     version: "1.0"
   ---
   
   # Code Reviewer Skill
   
   ## Activation Contract
   Use when user requests code review or changes need review.
   
   ## Hard Rules
   - Only delegate via subagent_run to code-reviewer agent
   - Pass specific files/changes to review in task description
   
   ## Decision Gates
   | Situation | Action |
   |-----------|--------|
   | User says "review" | Delegate to code-reviewer |
   | General coding task | Do NOT delegate |
   
   ## Execution Steps
   1. Identify files/changes to review
   2. Call subagent_run with agent=code-reviewer
   3. Return review results to user
   
   ## Output Contract
   - Review findings with severity levels
   - Suggested fixes
   
   ## References
   - agents/code-reviewer.md
   - routing/code-reviewer.md
   EOF
   ```

5. **Run sync**
   ```bash
   scripts/sync.sh
   ```

6. **Verify**
   - Run `scripts/doctor.sh` — should pass
   - Start Pi, run `/gentle-extensions:status` — agent listed
   - Test delegation: ask Pi to "review this code" — should invoke agent

7. **Update tests and docs**
   - Add test fixture if new pattern
   - Update README if new capability type

### Procedure B: Add an Overlay

1. **Identify target**
   - Agent name (e.g., `gentle-ai-worker`) or `orchestrator`

2. **Create overlay file**
   ```bash
   cat > overlays/gentle-ai-worker.overlay.md <<'EOF'
   ---
   target: gentle-ai-worker
   priority: 100
   mode: append
   ---
   
   # Overlay for gentle-ai-worker
   
   ## Additional Instructions
   
   When writing tests, always use the project's test utilities.
   Prefer table-driven tests over individual test cases.
   EOF
   ```

3. **Validate target exists**
   - Run `scripts/doctor.sh` — warns if target unknown
   - Target can be global agent, project agent, or `orchestrator`

4. **Run sync**
   ```bash
   scripts/sync.sh
   ```

5. **Verify**
   - Start Pi, invoke target agent
   - Check overlay instructions appear in agent's prompt (via `/gentle-extensions:status` or debug)

6. **Document**
   - Note overlay purpose in PR/docs

## Output Contract

After executing either procedure, the following must be true:

| Output | Verification |
|--------|--------------|
| Agent file in `agents/` | `ls agents/{name}.md` |
| Routing file in `routing/` | `ls routing/{name}.md` |
| Skill dir in `skills/` | `ls skills/{name}/SKILL.md` |
| Overlay file in `overlays/` | `ls overlays/{target}.overlay.md` |
| Sync completes without errors | `scripts/sync.sh` exits 0 |
| Doctor passes | `scripts/doctor.sh` exits 0 |
| Agent discoverable by Gentle Pi | `/gentle-extensions:status` shows agent |
| Overlay applied at runtime | Target agent receives additional instructions |
| Skill indexed by registry | `/skill-registry:refresh` includes skill |
| No official files modified | `git status ~/.pi/agent` clean |
| Manifest updated | `.manifest.json` lists new files |

## Procedure C: Add an MCP Server

1. **Define the MCP server**
   - Choose unique name (kebab-case, e.g., `github`)
   - Write one-line description of what it provides
   - Determine transport: `stdio` (command + args) or `http` (URL)
   - Identify required environment variables (use `${VAR}` syntax)
   - Choose tool exposure: `codemode` (default), `direct`, `deferred`, `hidden`
   - List capabilities: `tools`, `resources`
   - Note any agent dependencies
   - Document authentication requirements

2. **Create MCP definition file**
   ```bash
   cat > mcp/github.mcp.json <<'EOF'
   {
     "name": "github",
     "description": "GitHub API access for issues, PRs, repos",
     "transport": "http",
     "url": "https://api.githubcopilot.com/mcp/",
     "env": {
       "GITHUB_TOKEN": "${GITHUB_TOKEN}"
     },
     "exposure": "deferred",
     "toolExposure": {
       "search_code": "direct",
       "get_*": "codemode",
       "delete_*": "hidden"
     },
     "enabled": true,
     "timeout": 60,
     "capabilities": ["tools"],
     "agentDependencies": ["code-reviewer", "repo-manager"],
     "auth": {
       "type": "bearer",
       "envVar": "GITHUB_TOKEN",
       "description": "GitHub personal access token"
     }
   }
   EOF
   ```

3. **Create or update agent routing with MCP dependencies**
   ```bash
   cat > routing/code-reviewer.md <<'EOF'
   ---
   agent: code-reviewer
   triggers:
     - "review this code"
     - "code review"
   mcpDependencies:
     - github
     - filesystem
   delegation: subagent_run
   ---
   EOF
   ```

4. **Run sync**
   ```bash
   scripts/sync.sh
   ```

5. **Verify**
   - Run `scripts/doctor.sh` — should pass
   - Start Pi, run `/gentle-extensions:status` — MCP server listed
   - Check `/mcp` in Pi — server connected
   - Test delegation: ask Pi to use the MCP tools

6. **Document**
   - Note MCP server purpose and dependencies in PR/docs

### Procedure D: Add MCP Dependencies to an Existing Agent

1. **Update agent routing file** to include `mcpDependencies`:
   ```bash
   cat > routing/my-agent.md <<'EOF'
   ---
   agent: my-agent
   triggers:
     - "search code"
     - "find files"
   mcpDependencies:
     - github
     - filesystem
   delegation: subagent_run
   ---
   EOF
   ```

2. **Run sync** and verify
   ```bash
   scripts/sync.sh
   scripts/doctor.sh
   ```

3. **Test** - The orchestrator will see available MCP servers and their capabilities.

## Updated Output Contract

After executing any procedure, the following must be true:

| Output | Verification |
|--------|--------------|
| Agent file in `agents/` | `ls agents/{name}.md` |
| Routing file in `routing/` | `ls routing/{name}.md` |
| Skill dir in `skills/` | `ls skills/{name}/SKILL.md` |
| Overlay file in `overlays/` | `ls overlays/{target}.overlay.md` |
| MCP definition in `mcp/` | `ls mcp/{name}.mcp.json` |
| Sync completes without errors | `scripts/sync.sh` exits 0 |
| Doctor passes | `scripts/doctor.sh` exits 0 |
| Agent discoverable by Gentle Pi | `/gentle-extensions:status` shows agent |
| Overlay applied at runtime | Target agent receives additional instructions |
| Skill indexed by registry | `/skill-registry:refresh` includes skill |
| MCP server registered | `/mcp` in Pi shows server connected |
| No official files modified | `git status ~/.pi/agent` clean |
| Manifest updated | `.manifest.json` lists new files |

## References

- **Architecture**: `docs/conventions.md`
- **Extension code**: `extensions/gentle-agent-extensions.ts`
- **Install script**: `scripts/install.sh`
- **Sync script**: `scripts/sync.sh`
- **Doctor script**: `scripts/doctor.sh`
- **Gentle Pi agent config**: `~/.pi/agent/npm/node_modules/gentle-pi/lib/agents-config.ts`
- **Gentle Pi skill registry**: `~/.pi/agent/npm/node_modules/gentle-pi/extensions/skill-registry.ts`
- **System prompt append**: `~/.pi/agent/npm/node_modules/gentle-pi/lib/append-system-prompt.ts`
- **Child context filtering**: `~/.pi/agent/npm/node_modules/gentle-pi/lib/child-context-files.ts`
- **Skill style guide**: `~/.pi/agent/npm/node_modules/gentle-pi/docs/skill-style-guide.md`
- **Gentle Shell reference**: `~/.pi/agent/npm/node_modules/gentle-pi/docs/gentle-shell.md`