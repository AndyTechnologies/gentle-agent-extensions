---
name: gentle-agent-extension
description: "Trigger: gentle-agent-extensions, extend gentle-ai, extend gentle-pi, add agent, add overlay. How to extend the gentle-agent-extensions PACKAGE: add bundled agents, overlays, routing, skills, MCPs declaratively."
license: Apache-2.0
metadata:
  author: AndyTechnologies
  version: "1.1"
---

# Gentle Agent Extension Skill (Package Maintainer)

This skill teaches how to extend the **gentle-agent-extensions package itself** by adding bundled resources (agents, overlays, skills, MCPs) that are included when users install the package via `pi install npm:gentle-agent-extensions` or `pi install git:...`.

**This is for PACKAGE MAINTAINERS**, not end users. End users just install the package and get all bundled resources automatically.

## Activation Contract

**Use this skill when:**
- Adding a new bundled agent to the package (available to all users)
- Adding a new bundled overlay to the package
- Adding a new bundled skill to the package
- Adding a new bundled MCP server to the package
- Adding a new bundled routing rule to the package
- Modifying or removing any of the above bundled resources

**Do NOT use this skill for:**
- End-user customization (they don't need this skill)
- Modifying the extension code directly (`src/extension.ts`)
- Changing Gentle AI or Gentle Pi official repositories

## Hard Rules

| Rule | Description |
|------|-------------|
| **Bundled resources only** | All resources live in `resources/` directory of the package |
| **No user project directories** | The package does NOT use user's `agents/`, `overlays/`, `skills/` directories |
| **Extension code is stable** | Changes to `src/extension.ts` are exceptional and require architectural justification |
| **Declarative resources** | New capabilities added via files in `resources/{agents,overlays,skills,routing,mcp}/` |
| **No sync.sh/doctor.sh** | These were removed; functionality is now `/gentle-extensions:*` commands |
| **Version pinning** | peerDependencies use `^1.4.0` matching Pi 1.4.0 |

## Decision Gates

### Choosing the Right Bundled Resource Type

| Need | Mechanism | Location (in package) |
|------|-----------|----------------------|
| New autonomous capability with own prompt | **Bundled Agent** | `resources/agents/{name}.md` |
| Modify behavior of existing agent/orchestrator globally | **Bundled Overlay** | `resources/overlays/{target}.overlay.md` |
| Define when orchestrator delegates to bundled agent | **Bundled Routing** | `resources/routing/{agent}.md` |
| Reusable workflow/decision logic for agents | **Bundled Skill** | `resources/skills/{name}/SKILL.md` |
| External tool/API integration via MCP | **Bundled MCP Server** | `resources/mcp/{name}.mcp.json` |

## Execution Steps

### Procedure A: Add a New Bundled Agent

1. **Define identity and purpose**
   - Choose unique name (kebab-case, e.g., `code-reviewer`)
   - Write one-line description of when to use it
   - Determine model, thinking level, mode, tools needed

2. **Create agent definition in package resources**
   ```bash
   cat > resources/agents/code-reviewer.md <<'EOF'
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

3. **Create routing instructions** (for semantic delegation)
   ```bash
   cat > resources/routing/code-reviewer.md <<'EOF'
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
   mkdir -p resources/skills/code-reviewer
   cat > resources/skills/code-reviewer/SKILL.md <<'EOF'
   ---
   name: code-reviewer
   description: "Trigger: code review, review code, check changes. Delegates to code-reviewer agent for code review tasks."
   license: Apache-2.0
   metadata:
     author: AndyTechnologies
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
   - resources/agents/code-reviewer.md
   - resources/routing/code-reviewer.md
   EOF
   ```

5. **Test locally**
   ```bash
   # In package repo:
   pi -e ./src/extension.ts
   # Test: /gentle-extensions:status should show new agent
   # Test: ask Pi to "review this code" — should invoke agent
   ```

6. **Update tests and version**
   - Add test fixture if new pattern in `tests/`
   - Bump version in `package.json`
   - Publish: `npm publish` or `git tag vX.Y.Z && git push origin vX.Y.Z`

### Procedure B: Add a Bundled Overlay

1. **Identify target**
   - Agent name (e.g., `gentle-ai-worker`) or `orchestrator`

2. **Create overlay file in package resources**
   ```bash
   cat > resources/overlays/gentle-ai-worker.overlay.md <<'EOF'
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
   - `mode`: `append` (default), `prepend`, or `replace`

3. **Test locally**
   ```bash
   pi -e ./src/extension.ts
   # Invoke target agent, check overlay appears via /gentle-extensions:status
   ```

### Procedure C: Add a Bundled MCP Server

1. **Define the MCP server**
   - Choose unique name (kebab-case, e.g., `github`)
   - Write one-line description
   - Determine transport: `stdio` (command + args) or `http` (URL)
   - Identify required environment variables (use `${VAR}` syntax)
   - Choose tool exposure: `codemode` (default), `direct`, `deferred`, `hidden`
   - List capabilities: `tools`, `resources`
   - Note any agent dependencies
   - Document authentication requirements

2. **Create MCP definition in package resources**
   ```bash
   cat > resources/mcp/github.mcp.json <<'EOF'
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
     "agentDependencies": ["architecture-council"],
     "auth": {
       "type": "bearer",
       "envVar": "GITHUB_TOKEN",
       "description": "GitHub personal access token"
     }
   }
   EOF
   ```

3. **Add MCP dependency to relevant agent routing**
   ```bash
   cat > resources/routing/architecture-council.md <<'EOF'
   ---
   agent: architecture-council
   triggers:
     - "verify architectural contract"
     - "architecture council"
   mcpDependencies:
     - github
   delegation: subagent_run
   ---
   EOF
   ```

4. **Test locally**
   ```bash
   pi -e ./src/extension.ts
   # Run /gentle-extensions:status — MCP listed
   # Run /gentle-extensions:mcp-health — connectivity test
   # Check /mcp in Pi — server connected
   ```

### Procedure D: Add a Bundled Skill

1. **Create skill directory and SKILL.md**
   ```bash
   mkdir -p resources/skills/my-skill
   cat > resources/skills/my-skill/SKILL.md <<'EOF'
   ---
   name: my-skill
   description: "Trigger: my skill trigger. What this skill does."
   license: Apache-2.0
   metadata:
     author: AndyTechnologies
     version: "1.0"
   ---
   
   # My Skill
   
   ## Activation Contract
   Use when...
   
   ## Hard Rules
   - Rule 1
   - Rule 2
   
   ## Decision Gates
   | Situation | Action |
   |-----------|--------|
   | X | Do Y |
   
   ## Execution Steps
   1. Step 1
   2. Step 2
   
   ## Output Contract
   - Output 1
   - Output 2
   
   ## References
   - resources/skills/my-skill/SKILL.md
   EOF
   ```

2. **Test locally**
   ```bash
   pi -e ./src/extension.ts
   # Run /skill-registry:refresh — skill should appear
   ```

## Output Contract (Package Maintainer)

After executing any procedure, the following must be true:

| Output | Verification |
|--------|--------------|
| Agent file in `resources/agents/` | `ls resources/agents/{name}.md` |
| Routing file in `resources/routing/` | `ls resources/routing/{name}.md` |
| Skill dir in `resources/skills/` | `ls resources/skills/{name}/SKILL.md` |
| Overlay file in `resources/overlays/` | `ls resources/overlays/{target}.overlay.md` |
| MCP definition in `resources/mcp/` | `ls resources/mcp/{name}.mcp.json` |
| Local test passes | `pi -e ./src/extension.ts` works |
| `/gentle-extensions:status` shows new resource | Run in test Pi session |
| Version bumped in `package.json` | `cat package.json \| grep version` |
| Tests pass | `node --test tests/` |
| Published to npm/git | `npm publish` or `git tag` |

## References

- **Extension code**: `src/extension.ts`
- **Package config**: `package.json` (pi.extensions, pi.skills)
- **Test local**: `pi -e ./src/extension.ts`
- **Gentle Pi extension API**: `~/.pi/agent/install/releases/1.4.0/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- **Gentle Pi packages**: `~/.pi/agent/install/releases/1.4.0/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`
- **Skill style guide**: `~/.pi/agent/install/releases/1.4.0/node_modules/gentle-pi/docs/skill-style-guide.md`